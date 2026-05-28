import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dailyMarkdownRelativePath, eventsJsonlRelativePath } from '../src/storage/paths.js';
import { isAbsoluteInput, slugifyKey } from '../src/security/pathTraversal.js';

describe('storage paths', () => {
  it('builds safe relative paths', () => {
    expect(dailyMarkdownRelativePath('2026-05-28')).toContain('2026-05-28.md');
    expect(eventsJsonlRelativePath()).toBe(path.join('logs', 'events.jsonl'));
  });

  it('rejects absolute input', () => {
    expect(isAbsoluteInput('/etc/passwd')).toBe(true);
    expect(isAbsoluteInput('C:\\Windows\\System32')).toBe(true);
  });

  it('slugifies keys', () => {
    expect(slugifyKey('My Workspace')).toBe('my-workspace');
  });
});

describe('root policy integration', () => {
  it('creates log files under temp root', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workclock-root-'));
    process.env.WORKCLOCK_LOG_DIR = tmpDir;
    const { loadConfig } = await import('../src/config.js');
    const { getLogRoot, ensureLogRootStructure } = await import('../src/storage/rootPolicy.js');
    const config = loadConfig();
    const { root } = await getLogRoot(config);
    await ensureLogRootStructure(root);
    const eventsPath = path.join(root, eventsJsonlRelativePath());
    await fs.writeFile(eventsPath, '', 'utf8');
    await expect(fs.stat(eventsPath)).resolves.toBeDefined();
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.WORKCLOCK_LOG_DIR;
  });
});
