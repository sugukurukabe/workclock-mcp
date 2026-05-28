import type { AppConfig } from '../config.js';
import type {
  ActiveSession,
  CompletedSession,
  RequestContext,
  WorkClockWarning,
} from '../domain/types.js';
import {
  buildActiveSession,
  enrichActiveSession,
  pauseSession,
  rebuildCompletedSessions,
  resumeSession,
  stopSession,
} from '../domain/session.js';
import {
  buildPromptPack,
  buildTodaySummary,
  computeFocusMetrics,
  filterSessionsInRange,
  groupSessions,
  resolvePeriodRange,
} from '../domain/summary.js';
import { todayDateString } from '../domain/timerMath.js';
import { detectGitContext } from '../domain/gitContext.js';
import {
  buildExport,
  exportFileRelativePath,
  type ExportFormat,
  type ExportResult,
} from '../domain/export.js';
import { WorkClockError } from '../mcp/errors.js';
import {
  buildEnvelope,
  emptyFiles,
  emptyToday,
  mergeWarnings,
} from '../mcp/toolResult.js';
import type {
  AmendInput,
  ExportInput,
  PauseInput,
  StartInput,
  StatusInput,
  StopInput,
  SummaryInput,
} from '../mcp/schemas.js';
import type { ExportEnvelope } from '../mcp/toolResult.js';
import { appendWorkEvent, loadCheckpoint, readAllEvents, removeCheckpoint, saveCheckpoint } from '../storage/eventStore.js';
import { withFileLock } from '../storage/fileLock.js';
import { renderDailyMarkdown } from '../storage/markdownRenderer.js';
import {
  dailyMarkdownRelativePath,
  eventsJsonlRelativePath,
  resolveSafeFilePath,
  toDailyResourceUri,
} from '../storage/paths.js';
import { atomicWriteFile, getLogRoot } from '../storage/rootPolicy.js';

export class WorkClockService {
  constructor(private readonly config: AppConfig) {}

  async start(ctx: RequestContext, input: StartInput) {
    return this.withLock(ctx, async (root) => {
      const now = Date.now();
      let warnings: WorkClockWarning[] = [];
      let active = await loadCheckpoint(root, ctx.userKey, ctx.workspaceKey);

      if (active && !input.autoStopPrevious) {
        throw new WorkClockError('ACTIVE_SESSION_EXISTS', 'Active session already exists.', {
          details: { activeSession: active },
        });
      }

      if (active && input.autoStopPrevious) {
        const stopped = stopSession(active, now, 'auto-stopped before new session', 'stopped');
        await appendWorkEvent(root, {
          schemaVersion: 1,
          userKey: ctx.userKey,
          workspaceKey: ctx.workspaceKey,
          sessionId: stopped.id,
          type: 'stopped',
          atIso: stopped.endedAtIso,
          atEpochMs: stopped.endedAtEpochMs,
          taskName: stopped.taskName,
          project: stopped.project,
          ticket: stopped.ticket,
          tags: stopped.tags,
          totalActiveMs: stopped.totalActiveMs,
          note: stopped.note,
          requestId: ctx.requestId,
        });
        await removeCheckpoint(root, ctx.userKey, ctx.workspaceKey);
        await this.renderDay(root, stopped.startedAtEpochMs, now, ctx);
        active = null;
      }

      let resolvedInput = input;
      if (this.config.enableGitContext && (!input.project || !input.ticket)) {
        const git = await detectGitContext(process.cwd());
        resolvedInput = {
          ...input,
          project: input.project ?? git.project ?? undefined,
          ticket: input.ticket ?? git.ticket ?? undefined,
        };
      }

      const session = buildActiveSession(ctx, resolvedInput, now, {
        defaultWorkMinutes: this.config.defaultWorkMinutes,
        defaultShortBreakMinutes: this.config.defaultShortBreakMinutes,
        defaultLongBreakMinutes: this.config.defaultLongBreakMinutes,
        defaultMode: this.config.defaultMode,
        projectName: this.config.projectName,
      });

      await appendWorkEvent(root, {
        schemaVersion: 1,
        userKey: ctx.userKey,
        workspaceKey: ctx.workspaceKey,
        sessionId: session.id,
        type: 'started',
        atIso: session.startedAtIso,
        atEpochMs: session.startedAtEpochMs,
        taskName: session.taskName,
        project: session.project,
        ticket: session.ticket,
        tags: session.tags,
        note: session.note,
        requestId: ctx.requestId,
      });

      await saveCheckpoint(root, session);
      const files = await this.renderDay(root, session.startedAtEpochMs, now, ctx, session);
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const today = buildTodaySummary(completed, events, this.config.timezone);
      const enriched = enrichActiveSession(session, now, this.config.maxSessionHours);
      warnings = mergeWarnings(warnings, enriched.warnings);

      return buildEnvelope({
        action: 'started',
        workspaceKey: ctx.workspaceKey,
        timezone: this.config.timezone,
        activeSession: enriched.session,
        session: null,
        today,
        files,
        warnings,
      });
    });
  }

  async pause(ctx: RequestContext, input: PauseInput) {
    return this.withLock(ctx, async (root) => {
      const now = Date.now();
      const active = await loadCheckpoint(root, ctx.userKey, ctx.workspaceKey);
      if (!active) throw new WorkClockError('NO_ACTIVE_SESSION', 'No active session found.');

      let updated: ActiveSession;
      let warnings: WorkClockWarning[] = [];
      try {
        const result = pauseSession(active, now, input.reason, input.breakType);
        updated = result.session;
        warnings = result.warnings.filter(Boolean) as WorkClockWarning[];
      } catch {
        throw new WorkClockError('ALREADY_PAUSED', 'Session is already paused.');
      }

      await appendWorkEvent(root, {
        schemaVersion: 1,
        userKey: ctx.userKey,
        workspaceKey: ctx.workspaceKey,
        sessionId: updated.id,
        type: 'paused',
        atIso: new Date(now).toISOString(),
        atEpochMs: now,
        taskName: updated.taskName,
        reason: input.reason,
        requestId: ctx.requestId,
      });

      await saveCheckpoint(root, updated);
      const files = await this.renderDay(root, updated.startedAtEpochMs, now, ctx, updated);
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const today = buildTodaySummary(completed, events, this.config.timezone);
      const enriched = enrichActiveSession(updated, now, this.config.maxSessionHours);
      warnings = mergeWarnings(warnings, enriched.warnings);

      return buildEnvelope({
        action: 'paused',
        workspaceKey: ctx.workspaceKey,
        timezone: this.config.timezone,
        activeSession: enriched.session,
        session: null,
        today,
        files,
        warnings,
      });
    });
  }

  async resume(ctx: RequestContext) {
    return this.withLock(ctx, async (root) => {
      const now = Date.now();
      const active = await loadCheckpoint(root, ctx.userKey, ctx.workspaceKey);
      if (!active) throw new WorkClockError('NO_ACTIVE_SESSION', 'No active session found.');

      let updated: ActiveSession;
      try {
        updated = resumeSession(active, now);
      } catch {
        throw new WorkClockError('NO_PAUSED_SESSION', 'No paused session found.');
      }

      await appendWorkEvent(root, {
        schemaVersion: 1,
        userKey: ctx.userKey,
        workspaceKey: ctx.workspaceKey,
        sessionId: updated.id,
        type: 'resumed',
        atIso: new Date(now).toISOString(),
        atEpochMs: now,
        taskName: updated.taskName,
        requestId: ctx.requestId,
      });

      await saveCheckpoint(root, updated);
      const files = await this.renderDay(root, updated.startedAtEpochMs, now, ctx, updated);
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const today = buildTodaySummary(completed, events, this.config.timezone);
      const enriched = enrichActiveSession(updated, now, this.config.maxSessionHours);

      return buildEnvelope({
        action: 'resumed',
        workspaceKey: ctx.workspaceKey,
        timezone: this.config.timezone,
        activeSession: enriched.session,
        session: null,
        today,
        files,
        warnings: enriched.warnings,
      });
    });
  }

  async stop(ctx: RequestContext, input: StopInput) {
    return this.withLock(ctx, async (root) => {
      const now = Date.now();
      const active = await loadCheckpoint(root, ctx.userKey, ctx.workspaceKey);
      if (!active) throw new WorkClockError('NO_ACTIVE_SESSION', 'No active session found.');

      const completed = stopSession(active, now, input.note, input.outcome, input.tags);
      await appendWorkEvent(root, {
        schemaVersion: 1,
        userKey: ctx.userKey,
        workspaceKey: ctx.workspaceKey,
        sessionId: completed.id,
        type: 'stopped',
        atIso: completed.endedAtIso,
        atEpochMs: completed.endedAtEpochMs,
        taskName: completed.taskName,
        project: completed.project,
        ticket: completed.ticket,
        tags: completed.tags,
        totalActiveMs: completed.totalActiveMs,
        note: completed.note,
        requestId: ctx.requestId,
      });

      await removeCheckpoint(root, ctx.userKey, ctx.workspaceKey);
      const files = await this.renderDay(root, completed.startedAtEpochMs, now, ctx, null, completed);
      const events = await readAllEvents(root);
      const allCompleted = rebuildCompletedSessions(events);
      const today = buildTodaySummary(allCompleted, events, this.config.timezone);

      return buildEnvelope({
        action: 'stopped',
        workspaceKey: ctx.workspaceKey,
        timezone: this.config.timezone,
        activeSession: null,
        session: completed,
        today,
        files,
        warnings: [],
      });
    });
  }

  async status(ctx: RequestContext, input: StatusInput) {
    const now = Date.now();
    const { root: logRoot } = await getLogRoot(this.config);
    const active = await loadCheckpoint(logRoot, ctx.userKey, ctx.workspaceKey);
    const events = await readAllEvents(logRoot);
    const completed = rebuildCompletedSessions(events);
    const today = input.includeTodaySummary
      ? buildTodaySummary(completed, events, this.config.timezone)
      : emptyToday(todayDateString(this.config.timezone));

    let activeSession: ActiveSession | null = null;
    let warnings: WorkClockWarning[] = [];
    if (active) {
      const enriched = enrichActiveSession(active, now, this.config.maxSessionHours);
      activeSession = enriched.session;
      warnings = enriched.warnings;
    }

    const files = await this.buildFiles(logRoot, today.date);

    return buildEnvelope({
      action: 'status',
      workspaceKey: ctx.workspaceKey,
      timezone: this.config.timezone,
      activeSession,
      session: null,
      today,
      files,
      warnings,
    });
  }

  async export(_ctx: RequestContext, input: ExportInput): Promise<ExportEnvelope> {
    const { root: logRoot } = await getLogRoot(this.config);
    const events = await readAllEvents(logRoot);
    const completed = rebuildCompletedSessions(events);
    const range = resolvePeriodRange(input, this.config.timezone);
    const filtered = filterSessionsInRange(completed, range.fromEpochMs, range.toEpochMs);
    const periodLabel = range.from === range.to ? range.from : `${range.from}..${range.to}`;

    const result: ExportResult = buildExport({
      format: input.format as ExportFormat,
      sessions: filtered,
      events,
      timezone: this.config.timezone,
      periodLabel,
      groupBy: input.groupBy,
    });

    let filePath: string | null = null;
    let fileResourceUri: string | null = null;
    const warnings: WorkClockWarning[] = [];

    if (input.writeToFile) {
      const relative = exportFileRelativePath(result.format, periodLabel);
      const target = await resolveSafeFilePath(logRoot, relative);
      await atomicWriteFile(target, result.content);
      fileResourceUri = `worklog://export/${result.format}/${periodLabel}`;
      filePath = this.config.exposeLocalPaths ? target : null;
      if (!this.config.exposeLocalPaths) {
        warnings.push({
          code: 'LOCAL_PATH_HIDDEN',
          message: 'Export written under exports/. Set WORKCLOCK_EXPOSE_LOCAL_PATHS=true to reveal the absolute path.',
        });
      }
    }

    return {
      ok: true,
      action: 'exported',
      format: result.format,
      period: periodLabel,
      mimeType: result.mimeType,
      content: result.content,
      byline: result.byline,
      sessionCount: filtered.length,
      filePath,
      fileResourceUri,
      warnings,
    };
  }

  async summary(ctx: RequestContext, input: SummaryInput) {
    const { root: logRoot } = await getLogRoot(this.config);
    const events = await readAllEvents(logRoot);
    const completed = rebuildCompletedSessions(events);
    const range = resolvePeriodRange(input, this.config.timezone);
    const filtered = filterSessionsInRange(completed, range.fromEpochMs, range.toEpochMs);
    const metrics = computeFocusMetrics(filtered, events);
    const groups = groupSessions(filtered, input.groupBy, this.config.timezone);
    const today = buildTodaySummary(filtered, events, this.config.timezone, range.to);
    today.byTask = groups;

    let markdown: string | undefined;
    if (input.includeMarkdown) {
      markdown = renderDailyMarkdown({
        date: range.to,
        timezone: this.config.timezone,
        activeSession: await loadCheckpoint(logRoot, ctx.userKey, ctx.workspaceKey),
        completedSessions: filtered,
        events,
        nowEpochMs: Date.now(),
      });
    }

    const promptPack = input.includePromptPack
      ? buildPromptPack(filtered, metrics, input.groupBy, this.config.timezone, `${range.from}..${range.to}`)
      : undefined;

    const files = await this.buildFiles(logRoot, range.to);

    return buildEnvelope({
      action: 'summary',
      workspaceKey: ctx.workspaceKey,
      timezone: this.config.timezone,
      activeSession: null,
      session: null,
      today,
      files,
      markdown,
      promptPack,
      warnings: [],
    });
  }

  async amend(ctx: RequestContext, input: AmendInput) {
    return this.withLock(ctx, async (root) => {
      const events = await readAllEvents(root);
      const completed = rebuildCompletedSessions(events);
      const active = await loadCheckpoint(root, ctx.userKey, ctx.workspaceKey);

      let target: CompletedSession | undefined;
      if (input.target === 'active') {
        if (!active) throw new WorkClockError('NO_ACTIVE_SESSION', 'No active session found.');
        target = {
          id: active.id,
          userKey: active.userKey,
          workspaceKey: active.workspaceKey,
          taskName: active.taskName,
          project: active.project,
          ticket: active.ticket,
          tags: active.tags,
          mode: active.mode,
          startedAtIso: active.startedAtIso,
          endedAtIso: new Date().toISOString(),
          startedAtEpochMs: active.startedAtEpochMs,
          endedAtEpochMs: Date.now(),
          totalActiveMs: 0,
          pauseEvents: active.pauseEvents,
          note: active.note,
        };
      } else if (input.target === 'sessionId' && input.sessionId) {
        target = completed.find((session) => session.id === input.sessionId);
      } else {
        target = completed[completed.length - 1];
      }

      if (!target) throw new WorkClockError('SESSION_NOT_FOUND', 'Target session not found.');

      const now = Date.now();
      await appendWorkEvent(root, {
        schemaVersion: 1,
        userKey: ctx.userKey,
        workspaceKey: ctx.workspaceKey,
        sessionId: target.id,
        type: 'amended',
        atIso: new Date(now).toISOString(),
        atEpochMs: now,
        taskName: input.changes.taskName ?? target.taskName,
        project: input.changes.project ?? target.project,
        ticket: input.changes.ticket ?? target.ticket,
        tags: input.changes.tags ?? target.tags,
        note: input.changes.note ?? target.note,
        reason: input.reason,
        changes: input.changes,
        requestId: ctx.requestId,
      });

      const refreshedEvents = await readAllEvents(root);
      const refreshedCompleted = rebuildCompletedSessions(refreshedEvents);
      const amended = refreshedCompleted.find((session) => session.id === target!.id) ?? target;
      const files = await this.renderDay(root, amended.startedAtEpochMs, now, ctx, active, amended);
      const today = buildTodaySummary(refreshedCompleted, refreshedEvents, this.config.timezone);

      return buildEnvelope({
        action: 'amended',
        workspaceKey: ctx.workspaceKey,
        timezone: this.config.timezone,
        activeSession: active,
        session: amended,
        today,
        files,
        warnings: [],
      });
    });
  }

  private async withLock<T>(
    _ctx: RequestContext,
    fn: (root: string) => Promise<T>,
  ): Promise<T> {
    const { root } = await getLogRoot(this.config);
    const lockPath = await resolveSafeFilePath(root, eventsJsonlRelativePath());
    return withFileLock(lockPath, () => fn(root));
  }

  private async renderDay(
    root: string,
    startedAtEpochMs: number,
    nowEpochMs: number,
    _ctx: RequestContext,
    activeSession: ActiveSession | null = null,
    _latestCompleted?: CompletedSession,
  ) {
    const events = await readAllEvents(root);
    const completed = rebuildCompletedSessions(events);
    const date = todayDateString(this.config.timezone, new Date(startedAtEpochMs));
    const markdown = renderDailyMarkdown({
      date,
      timezone: this.config.timezone,
      activeSession,
      completedSessions: completed,
      events,
      nowEpochMs,
    });

    const markdownPath = await resolveSafeFilePath(root, dailyMarkdownRelativePath(date));
    await atomicWriteFile(markdownPath, markdown);

    return this.buildFiles(root, date);
  }

  private async buildFiles(root: string, date: string) {
    const files = emptyFiles();
    files.logRoot = this.config.exposeLocalPaths ? root : null;
    files.dailyMarkdownResourceUri = toDailyResourceUri(date);
    if (this.config.exposeLocalPaths) {
      files.dailyMarkdownPath = await resolveSafeFilePath(root, dailyMarkdownRelativePath(date));
      files.eventsJsonlPath = await resolveSafeFilePath(root, eventsJsonlRelativePath());
    }
    return files;
  }
}
