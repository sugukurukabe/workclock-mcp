export type WorkMode = 'timer' | 'pomodoro';

export type PomodoroState = 'work' | 'break_due' | 'break';

export type WorkEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'amended'
  | 'voided';

export type SessionSource = 'chat' | 'ui' | 'api';

export type StopOutcome = 'completed' | 'stopped' | 'interrupted' | 'abandoned';

export type BreakType = 'short' | 'long' | 'interrupt' | 'manual';

export interface PauseEvent {
  pausedAtEpochMs: number;
  resumedAtEpochMs?: number;
  reason?: string;
  breakType?: BreakType;
}

export interface PomodoroConfig {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cycle: number;
  targetCycles: number;
  state: PomodoroState;
}

export interface ActiveSession {
  id: string;
  userKey: string;
  workspaceKey: string;
  taskName: string;
  project?: string;
  ticket?: string;
  tags: string[];
  mode: WorkMode;
  pomodoro?: PomodoroConfig;
  startedAtIso: string;
  startedAtEpochMs: number;
  lastResumedAtEpochMs: number;
  pausedAtEpochMs?: number;
  accumulatedActiveMs: number;
  pauseEvents: PauseEvent[];
  note?: string;
  source: SessionSource;
  createdByToolCallId?: string;
}

export interface CompletedSession {
  id: string;
  userKey: string;
  workspaceKey: string;
  taskName: string;
  project?: string;
  ticket?: string;
  tags: string[];
  mode: WorkMode;
  startedAtIso: string;
  endedAtIso: string;
  startedAtEpochMs: number;
  endedAtEpochMs: number;
  totalActiveMs: number;
  pauseEvents: PauseEvent[];
  note?: string;
  outcome?: StopOutcome;
}

export interface WorkEvent {
  eventId: string;
  schemaVersion: 1;
  userKey: string;
  workspaceKey: string;
  sessionId: string;
  type: WorkEventType;
  atIso: string;
  atEpochMs: number;
  taskName?: string;
  project?: string;
  ticket?: string;
  tags?: string[];
  activeMsDelta?: number;
  totalActiveMs?: number;
  note?: string;
  reason?: string;
  requestId?: string;
  changes?: Record<string, unknown>;
}

export interface GroupTotal {
  key: string;
  totalActiveMs: number;
  sessionCount: number;
}

export interface TodaySummary {
  date: string;
  totalActiveMs: number;
  byTask: GroupTotal[];
  byProject: GroupTotal[];
  sessionCount: number;
  contextSwitchCount: number;
  longestFocusBlockMs: number;
}

export interface FocusMetrics {
  totalActiveMs: number;
  sessionCount: number;
  contextSwitchCount: number;
  interruptionCount: number;
  longestFocusBlockMs: number;
  averageSessionMs: number;
  pomodoroCyclesCompleted: number;
  focusRatio?: number;
}

export type ToolAction =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'status'
  | 'summary'
  | 'amended';

export interface WorkClockFiles {
  logRoot: string | null;
  dailyMarkdownPath: string | null;
  dailyMarkdownResourceUri: string | null;
  eventsJsonlPath: string | null;
}

export interface WorkClockWarning {
  code: string;
  message: string;
}

export interface WorkClockEnvelope {
  ok: boolean;
  action: ToolAction;
  workspaceKey: string;
  timezone: string;
  activeSession: ActiveSession | null;
  session: CompletedSession | null;
  today: TodaySummary;
  files: WorkClockFiles;
  markdown?: string;
  promptPack?: string;
  warnings: WorkClockWarning[];
}

export interface RequestContext {
  userKey: string;
  workspaceKey: string;
  requestId?: string;
  source: SessionSource;
  toolCallId?: string;
}
