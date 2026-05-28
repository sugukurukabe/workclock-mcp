import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkClockError } from '../src/mcp/errors.js';
import { resolveSafeFilePath } from '../src/storage/paths.js';

describe('rootPolicy path traversal', () => {
  it('blocks traversal segments', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workclock-traversal-'));
    await expect(resolveSafeFilePath(root, '../secret.md')).rejects.toBeInstanceOf(WorkClockError);
    await fs.rm(root, { recursive: true, force: true });
  });
});
