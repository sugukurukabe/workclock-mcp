import type {
  ActiveSession,
  CompletedSession,
  RequestContext,
  StopOutcome,
  WorkEvent,
} from './types.js';
import { newSessionId } from './ids.js';
import { createPomodoroConfig, evaluatePomodoro, nextPomodoroAfterResume } from './pomodoro.js';
import {
  clampDelta,
  computeActiveMs,
  detectClockSkew,
  isStaleSession,
} from './timerMath.js';
import { normalizeTags, limitString } from '../storage/markdownSanitize.js';
import { extractTicketFromTaskName } from './summary.js';

export interface StartSessionInput {
  taskName: string;
  project?: string;
  ticket?: string;
  tags?: string[];
  note?: string;
  mode?: 'timer' | 'pomodoro';
  pomodoro?: {
    workMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    targetCycles?: number;
  };
}

export function buildActiveSession(
  ctx: RequestContext,
  input: StartSessionInput,
  nowEpochMs: number,
  defaults: {
    defaultWorkMinutes: number;
    defaultShortBreakMinutes: number;
    defaultLongBreakMinutes: number;
    defaultMode: 'timer' | 'pomodoro';
    projectName?: string;
  },
): ActiveSession {
  const startedAtIso = new Date(nowEpochMs).toISOString();
  const ticket = input.ticket ?? extractTicketFromTaskName(input.taskName);
  const project = input.project ?? defaults.projectName;
  const mode = input.mode ?? defaults.defaultMode;

  const session: ActiveSession = {
    id: newSessionId(),
    userKey: ctx.userKey,
    workspaceKey: ctx.workspaceKey,
    taskName: limitString(input.taskName, 120),
    project: project ? limitString(project, 80) : undefined,
    ticket: ticket ? limitString(ticket, 60) : undefined,
    tags: normalizeTags(input.tags ?? []),
    mode,
    startedAtIso,
    startedAtEpochMs: nowEpochMs,
    lastResumedAtEpochMs: nowEpochMs,
    accumulatedActiveMs: 0,
    pauseEvents: [],
    note: input.note ? limitString(input.note, 500) : undefined,
    source: ctx.source,
    createdByToolCallId: ctx.toolCallId,
  };

  if (mode === 'pomodoro') {
    session.pomodoro = createPomodoroConfig({
      workMinutes: input.pomodoro?.workMinutes ?? defaults.defaultWorkMinutes,
      shortBreakMinutes: input.pomodoro?.shortBreakMinutes ?? defaults.defaultShortBreakMinutes,
      longBreakMinutes: input.pomodoro?.longBreakMinutes ?? defaults.defaultLongBreakMinutes,
      targetCycles: input.pomodoro?.targetCycles ?? 4,
    });
  }

  return session;
}

export function pauseSession(
  session: ActiveSession,
  nowEpochMs: number,
  reason?: string,
  breakType?: 'short' | 'long' | 'interrupt' | 'manual',
): { session: ActiveSession; warnings: ReturnType<typeof detectClockSkew>[] } {
  if (session.pausedAtEpochMs !== undefined) {
    throw new Error('ALREADY_PAUSED');
  }

  const delta = nowEpochMs - session.lastResumedAtEpochMs;
  const warning = detectClockSkew(delta);
  const activeDelta = clampDelta(delta);

  const updated: ActiveSession = {
    ...session,
    accumulatedActiveMs: session.accumulatedActiveMs + activeDelta,
    pausedAtEpochMs: nowEpochMs,
    pauseEvents: [
      ...session.pauseEvents,
      {
        pausedAtEpochMs: nowEpochMs,
        reason,
        breakType,
      },
    ],
  };

  if (updated.pomodoro) {
    updated.pomodoro = { ...updated.pomodoro, state: 'break' };
  }

  return { session: updated, warnings: warning ? [warning] : [] };
}

export function resumeSession(
  session: ActiveSession,
  nowEpochMs: number,
): ActiveSession {
  if (session.pausedAtEpochMs === undefined) {
    throw new Error('NO_PAUSED_SESSION');
  }

  const pauseEvents = [...session.pauseEvents];
  const lastPause = pauseEvents[pauseEvents.length - 1];
  if (lastPause) {
    pauseEvents[pauseEvents.length - 1] = {
      ...lastPause,
      resumedAtEpochMs: nowEpochMs,
    };
  }

  const updated: ActiveSession = {
    ...session,
    pausedAtEpochMs: undefined,
    lastResumedAtEpochMs: nowEpochMs,
    pauseEvents,
  };

  if (updated.pomodoro) {
    updated.pomodoro = nextPomodoroAfterResume(updated.pomodoro);
  }

  return updated;
}

export function stopSession(
  session: ActiveSession,
  nowEpochMs: number,
  note?: string,
  outcome: StopOutcome = 'stopped',
  extraTags?: string[],
): CompletedSession {
  let totalActiveMs = session.accumulatedActiveMs;
  if (session.pausedAtEpochMs === undefined) {
    totalActiveMs += clampDelta(nowEpochMs - session.lastResumedAtEpochMs);
  }

  return {
    id: session.id,
    userKey: session.userKey,
    workspaceKey: session.workspaceKey,
    taskName: session.taskName,
    project: session.project,
    ticket: session.ticket,
    tags: normalizeTags([...session.tags, ...(extraTags ?? [])]),
    mode: session.mode,
    startedAtIso: session.startedAtIso,
    endedAtIso: new Date(nowEpochMs).toISOString(),
    startedAtEpochMs: session.startedAtEpochMs,
    endedAtEpochMs: nowEpochMs,
    totalActiveMs: Math.max(0, totalActiveMs),
    pauseEvents: session.pauseEvents,
    note: note ?? session.note,
    outcome,
  };
}

export function enrichActiveSession(
  session: ActiveSession,
  nowEpochMs: number,
  maxSessionHours: number,
): { session: ActiveSession; warnings: Array<{ code: string; message: string }> } {
  const warnings: Array<{ code: string; message: string }> = [];
  if (isStaleSession(session, nowEpochMs, maxSessionHours)) {
    warnings.push({
      code: 'STALE_SESSION',
      message: `Session has been active for more than ${maxSessionHours} hours.`,
    });
  }

  if (session.mode === 'pomodoro' && session.pomodoro) {
    const evaluated = evaluatePomodoro(session, nowEpochMs);
    warnings.push(...evaluated.warnings);
    return {
      session: { ...session, pomodoro: evaluated.pomodoro },
      warnings,
    };
  }

  return { session, warnings };
}

export function rebuildCompletedSessions(events: WorkEvent[]): CompletedSession[] {
  const sessions = new Map<string, Partial<CompletedSession> & { tags: string[]; pauseEvents: ActiveSession['pauseEvents'] }>();

  for (const event of events) {
    if (event.type === 'started') {
      sessions.set(event.sessionId, {
        id: event.sessionId,
        userKey: event.userKey,
        workspaceKey: event.workspaceKey,
        taskName: event.taskName ?? 'unknown',
        project: event.project,
        ticket: event.ticket,
        tags: event.tags ?? [],
        mode: 'timer',
        startedAtIso: event.atIso,
        startedAtEpochMs: event.atEpochMs,
        pauseEvents: [],
      });
    }

    const current = sessions.get(event.sessionId);
    if (!current) continue;

    if (event.type === 'paused') {
      current.pauseEvents = [
        ...(current.pauseEvents ?? []),
        { pausedAtEpochMs: event.atEpochMs, reason: event.reason },
      ];
    }

    if (event.type === 'resumed') {
      const pauseEvents = [...(current.pauseEvents ?? [])];
      const last = pauseEvents[pauseEvents.length - 1];
      if (last && last.resumedAtEpochMs === undefined) {
        pauseEvents[pauseEvents.length - 1] = {
          ...last,
          resumedAtEpochMs: event.atEpochMs,
        };
      }
      current.pauseEvents = pauseEvents;
    }

    if (event.type === 'amended' && event.changes) {
      if (typeof event.changes.taskName === 'string') current.taskName = event.changes.taskName;
      if (typeof event.changes.project === 'string') current.project = event.changes.project;
      if (typeof event.changes.ticket === 'string') current.ticket = event.changes.ticket;
      if (Array.isArray(event.changes.tags)) current.tags = event.changes.tags as string[];
      if (typeof event.changes.note === 'string') current.note = event.changes.note;
      if (typeof event.changes.startAtIso === 'string') {
        current.startedAtIso = event.changes.startAtIso;
        current.startedAtEpochMs = Date.parse(event.changes.startAtIso);
      }
      if (typeof event.changes.endAtIso === 'string') {
        current.endedAtIso = event.changes.endAtIso;
        current.endedAtEpochMs = Date.parse(event.changes.endAtIso);
      }
      if (typeof event.changes.durationMinutes === 'number') {
        current.totalActiveMs = event.changes.durationMinutes * 60_000;
      }
    }

    if (event.type === 'stopped') {
      current.endedAtIso = event.atIso;
      current.endedAtEpochMs = event.atEpochMs;
      current.totalActiveMs = event.totalActiveMs ?? current.totalActiveMs ?? 0;
      if (event.note) current.note = event.note;
    }
  }

  const completed: CompletedSession[] = [];
  for (const session of sessions.values()) {
    if (!session.endedAtIso || session.endedAtEpochMs === undefined) continue;
    completed.push({
      id: session.id!,
      userKey: session.userKey!,
      workspaceKey: session.workspaceKey!,
      taskName: session.taskName ?? 'unknown',
      project: session.project,
      ticket: session.ticket,
      tags: session.tags ?? [],
      mode: session.mode ?? 'timer',
      startedAtIso: session.startedAtIso!,
      endedAtIso: session.endedAtIso,
      startedAtEpochMs: session.startedAtEpochMs!,
      endedAtEpochMs: session.endedAtEpochMs,
      totalActiveMs: session.totalActiveMs ?? 0,
      pauseEvents: session.pauseEvents ?? [],
      note: session.note,
      outcome: session.outcome,
    });
  }

  return completed.sort((a, b) => a.startedAtEpochMs - b.startedAtEpochMs);
}

export function getActiveElapsedMs(session: ActiveSession, nowEpochMs: number): number {
  return computeActiveMs(session, nowEpochMs);
}
