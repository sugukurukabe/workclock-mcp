import { PomodoroRing } from './PomodoroRing.js';
import type { ActiveSession, TodaySummary } from '../types.js';
import { formatDuration } from '../types.js';

interface TimerCardProps {
  activeSession: ActiveSession | null;
  today: TodaySummary;
  elapsedMs: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRefresh: () => void;
}

export function TimerCard({
  activeSession,
  today,
  elapsedMs,
  paused,
  onPause,
  onResume,
  onStop,
  onRefresh,
}: TimerCardProps) {
  const progress =
    activeSession?.pomodoro && activeSession.pomodoro.workMinutes > 0
      ? elapsedMs / (activeSession.pomodoro.workMinutes * 60_000)
      : 0;

  return (
    <section className="card" aria-label="Work timer">
      <header className="card-header">
        <h1>{activeSession?.taskName ?? 'No active task'}</h1>
        <p className="meta">
          {[activeSession?.project, activeSession?.ticket].filter(Boolean).join(' · ') || '—'}
        </p>
      </header>

      <div className="timer-row">
        <div className="elapsed" aria-live="polite">
          {formatDuration(elapsedMs)}
        </div>
        <div className="state">{paused ? 'Paused' : 'Running'}</div>
      </div>

      <div className="today">Today: {formatDuration(today.totalActiveMs)}</div>

      <div className="actions">
        <button type="button" aria-label="Pause timer" onClick={onPause} disabled={!activeSession || paused}>
          Pause
        </button>
        <button type="button" aria-label="Resume timer" onClick={onResume} disabled={!activeSession || !paused}>
          Resume
        </button>
        <button type="button" aria-label="Stop timer" onClick={onStop} disabled={!activeSession}>
          Stop
        </button>
        <button type="button" aria-label="Refresh status" onClick={onRefresh}>
          Sync
        </button>
      </div>

      {activeSession?.mode === 'pomodoro' && (
        <div className="pomodoro">
          <PomodoroRing progress={progress} paused={paused} />
        </div>
      )}
    </section>
  );
}
