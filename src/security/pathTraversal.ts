import path from 'node:path';
import { WorkClockError } from '../mcp/errors.js';

const MAX_PATH_LENGTH = 260;
const MAX_SEGMENT_LENGTH = 80;

export function normalizeSeparators(input: string): string {
  return input.replace(/\\/g, '/');
}

export function isAbsoluteInput(input: string): boolean {
  const normalized = normalizeSeparators(input.trim());
  return (
    path.isAbsolute(input) ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith('//')
  );
}

export function slugifyKey(input: string, maxLength = MAX_SEGMENT_LENGTH): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
  return slug || 'default';
}

export function assertWithinRoot(rootReal: string, targetReal: string): void {
  const root = normalizeSeparators(rootReal);
  const target = normalizeSeparators(targetReal);
  const rootWithSep = root.endsWith('/') ? root : `${root}/`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new WorkClockError('PATH_TRAVERSAL_BLOCKED', 'Path traversal blocked.');
  }
}

export function assertPathLength(targetPath: string): void {
  if (targetPath.length > MAX_PATH_LENGTH) {
    throw new WorkClockError('PATH_TRAVERSAL_BLOCKED', 'Path exceeds maximum length.');
  }
}

export function rejectTraversalSegments(segments: string[]): void {
  for (const segment of segments) {
    if (segment === '..' || segment === '.' || segment.includes('\0')) {
      throw new WorkClockError('PATH_TRAVERSAL_BLOCKED', 'Path traversal blocked.');
    }
  }
}
