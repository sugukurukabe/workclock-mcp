import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { parseNaturalCommand } from '../src/domain/naturalCommand.js';
import { computeActiveMs, detectClockSkew, isStaleSession, splitSessionByDay } from '../src/domain/timerMath.js';
import type { ActiveSession } from '../src/domain/types.js';
import {
  escapeMarkdownTableCell,
  normalizeTags,
  safeYamlString,
} from '../src/storage/markdownSanitize.js';
import { renderDailyMarkdown } from '../src/storage/markdownRenderer.js';
import { isAbsoluteInput, slugifyKey } from '../src/security/pathTraversal.js';
import { WorkClockService } from '../src/services/workClockService.js';
import { buildRequestContext } from '../src/services/context.js';

describe('timerMath', () => {
  it('excludes paused time', () => {
    const session: ActiveSession = {
      id: 's1',
      userKey: 'u',
      workspaceKey: 'w',
      taskName: 'task',
      tags: [],
      mode: 'timer',
      startedAtIso: new Date(0).toISOString(),
      startedAtEpochMs: 0,
      lastResumedAtEpochMs: 0,
      accumulatedActiveMs: 10_000,
      pausedAtEpochMs: 20_000,
      pauseEvents: [],
      source: 'chat',
    };
    expect(computeActiveMs(session, 50_000)).toBe(10_000);
  });

  it('detects clock skew', () => {
    expect(detectClockSkew(-1)?.code).toBe('CLOCK_SKEW_DETECTED');
  });

  it('flags stale sessions', () => {
    const session: ActiveSession = {
      id: 's1',
      userKey: 'u',
      workspaceKey: 'w',
      taskName: 'task',
      tags: [],
      mode: 'timer',
      startedAtIso: new Date(0).toISOString(),
      startedAtEpochMs: 0,
      lastResumedAtEpochMs: 0,
      accumulatedActiveMs: 0,
      pauseEvents: [],
      source: 'chat',
    };
    expect(isStaleSession(session, 13 * 3_600_000, 12)).toBe(true);
  });

  it('splits cross-midnight sessions', () => {
    const splits = splitSessionByDay(
      {
        startedAtEpochMs: Date.parse('2026-05-28T23:00:00+09:00'),
        endedAtEpochMs: Date.parse('2026-05-29T01:00:00+09:00'),
        totalActiveMs: 7_200_000,
      },
      'Asia/Tokyo',
    );
    expect(splits.length).toBe(2);
  });
});

describe('markdown sanitize/renderer', () => {
  it('escapes table breaking characters', () => {
    expect(escapeMarkdownTableCell('a|b\nc')).toContain('\\|');
    expect(escapeMarkdownTableCell('a|b\nc')).toContain('<br>');
  });

  it('renders daily markdown', () => {
    const md = renderDailyMarkdown({
      date: '2026-05-28',
      timezone: 'Asia/Tokyo',
      activeSession: null,
      completedSessions: [],
      events: [],
      nowEpochMs: Date.now(),
    });
    expect(md).toContain('# Work Log - 2026-05-28');
    expect(safeYamlString('Asia/Tokyo')).toBe('"Asia/Tokyo"');
  });
});

describe('path security', () => {
  it('rejects absolute user input', () => {
    expect(isAbsoluteInput('../secret.md')).toBe(false);
    expect(isAbsoluteInput('/etc/passwd')).toBe(true);
    expect(isAbsoluteInput('C:\\Windows\\System32')).toBe(true);
  });

  it('slugifies workspace keys', () => {
    expect(slugifyKey('My Project!')).toBe('my-project');
    expect(normalizeTags(['#Design', 'design'])).toEqual(['design']);
  });
});

describe('natural commands', () => {
  it('maps Japanese commands', () => {
    expect(parseNaturalCommand('休憩')?.tool).toBe('timelog.pause');
    expect(parseNaturalCommand('再開')?.tool).toBe('timelog.resume');
    expect(parseNaturalCommand('設計レビュー開始')?.tool).toBe('timelog.start');
    expect(parseNaturalCommand('今日の稼働まとめ')?.tool).toBe('timelog.summary');
  });
});

describe('tool lifecycle', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workclock-'));
    process.env.WORKCLOCK_LOG_DIR = tmpDir;
    process.env.WORKCLOCK_TIMEZONE = 'Asia/Tokyo';
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.WORKCLOCK_LOG_DIR;
  });

  it('start/pause/resume/stop lifecycle', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T09:00:00+09:00'));

    const config = loadConfig();
    const service = new WorkClockService(config);
    const ctx = buildRequestContext(config);

    const started = await service.start(ctx, { taskName: '設計レビュー', tags: [], mode: 'timer', autoStopPrevious: false });
    expect(started.activeSession?.taskName).toBe('設計レビュー');

    vi.setSystemTime(new Date('2026-05-28T09:30:00+09:00'));
    const paused = await service.pause(ctx, { breakType: 'manual' });
    expect(paused.activeSession?.pausedAtEpochMs).toBeDefined();

    vi.setSystemTime(new Date('2026-05-28T09:36:00+09:00'));
    const resumed = await service.resume(ctx);
    expect(resumed.activeSession?.pausedAtEpochMs).toBeUndefined();

    vi.setSystemTime(new Date('2026-05-28T10:12:00+09:00'));
    const stopped = await service.stop(ctx, { outcome: 'stopped' });
    expect(stopped.session?.totalActiveMs).toBe(66 * 60_000);
  });

  it('returns ACTIVE_SESSION_EXISTS', async () => {
    const config = loadConfig();
    const service = new WorkClockService(config);
    const ctx = buildRequestContext(config);

    await service.start(ctx, { taskName: 'A', tags: [], mode: 'timer', autoStopPrevious: false });
    await expect(
      service.start(ctx, { taskName: 'B', tags: [], mode: 'timer', autoStopPrevious: false }),
    ).rejects.toMatchObject({ code: 'ACTIVE_SESSION_EXISTS' });
  });
});
