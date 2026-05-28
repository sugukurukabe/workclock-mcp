import { z } from 'zod';

export const PomodoroInputSchema = z.object({
  workMinutes: z.number().int().min(5).max(120).default(25),
  shortBreakMinutes: z.number().int().min(1).max(60).default(5),
  longBreakMinutes: z.number().int().min(1).max(90).default(15),
  targetCycles: z.number().int().min(1).max(12).default(4),
});

export const StartInputSchema = z.object({
  taskName: z.string().min(1).max(120),
  project: z.string().max(80).optional(),
  ticket: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  note: z.string().max(500).optional(),
  mode: z.enum(['timer', 'pomodoro']).default('timer'),
  pomodoro: PomodoroInputSchema.optional(),
  autoStopPrevious: z.boolean().default(false),
});

export const PauseInputSchema = z.object({
  reason: z.string().max(200).optional(),
  breakType: z.enum(['short', 'long', 'interrupt', 'manual']).default('manual'),
});

export const ResumeInputSchema = z.object({});

export const StopInputSchema = z.object({
  note: z.string().max(500).optional(),
  outcome: z.enum(['completed', 'stopped', 'interrupted', 'abandoned']).default('stopped'),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
});

export const StatusInputSchema = z.object({
  includeTodaySummary: z.boolean().default(true),
});

export const SummaryInputSchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month', 'custom']).default('today'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['task', 'project', 'ticket', 'tag', 'day']).default('task'),
  includeMarkdown: z.boolean().default(true),
  includePromptPack: z.boolean().default(true),
});

export const AmendChangesSchema = z.object({
  taskName: z.string().min(1).max(120).optional(),
  project: z.string().max(80).optional(),
  ticket: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  startAtIso: z.string().datetime().optional(),
  endAtIso: z.string().datetime().optional(),
  durationMinutes: z.number().min(0).max(24 * 60).optional(),
  note: z.string().max(500).optional(),
});

export const AmendInputSchema = z.object({
  sessionId: z.string().optional(),
  target: z.enum(['last', 'active', 'sessionId']).default('last'),
  changes: AmendChangesSchema,
  reason: z.string().min(1).max(500),
});

export const ActiveSessionSchema = z.object({
  id: z.string(),
  userKey: z.string(),
  workspaceKey: z.string(),
  taskName: z.string(),
  project: z.string().optional(),
  ticket: z.string().optional(),
  tags: z.array(z.string()),
  mode: z.enum(['timer', 'pomodoro']),
  startedAtIso: z.string(),
  startedAtEpochMs: z.number(),
  lastResumedAtEpochMs: z.number(),
  pausedAtEpochMs: z.number().optional(),
  accumulatedActiveMs: z.number(),
  pauseEvents: z.array(z.unknown()),
  note: z.string().optional(),
  source: z.enum(['chat', 'ui', 'api']),
});

export const CompletedSessionSchema = z.object({
  id: z.string(),
  userKey: z.string(),
  workspaceKey: z.string(),
  taskName: z.string(),
  project: z.string().optional(),
  ticket: z.string().optional(),
  tags: z.array(z.string()),
  mode: z.enum(['timer', 'pomodoro']),
  startedAtIso: z.string(),
  endedAtIso: z.string(),
  startedAtEpochMs: z.number(),
  endedAtEpochMs: z.number(),
  totalActiveMs: z.number(),
  pauseEvents: z.array(z.unknown()),
  note: z.string().optional(),
  outcome: z.enum(['completed', 'stopped', 'interrupted', 'abandoned']).optional(),
});

export const TodaySummarySchema = z.object({
  date: z.string(),
  totalActiveMs: z.number(),
  byTask: z.array(
    z.object({
      key: z.string(),
      totalActiveMs: z.number(),
      sessionCount: z.number(),
    }),
  ),
  byProject: z.array(
    z.object({
      key: z.string(),
      totalActiveMs: z.number(),
      sessionCount: z.number(),
    }),
  ),
  sessionCount: z.number(),
  contextSwitchCount: z.number(),
  longestFocusBlockMs: z.number(),
});

export const WorkClockEnvelopeSchema = z.object({
  ok: z.boolean(),
  action: z.enum(['started', 'paused', 'resumed', 'stopped', 'status', 'summary', 'amended']),
  workspaceKey: z.string(),
  timezone: z.string(),
  activeSession: ActiveSessionSchema.nullable(),
  session: CompletedSessionSchema.nullable(),
  today: TodaySummarySchema,
  files: z.object({
    logRoot: z.string().nullable(),
    dailyMarkdownPath: z.string().nullable(),
    dailyMarkdownResourceUri: z.string().nullable(),
    eventsJsonlPath: z.string().nullable(),
  }),
  markdown: z.string().optional(),
  promptPack: z.string().optional(),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
    }),
  ),
});

export const ErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
  activeSession: ActiveSessionSchema.optional(),
});

export const ExportInputSchema = z.object({
  format: z.enum(['csv', 'json', 'standup', 'weekly', 'obsidian']).default('standup'),
  period: z.enum(['today', 'yesterday', 'week', 'month', 'custom']).default('today'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['task', 'project', 'ticket', 'tag', 'day']).default('task'),
  writeToFile: z
    .boolean()
    .default(false)
    .describe('If true, also write the export under the safe exports/ folder in the log root.'),
});

export const ExportEnvelopeSchema = z.object({
  ok: z.boolean(),
  action: z.literal('exported'),
  format: z.enum(['csv', 'json', 'standup', 'weekly', 'obsidian']),
  period: z.string(),
  mimeType: z.string(),
  content: z.string(),
  byline: z.string(),
  sessionCount: z.number(),
  filePath: z.string().nullable(),
  fileResourceUri: z.string().nullable(),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
    }),
  ),
});

export type StartInput = z.infer<typeof StartInputSchema>;
export type PauseInput = z.infer<typeof PauseInputSchema>;
export type ResumeInput = z.infer<typeof ResumeInputSchema>;
export type StopInput = z.infer<typeof StopInputSchema>;
export type StatusInput = z.infer<typeof StatusInputSchema>;
export type SummaryInput = z.infer<typeof SummaryInputSchema>;
export type AmendInput = z.infer<typeof AmendInputSchema>;
export type ExportInput = z.infer<typeof ExportInputSchema>;

export const TOOL_NAMES = [
  'timelog.start',
  'timelog.pause',
  'timelog.resume',
  'timelog.stop',
  'timelog.status',
  'timelog.summary',
  'timelog.amend',
  'timelog.export',
] as const;
