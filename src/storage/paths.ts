import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../config.js';
import { WorkClockError } from '../mcp/errors.js';
import {
  assertPathLength,
  assertWithinRoot,
  isAbsoluteInput,
  normalizeSeparators,
  rejectTraversalSegments,
  slugifyKey,
} from '../security/pathTraversal.js';

export interface ResolvedLogRoot {
  root: string;
  source: 'env' | 'mcp-root' | 'fallback';
}

export async function resolveLogRoot(
  config: AppConfig,
  mcpRoots?: string[],
): Promise<ResolvedLogRoot> {
  if (config.logDir) {
    if (isAbsoluteInput(config.logDir) === false && config.logDir.includes('..')) {
      throw new WorkClockError('PATH_TRAVERSAL_BLOCKED', 'Invalid WORKCLOCK_LOG_DIR path.');
    }
    const resolved = await ensureDirectory(path.resolve(config.logDir));
    return { root: resolved, source: 'env' };
  }

  if (mcpRoots && mcpRoots.length > 0) {
    const first = mcpRoots[0];
    if (!first) {
      throw new WorkClockError('ROOT_NOT_CONFIGURED', 'MCP root is empty.');
    }
    const rootUri = first.startsWith('file://') ? fileUriToPath(first) : first;
    const resolved = await ensureDirectory(path.join(rootUri, '.workclock'));
    return { root: resolved, source: 'mcp-root' };
  }

  if (config.mode === 'remote') {
    throw new WorkClockError(
      'ROOT_NOT_CONFIGURED',
      'Remote mode requires WORKCLOCK_LOG_DIR to be configured.',
    );
  }

  const fallback = await ensureDirectory(path.resolve(process.cwd(), '.workclock'));
  return { root: fallback, source: 'fallback' };
}

export function slugifyWorkspaceKey(workspaceKey: string): string {
  return slugifyKey(workspaceKey, 64);
}

export function slugifyUserKey(userKey: string): string {
  return slugifyKey(userKey, 64);
}

export function dailyMarkdownRelativePath(date: string): string {
  const [year, month] = date.split('-');
  rejectTraversalSegments([year, month, `${date}.md`]);
  return path.join('logs', year, month, `${date}.md`);
}

export function eventsJsonlRelativePath(): string {
  return path.join('logs', 'events.jsonl');
}

export function checkpointRelativePath(userKey: string, workspaceKey: string): string {
  const user = slugifyUserKey(userKey);
  const workspace = slugifyWorkspaceKey(workspaceKey);
  rejectTraversalSegments(['active', `${user}.${workspace}.json`]);
  return path.join('active', `${user}.${workspace}.json`);
}

export async function resolveSafeFilePath(root: string, relativePath: string): Promise<string> {
  if (isAbsoluteInput(relativePath)) {
    throw new WorkClockError('PATH_TRAVERSAL_BLOCKED', 'Absolute paths are not allowed.');
  }

  const normalized = normalizeSeparators(relativePath);
  const segments = normalized.split('/').filter(Boolean);
  rejectTraversalSegments(segments);

  const joined = path.join(root, ...segments);
  assertPathLength(joined);
  await fs.mkdir(path.dirname(joined), { recursive: true });

  const rootReal = await fs.realpath(root);
  const parentReal = await fs.realpath(path.dirname(joined));
  assertWithinRoot(rootReal, parentReal);

  return joined;
}

async function ensureDirectory(dirPath: string): Promise<string> {
  await fs.mkdir(dirPath, { recursive: true });
  const real = await fs.realpath(dirPath);
  return real;
}

function fileUriToPath(uri: string): string {
  const url = new URL(uri);
  let pathname = decodeURIComponent(url.pathname);
  if (/^\/[A-Za-z]:/.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

export function toDailyResourceUri(date: string): string {
  return `worklog://daily/${date}`;
}

export function toSummaryResourceUri(period: string): string {
  return `worklog://summary/${period}`;
}
