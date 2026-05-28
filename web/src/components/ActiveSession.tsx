import type { ActiveSession } from '../types.js';
import { formatDuration, computeElapsedMs } from '../types.js';

interface ActiveSessionProps {
  session: ActiveSession;
  now: number;
}

export function ActiveSessionView({ session, now }: ActiveSessionProps) {
  const elapsed = computeElapsedMs(session, now);
  return (
    <div className="active-session">
      <strong>{session.taskName}</strong>
      <span>{formatDuration(elapsed)}</span>
    </div>
  );
}
