import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBranch } from '../src/domain/gitContext.js';
import { buildExport, exportFileRelativePath } from '../src/domain/export.js';
import type { CompletedSession } from '../src/domain/types.js';
import { loadConfig } from '../src/config.js';
import { WorkClockService } from '../src/services/workClockService.js';
import { buildRequestContext } from '../src/services/context.js';

describe('git context branch parsing', () => {
  it('extracts ticket and project from feature branch', () => {
    expect(parseBranch('feature/SG-123-auth-flow')).toEqual({
      ticket: 'SG-123',
      project: 'auth-flow',
    });
  });

  it('handles branches without a ticket', () => {
    expect(parseBranch('bugfix/login')).toEqual({
      ticket: undefined,
      project: 'login',
    });
  });

  it('handles lowercase ticket ids', () => {
    expect(parseBranch('feature/abc-99-thing').ticket).toBe('ABC-99');
  });
});

describe('export formatters', () => {
  const sessions: CompletedSession[] = [
    {
      id: 's1',
      userKey: 'u',
      workspaceKey: 'w',
      taskName: '設計レビュー',
      project: 'mcp-gateway',
      ticket: 'SG-123',
      tags: ['design'],
      mode: 'timer',
      startedAtIso: '2026-05-28T00:05:00.000Z',
      endedAtIso: '2026-05-28T01:07:00.000Z',
      startedAtEpochMs: Date.parse('2026-05-28T09:05:00+09:00'),
      endedAtEpochMs: Date.parse('2026-05-28T10:07:00+09:00'),
      totalActiveMs: 62 * 60_000,
      pauseEvents: [],
      outcome: 'completed',
    },
  ];

  it('produces CSV with a header row', () => {
    const result = buildExport({
      format: 'csv',
      sessions,
      events: [],
      timezone: 'Asia/Tokyo',
      periodLabel: '2026-05-28',
      groupBy: 'task',
    });
    expect(result.mimeType).toBe('text/csv');
    expect(result.content.split('\n')[0]).toContain('durationMinutes');
    expect(result.content).toContain('設計レビュー');
  });

  it('produces valid JSON', () => {
    const result = buildExport({
      format: 'json',
      sessions,
      events: [],
      timezone: 'Asia/Tokyo',
      periodLabel: '2026-05-28',
      groupBy: 'task',
    });
    const parsed = JSON.parse(result.content);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.metrics.totalActiveMs).toBe(62 * 60_000);
  });

  it('produces a Japanese standup report', () => {
    const result = buildExport({
      format: 'standup',
      sessions,
      events: [],
      timezone: 'Asia/Tokyo',
      periodLabel: '2026-05-28',
      groupBy: 'task',
    });
    expect(result.content).toContain('日報');
    expect(result.content).toContain('設計レビュー');
  });

  it('produces obsidian wikilinks', () => {
    const result = buildExport({
      format: 'obsidian',
      sessions,
      events: [],
      timezone: 'Asia/Tokyo',
      periodLabel: '2026-05-28',
      groupBy: 'task',
    });
    expect(result.content).toContain('[[設計レビュー]]');
  });

  it('builds safe export file paths', () => {
    expect(exportFileRelativePath('csv', '2026-05-28')).toBe(path.join('exports', 'csv-2026-05-28.csv'));
    expect(exportFileRelativePath('standup', '../evil')).not.toContain('..');
  });
});

describe('export tool writes safe file', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workclock-export-'));
    process.env.WORKCLOCK_LOG_DIR = tmpDir;
    process.env.WORKCLOCK_TIMEZONE = 'Asia/Tokyo';
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.WORKCLOCK_LOG_DIR;
  });

  it('exports today after a completed session', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T09:00:00+09:00'));
    const config = loadConfig();
    const service = new WorkClockService(config);
    const ctx = buildRequestContext(config);

    await service.start(ctx, { taskName: 'API実装', tags: [], mode: 'timer', autoStopPrevious: false });
    vi.setSystemTime(new Date('2026-05-28T10:00:00+09:00'));
    await service.stop(ctx, { outcome: 'completed' });

    const result = await service.export(ctx, {
      format: 'csv',
      period: 'today',
      groupBy: 'task',
      writeToFile: true,
    });

    expect(result.sessionCount).toBe(1);
    expect(result.content).toContain('API実装');
    const exportPath = path.join(tmpDir, 'exports', 'csv-2026-05-28.csv');
    await expect(fs.stat(exportPath)).resolves.toBeDefined();
  });
});
