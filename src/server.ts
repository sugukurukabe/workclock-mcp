import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';
import type { AppConfig } from './config.js';
import { registerResources } from './mcp/registerResources.js';
import { registerTools } from './mcp/registerTools.js';
import { getLogger } from './observability/logger.js';
import { createAuthMiddleware, type AuthedRequest } from './security/auth.js';
import { runWithAuthContext } from './services/context.js';
import { applyCorsHeaders, createOriginMiddleware } from './security/originPolicy.js';
import { createRateLimitMiddleware } from './security/rateLimit.js';
import { setMcpRoots } from './storage/rootPolicy.js';

export async function createWorkClockServer(config: AppConfig): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'sugukuru-workclock-mcp',
      version: '1.0.0',
    },
    {
      instructions:
        'Sugukuru WorkClock MCP tracks developer work time. Use timelog.start to begin, timelog.pause/resume for breaks, timelog.stop to finish, timelog.status for current state, timelog.summary for reports, timelog.amend for corrections with a reason.',
    },
  );

  registerTools(server, config);
  await registerResources(server, config);

  server.server.oninitialized = async () => {
    try {
      const { roots } = await server.server.listRoots();
      setMcpRoots(roots.map((root) => root.uri));
    } catch {
      setMcpRoots(undefined);
    }
  };

  return server;
}

export async function startStdioServer(config: AppConfig): Promise<void> {
  const server = await createWorkClockServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startHttpServer(config: AppConfig): Promise<void> {
  const app = createMcpExpressApp({ host: config.host }) as Express;
  const logger = getLogger();
  const transports = new Map<string, NodeStreamableHTTPServerTransport>();

  app.use(express.json({ limit: '1mb' }));
  app.use(createRateLimitMiddleware());
  app.use(createOriginMiddleware(config));
  app.use(createAuthMiddleware(config));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/readyz', (_req, res) => {
    res.json({ ok: true, mode: config.mode });
  });

  app.options('/mcp', (req, res) => {
    applyCorsHeaders(req, res, config);
    res.status(204).end();
  });

  app.post('/mcp', async (req, res) => {
    applyCorsHeaders(req, res, config);
    const authedReq = req as AuthedRequest;

    const sessionId = req.header('mcp-session-id') ?? randomUUID();
    let transport = transports.get(sessionId);

    if (!transport) {
      transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });
      const server = await createWorkClockServer(config);
      await server.connect(transport);
      transports.set(sessionId, transport);
    }

    const auth = authedReq.authContext;
    if (auth) {
      authedReq.auth = {
        token: auth.userKey,
        clientId: auth.workspaceKey,
        scopes: [],
        extra: {
          userKey: auth.userKey,
          workspaceKey: auth.workspaceKey,
        },
      };
      await runWithAuthContext(auth, () => transport!.handleRequest(authedReq, res, req.body));
      return;
    }

    await transport.handleRequest(authedReq, res, req.body);
  });

  app.listen(config.port, config.host, () => {
    logger.info({ host: config.host, port: config.port }, 'WorkClock HTTP server listening');
  });
}
