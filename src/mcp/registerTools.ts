import type { McpServer } from '@modelcontextprotocol/server';
import type { AppConfig } from '../config.js';
import { WorkClockService } from '../services/workClockService.js';
import { buildRequestContext } from '../services/context.js';
import {
  AmendInputSchema,
  ExportEnvelopeSchema,
  ExportInputSchema,
  PauseInputSchema,
  ResumeInputSchema,
  StartInputSchema,
  StatusInputSchema,
  StopInputSchema,
  SummaryInputSchema,
  WorkClockEnvelopeSchema,
} from './schemas.js';
import { handleToolError, toExportSuccess, toToolSuccess } from './toolResult.js';
import { uiToolMeta } from './uiMeta.js';
import { incrementMetric } from '../observability/metrics.js';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function registerTools(server: McpServer, config: AppConfig): WorkClockService {
  const service = new WorkClockService(config);

  server.registerTool(
    'timelog.start',
    {
      title: 'Start Work Timer',
      description:
        'Use when the user wants to start tracking work time, including Japanese phrases like "設計開始", "実装開始", "〇〇を始める", or "begin focus session". Starts exactly one active session.',
      inputSchema: StartInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: WRITE,
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.start');
        const envelope = await service.start(buildRequestContext(config), args);
        return toToolSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.pause',
    {
      title: 'Pause Work Timer',
      description: 'Use when the user says 休憩, 一旦停止, pause, 昼休み, or 割り込み.',
      inputSchema: PauseInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: WRITE,
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.pause');
        const envelope = await service.pause(buildRequestContext(config), args);
        return toToolSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.resume',
    {
      title: 'Resume Work Timer',
      description: 'Use when the user says 再開, 戻った, continue, or resume.',
      inputSchema: ResumeInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: WRITE,
      _meta: uiToolMeta(),
    },
    async (_args, _ctx) => {
      try {
        incrementMetric('tool.resume');
        const envelope = await service.resume(buildRequestContext(config));
        return toToolSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.stop',
    {
      title: 'Stop Work Timer',
      description: 'Use when the user says 終了, 完了, 今日はここまで, stop timer, or finish task.',
      inputSchema: StopInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: WRITE,
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.stop');
        const envelope = await service.stop(buildRequestContext(config), args);
        return toToolSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.status',
    {
      title: 'Work Timer Status',
      description: 'Read-only status for active session, elapsed time, pomodoro state, and today totals.',
      inputSchema: StatusInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: READ_ONLY,
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.status');
        const envelope = await service.status(buildRequestContext(config), args);
        return toToolSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.summary',
    {
      title: 'Work Time Summary',
      description:
        'Read-only summary for today/yesterday/week/month/custom periods with grouping by task/project/ticket/tag/day.',
      inputSchema: SummaryInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: READ_ONLY,
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.summary');
        const envelope = await service.summary(buildRequestContext(config), args);
        return toToolSuccess(envelope, envelope.markdown ?? undefined);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.amend',
    {
      title: 'Amend Work Log',
      description:
        'Append a correction event for a recent session. Does not silently rewrite JSONL history; Markdown is regenerated from events.',
      inputSchema: AmendInputSchema,
      outputSchema: WorkClockEnvelopeSchema,
      annotations: WRITE,
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.amend');
        const envelope = await service.amend(buildRequestContext(config), args);
        return toToolSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  server.registerTool(
    'timelog.export',
    {
      title: 'Export Work Log',
      description:
        'Export tracked time for copy-paste into other tools. Formats: csv (spreadsheets), json (programmatic), standup (日報), weekly (週報), obsidian (wikilinks). Optionally writes a file under the safe exports/ folder. Does not auto-send to any external service.',
      inputSchema: ExportInputSchema,
      outputSchema: ExportEnvelopeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: uiToolMeta(),
    },
    async (args, _ctx) => {
      try {
        incrementMetric('tool.export');
        const envelope = await service.export(buildRequestContext(config), args);
        return toExportSuccess(envelope);
      } catch (error) {
        return handleToolError(error);
      }
    },
  );

  return service;
}
