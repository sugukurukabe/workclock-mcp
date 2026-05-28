import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendWorkEvent, readAllEvents } from '../src/storage/eventStore.js';
import { withFileLock } from '../src/storage/fileLock.js';
import { eventsJsonlRelativePath, resolveSafeFilePath } from '../src/storage/paths.js';

describe('eventStore', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'workclock-events-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('appends and reads JSONL events', async () => {
    await appendWorkEvent(root, {
      schemaVersion: 1,
      userKey: 'u',
      workspaceKey: 'w',
      sessionId: 's1',
      type: 'started',
      atIso: new Date().toISOString(),
      atEpochMs: Date.now(),
      taskName: 'task',
    });

    const events = await readAllEvents(root);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('started');
  });

  it('uses file lock without corruption', async () => {
    const eventsPath = await resolveSafeFilePath(root, eventsJsonlRelativePath());
    await withFileLock(eventsPath, async () => {
      await appendWorkEvent(root, {
        schemaVersion: 1,
        userKey: 'u',
        workspaceKey: 'w',
        sessionId: 's1',
        type: 'started',
        atIso: new Date().toISOString(),
        atEpochMs: Date.now(),
      });
    });
    const events = await readAllEvents(root);
    expect(events).toHaveLength(1);
  });
});
