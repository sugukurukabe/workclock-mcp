import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { AppConfig } from '../config.js';
import { WorkClockError } from '../mcp/errors.js';

export interface AuthContext {
  userKey: string;
  workspaceKey: string;
}

export type AuthedRequest = Request & {
  authContext?: AuthContext;
  auth?: AuthInfo;
};

export function createAuthMiddleware(config: AppConfig) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (config.mode === 'local') {
      req.authContext = {
        userKey: config.userKey,
        workspaceKey: config.workspaceKey,
      };
      next();
      return;
    }

    if (!config.remoteRequireAuth) {
      req.authContext = {
        userKey: config.userKey,
        workspaceKey: config.workspaceKey,
      };
      next();
      return;
    }

    const authHeader = req.header('authorization');
    const gatewaySig = req.header('x-workclock-signature');
    const userHeader = req.header('x-workclock-user');
    const workspaceHeader = req.header('x-workclock-workspace');

    if (config.trustedGatewayHmacSecret && gatewaySig && userHeader) {
      const payload = `${req.method}:${req.path}:${userHeader}:${workspaceHeader ?? 'default'}`;
      const expected = crypto
        .createHmac('sha256', config.trustedGatewayHmacSecret)
        .update(payload)
        .digest('hex');
      if (expected.length === gatewaySig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(gatewaySig))) {
        req.authContext = {
          userKey: userHeader,
          workspaceKey: workspaceHeader ?? 'default',
        };
        next();
        return;
      }
    }

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      if (token.length >= 8) {
        req.authContext = {
          userKey: hashToken(token),
          workspaceKey: workspaceHeader ?? 'default',
        };
        next();
        return;
      }
    }

    next(new WorkClockError('AUTH_REQUIRED', 'Authentication is required for remote write operations.'));
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}
