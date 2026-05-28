import { nanoid } from 'nanoid';

export function newSessionId(): string {
  return `sess_${nanoid(12)}`;
}

export function newEventId(): string {
  return `evt_${nanoid(12)}`;
}

export function newRequestId(): string {
  return `req_${nanoid(10)}`;
}
