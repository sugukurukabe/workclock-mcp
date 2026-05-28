import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { WorkClockError } from '../mcp/errors.js';

const LOCK_OPTIONS = {
  retries: {
    retries: 5,
    minTimeout: 50,
    maxTimeout: 500,
  },
  stale: 10000,
};

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  let release: (() => Promise<void>) | undefined;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '', { flag: 'a' });
    release = await lockfile.lock(filePath, LOCK_OPTIONS);
    return await fn();
  } catch (error) {
    if (error instanceof WorkClockError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ELOCKED') || message.includes('timeout')) {
      throw new WorkClockError('FILE_LOCK_TIMEOUT', 'Could not acquire file lock.');
    }
    throw error;
  } finally {
    if (release) {
      await release().catch(() => undefined);
    }
  }
}

export function lockKeyFor(userKey: string, workspaceKey: string): string {
  return `${userKey}::${workspaceKey}`;
}
