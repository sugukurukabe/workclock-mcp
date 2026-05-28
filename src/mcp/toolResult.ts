import type { CallToolResult } from '@modelcontextprotocol/server';
import type {
  ActiveSession,
  TodaySummary,
  ToolAction,
  WorkClockEnvelope,
  WorkClockFiles,
  WorkClockWarning,
} from '../domain/types.js';
import { formatDurationHuman } from '../storage/markdownRenderer.js';
import { isWorkClockError, WorkClockError } from './errors.js';

export type ExportEnvelope = {
  ok: boolean;
  action: 'exported';
  format: 'csv' | 'json' | 'standup' | 'weekly' | 'obsidian';
  period: string;
  mimeType: string;
  content: string;
  byline: string;
  sessionCount: number;
  filePath: string | null;
  fileResourceUri: string | null;
  warnings: WorkClockWarning[];
};

export function toExportSuccess(envelope: ExportEnvelope): CallToolResult {
  const fileNote = envelope.fileResourceUri ? ` (saved: ${envelope.fileResourceUri})` : '';
  return {
    content: [
      { type: 'text', text: `WorkClock export [${envelope.format}] ${envelope.period}${fileNote}` },
      { type: 'text', text: envelope.content },
    ],
    structuredContent: envelope as unknown as Record<string, unknown>,
  };
}

export function buildEnvelope(partial: Omit<WorkClockEnvelope, 'ok'> & { ok?: boolean }): WorkClockEnvelope {
  return {
    ok: partial.ok ?? true,
    action: partial.action,
    workspaceKey: partial.workspaceKey,
    timezone: partial.timezone,
    activeSession: partial.activeSession,
    session: partial.session,
    today: partial.today,
    files: partial.files,
    markdown: partial.markdown,
    promptPack: partial.promptPack,
    warnings: partial.warnings,
  };
}

export function emptyToday(date: string): TodaySummary {
  return {
    date,
    totalActiveMs: 0,
    byTask: [],
    byProject: [],
    sessionCount: 0,
    contextSwitchCount: 0,
    longestFocusBlockMs: 0,
  };
}

export function emptyFiles(): WorkClockFiles {
  return {
    logRoot: null,
    dailyMarkdownPath: null,
    dailyMarkdownResourceUri: null,
    eventsJsonlPath: null,
  };
}

export function toToolSuccess(
  envelope: WorkClockEnvelope,
  text?: string,
): CallToolResult {
  return {
    content: [{ type: 'text', text: text ?? buildTextSummary(envelope) }],
    structuredContent: envelope as unknown as Record<string, unknown>,
  };
}

export function toToolError(
  error: WorkClockError,
  activeSession?: ActiveSession | null,
): CallToolResult {
  const detailsSession =
    activeSession ??
    (error.details?.activeSession as ActiveSession | undefined) ??
    null;

  return {
    content: [{ type: 'text', text: `WorkClock failed: ${error.message}` }],
    structuredContent: {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
      activeSession: detailsSession ?? undefined,
    },
    isError: true,
  };
}

export function handleToolError(error: unknown, activeSession?: ActiveSession | null): CallToolResult {
  if (isWorkClockError(error)) {
    return toToolError(error, activeSession);
  }

  if (error instanceof Error) {
    const mapped = mapThrownError(error);
    if (mapped) return toToolError(mapped, activeSession);
  }

  return toToolError(new WorkClockError('INTERNAL_ERROR', 'Unexpected internal error.'));
}

function mapThrownError(error: Error): WorkClockError | null {
  switch (error.message) {
    case 'ACTIVE_SESSION_EXISTS':
      return new WorkClockError('ACTIVE_SESSION_EXISTS', 'Active session already exists.');
    case 'NO_ACTIVE_SESSION':
      return new WorkClockError('NO_ACTIVE_SESSION', 'No active session found.');
    case 'ALREADY_PAUSED':
      return new WorkClockError('ALREADY_PAUSED', 'Session is already paused.');
    case 'NO_PAUSED_SESSION':
      return new WorkClockError('NO_PAUSED_SESSION', 'No paused session found.');
    case 'SESSION_NOT_FOUND':
      return new WorkClockError('SESSION_NOT_FOUND', 'Target session not found.');
    default:
      return null;
  }
}

export function buildTextSummary(envelope: WorkClockEnvelope): string {
  const warnings = envelope.warnings.length
    ? `\nWarnings: ${envelope.warnings.map((w) => w.code).join(', ')}`
    : '';

  switch (envelope.action) {
    case 'started':
      return `Started tracking "${envelope.activeSession?.taskName}" (${formatDurationHuman(0)} elapsed).${warnings}`;
    case 'paused':
      return `Paused "${envelope.activeSession?.taskName}".${warnings}`;
    case 'resumed':
      return `Resumed "${envelope.activeSession?.taskName}".${warnings}`;
    case 'stopped':
      return `Stopped "${envelope.session?.taskName}" — ${formatDurationHuman(envelope.session?.totalActiveMs ?? 0)} logged.${warnings}`;
    case 'status':
      if (!envelope.activeSession) return `No active session. Today total: ${formatDurationHuman(envelope.today.totalActiveMs)}.${warnings}`;
      return `Active: "${envelope.activeSession.taskName}". Today total: ${formatDurationHuman(envelope.today.totalActiveMs)}.${warnings}`;
    case 'summary':
      return `Summary (${envelope.today.date}): ${formatDurationHuman(envelope.today.totalActiveMs)} across ${envelope.today.sessionCount} sessions.${warnings}`;
    case 'amended':
      return `Amended session log. Reason recorded.${warnings}`;
  }
}

export function mergeWarnings(...groups: WorkClockWarning[][]): WorkClockWarning[] {
  const seen = new Set<string>();
  const merged: WorkClockWarning[] = [];
  for (const group of groups) {
    for (const warning of group) {
      if (seen.has(warning.code)) continue;
      seen.add(warning.code);
      merged.push(warning);
    }
  }
  return merged;
}

export function actionLabel(action: ToolAction): string {
  return action;
}
