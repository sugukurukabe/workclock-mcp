import fs from 'node:fs/promises';
import type { AppConfig } from '../config.js';
import { WorkClockError } from '../mcp/errors.js';
import type { ResolvedLogRoot } from './paths.js';
import { resolveLogRoot } from './paths.js';

let cachedRoot: ResolvedLogRoot | null = null;
let cachedMcpRoots: string[] | undefined;

export function setMcpRoots(roots: string[] | undefined): void {
  cachedMcpRoots = roots;
  cachedRoot = null;
}

export async function getLogRoot(config: AppConfig): Promise<ResolvedLogRoot> {
  if (cachedRoot) return cachedRoot;
  try {
    cachedRoot = await resolveLogRoot(config, cachedMcpRoots);
    return cachedRoot;
  } catch (error) {
    if (error instanceof WorkClockError) throw error;
    if (error instanceof Error && error.message === 'PATH_TRAVERSAL_BLOCKED') {
      throw new WorkClockError('PATH_TRAVERSAL_BLOCKED', 'Path traversal blocked.');
    }
    throw new WorkClockError('ROOT_NOT_ALLOWED', 'Unable to resolve log root.', {
      details: { cause: error instanceof Error ? error.message : String(error) },
    });
  }
}

export async function ensureLogRootStructure(root: string): Promise<void> {
  await fs.mkdir(`${root}/logs/active`, { recursive: true });
  await fs.mkdir(`${root}/logs`, { recursive: true });
}

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(tempPath, content, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw new WorkClockError('LOG_WRITE_FAILED', 'Failed to write log file.', {
      details: { cause: error instanceof Error ? error.message : String(error) },
    });
  }
}

export async function appendJsonl(filePath: string, line: unknown): Promise<void> {
  const payload = `${JSON.stringify(line)}\n`;
  try {
    await fs.appendFile(filePath, payload, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    throw new WorkClockError('LOG_WRITE_FAILED', 'Failed to append event log.', {
      details: { cause: error instanceof Error ? error.message : String(error) },
    });
  }
}
