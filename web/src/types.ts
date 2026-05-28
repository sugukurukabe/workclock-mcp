export interface ActiveSession {
  id: string;
  taskName: string;
  project?: string;
  ticket?: string;
  mode: 'timer' | 'pomodoro';
  startedAtEpochMs: number;
  lastResumedAtEpochMs: number;
  pausedAtEpochMs?: number;
  accumulatedActiveMs: number;
  pomodoro?: {
    workMinutes: number;
    state: 'work' | 'break_due' | 'break';
  };
}

export interface TodaySummary {
  date: string;
  totalActiveMs: number;
  byTask: Array<{ key: string; totalActiveMs: number; sessionCount: number }>;
  sessionCount: number;
}

export interface WorkClockEnvelope {
  ok: boolean;
  action: string;
  activeSession: ActiveSession | null;
  today: TodaySummary;
  markdown?: string;
  promptPack?: string;
  warnings: Array<{ code: string; message: string }>;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function computeElapsedMs(session: ActiveSession, now: number): number {
  let activeMs = session.accumulatedActiveMs;
  if (session.pausedAtEpochMs === undefined) {
    activeMs += Math.max(0, now - session.lastResumedAtEpochMs);
  }
  return activeMs;
}
