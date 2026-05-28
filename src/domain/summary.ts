import { addDays, endOfDay, startOfDay, subDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type {
  CompletedSession,
  FocusMetrics,
  GroupTotal,
  TodaySummary,
  WorkEvent,
} from './types.js';
import { splitSessionByDay, todayDateString } from './timerMath.js';
import { formatDurationHuman } from '../storage/markdownRenderer.js';

const TICKET_PATTERN = /\b([A-Z]{2,10}-\d+|#\d+)\b/;

export function extractTicketFromTaskName(taskName: string): string | undefined {
  const match = taskName.match(TICKET_PATTERN);
  return match?.[1];
}

export interface SummaryPeriod {
  period: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  from?: string;
  to?: string;
}

export function resolvePeriodRange(
  period: SummaryPeriod,
  timezone: string,
  now = new Date(),
): { from: string; to: string; fromEpochMs: number; toEpochMs: number } {
  const zonedNow = toZonedTime(now, timezone);

  if (period.period === 'custom' && period.from && period.to) {
    const fromEpochMs = fromZonedTime(`${period.from}T00:00:00`, timezone).getTime();
    const toEpochMs = fromZonedTime(`${period.to}T23:59:59.999`, timezone).getTime();
    return { from: period.from, to: period.to, fromEpochMs, toEpochMs };
  }

  if (period.period === 'yesterday') {
    const yesterday = subDays(zonedNow, 1);
    const date = formatYmd(yesterday);
    const fromEpochMs = fromZonedTime(`${date}T00:00:00`, timezone).getTime();
    const toEpochMs = fromZonedTime(`${date}T23:59:59.999`, timezone).getTime();
    return { from: date, to: date, fromEpochMs, toEpochMs };
  }

  if (period.period === 'week') {
    const start = startOfDay(subDays(zonedNow, 6));
    const end = endOfDay(zonedNow);
    const from = formatYmd(start);
    const to = formatYmd(end);
    return {
      from,
      to,
      fromEpochMs: fromZonedTime(`${from}T00:00:00`, timezone).getTime(),
      toEpochMs: fromZonedTime(`${to}T23:59:59.999`, timezone).getTime(),
    };
  }

  if (period.period === 'month') {
    const start = startOfDay(subDays(zonedNow, 29));
    const end = endOfDay(zonedNow);
    const from = formatYmd(start);
    const to = formatYmd(end);
    return {
      from,
      to,
      fromEpochMs: fromZonedTime(`${from}T00:00:00`, timezone).getTime(),
      toEpochMs: fromZonedTime(`${to}T23:59:59.999`, timezone).getTime(),
    };
  }

  const today = todayDateString(timezone, now);
  return {
    from: today,
    to: today,
    fromEpochMs: fromZonedTime(`${today}T00:00:00`, timezone).getTime(),
    toEpochMs: fromZonedTime(`${today}T23:59:59.999`, timezone).getTime(),
  };
}

export function filterSessionsInRange(
  sessions: CompletedSession[],
  fromEpochMs: number,
  toEpochMs: number,
): CompletedSession[] {
  return sessions.filter(
    (session) =>
      session.endedAtEpochMs >= fromEpochMs && session.startedAtEpochMs <= toEpochMs,
  );
}

export function groupSessions(
  sessions: CompletedSession[],
  groupBy: 'task' | 'project' | 'ticket' | 'tag' | 'day',
  timezone: string,
): GroupTotal[] {
  const map = new Map<string, { totalActiveMs: number; sessionCount: number }>();

  for (const session of sessions) {
    if (groupBy === 'day') {
      const splits = splitSessionByDay(session, timezone);
      for (const split of splits) {
        addToMap(map, split.date, split.activeMs);
      }
      continue;
    }

    const keys = getGroupKeys(session, groupBy);
    for (const key of keys) {
      addToMap(map, key, session.totalActiveMs);
    }
  }

  return [...map.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.totalActiveMs - a.totalActiveMs);
}

function getGroupKeys(
  session: CompletedSession,
  groupBy: 'task' | 'project' | 'ticket' | 'tag' | 'day',
): string[] {
  switch (groupBy) {
    case 'task':
      return [session.taskName];
    case 'project':
      return [session.project ?? '(none)'];
    case 'ticket':
      return [session.ticket ?? extractTicketFromTaskName(session.taskName) ?? '(none)'];
    case 'tag':
      return session.tags.length > 0 ? session.tags : ['(none)'];
    case 'day':
      return ['day'];
  }
}

function addToMap(
  map: Map<string, { totalActiveMs: number; sessionCount: number }>,
  key: string,
  activeMs: number,
): void {
  const current = map.get(key) ?? { totalActiveMs: 0, sessionCount: 0 };
  map.set(key, {
    totalActiveMs: current.totalActiveMs + activeMs,
    sessionCount: current.sessionCount + 1,
  });
}

export function computeFocusMetrics(
  sessions: CompletedSession[],
  events: WorkEvent[],
): FocusMetrics {
  const totalActiveMs = sessions.reduce((sum, session) => sum + session.totalActiveMs, 0);
  const sessionCount = sessions.length;
  const longestFocusBlockMs = sessions.reduce(
    (max, session) => Math.max(max, session.totalActiveMs),
    0,
  );
  const interruptionCount = events.filter((event) => event.type === 'paused').length;
  const contextSwitchCount = Math.max(sessionCount - 1, 0);
  const averageSessionMs = sessionCount > 0 ? Math.floor(totalActiveMs / sessionCount) : 0;

  const wallStart = sessions[0]?.startedAtEpochMs;
  const wallEnd = sessions[sessions.length - 1]?.endedAtEpochMs;
  const focusRatio =
    wallStart !== undefined && wallEnd !== undefined && wallEnd > wallStart
      ? totalActiveMs / (wallEnd - wallStart)
      : undefined;

  return {
    totalActiveMs,
    sessionCount,
    contextSwitchCount,
    interruptionCount,
    longestFocusBlockMs,
    averageSessionMs,
    pomodoroCyclesCompleted: 0,
    focusRatio,
  };
}

export function buildTodaySummary(
  sessions: CompletedSession[],
  events: WorkEvent[],
  timezone: string,
  date?: string,
): TodaySummary {
  const targetDate = date ?? todayDateString(timezone);
  const daySessions = sessions.filter(
    (session) =>
      splitSessionByDay(session, timezone).some((split) => split.date === targetDate),
  );
  const metrics = computeFocusMetrics(daySessions, events);
  return {
    date: targetDate,
    totalActiveMs: metrics.totalActiveMs,
    byTask: groupSessions(daySessions, 'task', timezone),
    byProject: groupSessions(daySessions, 'project', timezone),
    sessionCount: metrics.sessionCount,
    contextSwitchCount: metrics.contextSwitchCount,
    longestFocusBlockMs: metrics.longestFocusBlockMs,
  };
}

export function buildPromptPack(
  sessions: CompletedSession[],
  metrics: FocusMetrics,
  groupBy: 'task' | 'project' | 'ticket' | 'tag' | 'day',
  timezone: string,
  periodLabel: string,
): string {
  const groups = groupSessions(sessions, groupBy, timezone);
  const lines = [
    `Period: ${periodLabel}`,
    `Total active time: ${formatDurationHuman(metrics.totalActiveMs)}`,
    `Sessions: ${metrics.sessionCount}`,
    `Context switches: ${metrics.contextSwitchCount}`,
    `Longest focus block: ${formatDurationHuman(metrics.longestFocusBlockMs)}`,
    '',
    'Breakdown:',
  ];

  for (const group of groups.slice(0, 20)) {
    lines.push(`- ${group.key}: ${formatDurationHuman(group.totalActiveMs)} (${group.sessionCount} sessions)`);
  }

  lines.push('');
  lines.push('Estimate confidence hint: compare repeated task names over time for better estimates.');

  return lines.join('\n');
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDate(date: string, days: number): string {
  return formatYmd(addDays(new Date(`${date}T00:00:00`), days));
}
