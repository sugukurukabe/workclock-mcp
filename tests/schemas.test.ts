import { describe, expect, it } from 'vitest';
import { TOOL_NAMES, WorkClockEnvelopeSchema } from '../src/mcp/schemas.js';

describe('schemas', () => {
  it('lists the expected tools', () => {
    expect(TOOL_NAMES).toEqual([
      'timelog.start',
      'timelog.pause',
      'timelog.resume',
      'timelog.stop',
      'timelog.status',
      'timelog.summary',
      'timelog.amend',
      'timelog.export',
    ]);
  });

  it('validates envelope shape', () => {
    const parsed = WorkClockEnvelopeSchema.safeParse({
      ok: true,
      action: 'status',
      workspaceKey: 'default',
      timezone: 'Asia/Tokyo',
      activeSession: null,
      session: null,
      today: {
        date: '2026-05-28',
        totalActiveMs: 0,
        byTask: [],
        byProject: [],
        sessionCount: 0,
        contextSwitchCount: 0,
        longestFocusBlockMs: 0,
      },
      files: {
        logRoot: null,
        dailyMarkdownPath: null,
        dailyMarkdownResourceUri: 'worklog://daily/2026-05-28',
        eventsJsonlPath: null,
      },
      warnings: [],
    });
    expect(parsed.success).toBe(true);
  });
});
