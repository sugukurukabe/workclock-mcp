import type { ActiveSession, WorkClockWarning } from '../domain/types.js';

export function computeActiveMs(session: ActiveSession, nowEpochMs: number): number {
  let activeMs = session.accumulatedActiveMs;
  if (session.pausedAtEpochMs === undefined) {
    const delta = nowEpochMs - session.lastResumedAtEpochMs;
    activeMs += clampDelta(delta);
  }
  return Math.max(0, activeMs);
}

export function clampDelta(deltaMs: number): number {
  if (deltaMs < 0) return 0;
  return deltaMs;
}

export function detectClockSkew(deltaMs: number): WorkClockWarning | null {
  if (deltaMs < 0) {
    return {
      code: 'CLOCK_SKEW_DETECTED',
      message: 'System clock moved backwards; duration clamped to zero for this interval.',
    };
  }
  return null;
}

export function isStaleSession(
  session: ActiveSession,
  nowEpochMs: number,
  maxSessionHours: number,
): boolean {
  const elapsedWallMs = nowEpochMs - session.startedAtEpochMs;
  return elapsedWallMs > maxSessionHours * 3_600_000;
}

export function splitSessionByDay(
  session: { startedAtEpochMs: number; endedAtEpochMs: number; totalActiveMs: number },
  timezone: string,
): Array<{ date: string; activeMs: number }> {
  const startDate = formatDate(session.startedAtEpochMs, timezone);
  const endDate = formatDate(session.endedAtEpochMs, timezone);
  if (startDate === endDate) {
    return [{ date: startDate, activeMs: session.totalActiveMs }];
  }

  const wallMs = session.endedAtEpochMs - session.startedAtEpochMs;
  if (wallMs <= 0) {
    return [{ date: startDate, activeMs: session.totalActiveMs }];
  }

  const firstMs = Math.floor(session.totalActiveMs * 0.5);
  const secondMs = session.totalActiveMs - firstMs;
  return [
    { date: startDate, activeMs: firstMs },
    { date: endDate, activeMs: secondMs },
  ];
}

function formatDate(epochMs: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(epochMs));
}

export function formatClockTime(epochMs: number, timezone: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(epochMs));
}

export function todayDateString(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
