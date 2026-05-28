import fs from 'node:fs/promises';
import type { ActiveSession, WorkEvent } from '../domain/types.js';
import { newEventId } from '../domain/ids.js';
import { appendJsonl } from './rootPolicy.js';
import {
  checkpointRelativePath,
  eventsJsonlRelativePath,
  resolveSafeFilePath,
} from './paths.js';

export async function appendWorkEvent(root: string, event: Omit<WorkEvent, 'eventId'>): Promise<WorkEvent> {
  const fullEvent: WorkEvent = {
    ...event,
    eventId: newEventId(),
  };
  const eventsPath = await resolveSafeFilePath(root, eventsJsonlRelativePath());
  await appendJsonl(eventsPath, fullEvent);
  return fullEvent;
}

export async function readAllEvents(root: string): Promise<WorkEvent[]> {
  const eventsPath = await resolveSafeFilePath(root, eventsJsonlRelativePath());
  try {
    const content = await fs.readFile(eventsPath, 'utf8');
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as WorkEvent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function saveCheckpoint(
  root: string,
  session: ActiveSession,
): Promise<void> {
  const checkpointPath = await resolveSafeFilePath(
    root,
    checkpointRelativePath(session.userKey, session.workspaceKey),
  );
  await fs.writeFile(checkpointPath, JSON.stringify(session, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export async function loadCheckpoint(
  root: string,
  userKey: string,
  workspaceKey: string,
): Promise<ActiveSession | null> {
  const checkpointPath = await resolveSafeFilePath(
    root,
    checkpointRelativePath(userKey, workspaceKey),
  );
  try {
    const content = await fs.readFile(checkpointPath, 'utf8');
    return JSON.parse(content) as ActiveSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function removeCheckpoint(
  root: string,
  userKey: string,
  workspaceKey: string,
): Promise<void> {
  const checkpointPath = await resolveSafeFilePath(
    root,
    checkpointRelativePath(userKey, workspaceKey),
  );
  await fs.rm(checkpointPath, { force: true });
}
