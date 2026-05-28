import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/server';
import { ResourceTemplate } from '@modelcontextprotocol/server';
import type { AppConfig } from '../config.js';
import { loadCheckpoint, readAllEvents } from '../storage/eventStore.js';
import { renderDailyMarkdown } from '../storage/markdownRenderer.js';
import { getLogRoot } from '../storage/rootPolicy.js';
import { rebuildCompletedSessions } from '../domain/session.js';
import {
  buildPromptPack,
  computeFocusMetrics,
  filterSessionsInRange,
  resolvePeriodRange,
} from '../domain/summary.js';
import { buildExport, type ExportFormat } from '../domain/export.js';
import { UI_CSP, UI_MIME_TYPE, UI_RESOURCE_URI } from './uiMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function registerResources(server: McpServer, config: AppConfig): Promise<void> {
  server.registerResource(
    'worklog-active',
    'worklog://active',
    {
      title: 'Active Work Session',
      description: 'Current active work session JSON.',
      mimeType: 'application/json',
    },
    async () => {
      const { root } = await getLogRoot(config);
      const active = await loadCheckpoint(root, config.userKey, config.workspaceKey);
      return {
        contents: [
          {
            uri: 'worklog://active',
            mimeType: 'application/json',
            text: JSON.stringify(active, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'worklog-daily',
    new ResourceTemplate('worklog://daily/{date}', { list: undefined }),
    {
      title: 'Daily Work Log',
      description: 'Generated Markdown daily work log.',
      mimeType: 'text/markdown',
    },
    async (uri, { date }) => {
      const { root } = await getLogRoot(config);
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const active = await loadCheckpoint(root, config.userKey, config.workspaceKey);
      const markdown = renderDailyMarkdown({
        date: String(date),
        timezone: config.timezone,
        activeSession: active,
        completedSessions: completed,
        events,
        nowEpochMs: Date.now(),
      });
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: markdown }],
      };
    },
  );

  server.registerResource(
    'worklog-summary',
    new ResourceTemplate('worklog://summary/{period}', { list: undefined }),
    {
      title: 'Work Summary',
      description: 'Generated Markdown summary for a period.',
      mimeType: 'text/markdown',
    },
    async (uri, { period }) => {
      const { root } = await getLogRoot(config);
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const range = resolvePeriodRange(
        { period: normalizePeriod(String(period)) },
        config.timezone,
      );
      const filtered = filterSessionsInRange(completed, range.fromEpochMs, range.toEpochMs);
      const metrics = computeFocusMetrics(filtered, events);
      const markdown = buildPromptPack(filtered, metrics, 'task', config.timezone, String(period));
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: markdown }],
      };
    },
  );

  server.registerResource(
    'worklog-export',
    new ResourceTemplate('worklog://export/{format}/{period}', { list: undefined }),
    {
      title: 'Work Log Export',
      description: 'Regenerated export (csv/json/standup/weekly/obsidian) for a period.',
      mimeType: 'text/plain',
    },
    async (uri, { format, period }) => {
      const { root } = await getLogRoot(config);
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const range = resolvePeriodRange(
        { period: normalizePeriod(String(period)) },
        config.timezone,
      );
      const filtered = filterSessionsInRange(completed, range.fromEpochMs, range.toEpochMs);
      const result = buildExport({
        format: normalizeFormat(String(format)),
        sessions: filtered,
        events,
        timezone: config.timezone,
        periodLabel: String(period),
        groupBy: 'task',
      });
      return {
        contents: [{ uri: uri.href, mimeType: result.mimeType, text: result.content }],
      };
    },
  );

  await registerUiResource(server);
}

function normalizeFormat(format: string): ExportFormat {
  if (
    format === 'csv' ||
    format === 'json' ||
    format === 'standup' ||
    format === 'weekly' ||
    format === 'obsidian'
  ) {
    return format;
  }
  return 'standup';
}

async function registerUiResource(server: McpServer): Promise<void> {
  const bundledPath = path.resolve(__dirname, '../ui/index.html');
  let html = '';
  try {
    html = await fs.readFile(bundledPath, 'utf8');
  } catch {
    html = `<!doctype html><html><head><meta charset="utf-8"><title>WorkClock</title></head><body><p>UI bundle not built. Run npm run build:ui</p></body></html>`;
  }

  server.registerResource(
    'workclock-timer-ui',
    UI_RESOURCE_URI,
    {
      title: 'WorkClock Timer UI',
      description: 'Interactive timer card for Sugukuru WorkClock MCP.',
      mimeType: UI_MIME_TYPE,
      _meta: {
        ui: {
          csp: UI_CSP,
        },
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: UI_MIME_TYPE,
          text: html,
        },
      ],
    }),
  );
}

function normalizePeriod(period: string): 'today' | 'yesterday' | 'week' | 'month' | 'custom' {
  if (period === 'yesterday' || period === 'week' || period === 'month' || period === 'custom') {
    return period;
  }
  return 'today';
}
