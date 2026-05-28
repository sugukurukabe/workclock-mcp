import type { ActiveSession, PomodoroConfig, WorkClockWarning } from './types.js';
import { computeActiveMs } from './timerMath.js';

export function createPomodoroConfig(
  input: Partial<PomodoroConfig> & { workMinutes: number; targetCycles: number },
): PomodoroConfig {
  return {
    workMinutes: input.workMinutes,
    shortBreakMinutes: input.shortBreakMinutes ?? 5,
    longBreakMinutes: input.longBreakMinutes ?? 15,
    cycle: input.cycle ?? 0,
    targetCycles: input.targetCycles,
    state: input.state ?? 'work',
  };
}

export function evaluatePomodoro(
  session: ActiveSession,
  nowEpochMs: number,
): { pomodoro: PomodoroConfig; warnings: WorkClockWarning[] } {
  if (!session.pomodoro) {
    return { pomodoro: createPomodoroConfig({ workMinutes: 25, targetCycles: 4 }), warnings: [] };
  }

  const warnings: WorkClockWarning[] = [];
  const pomodoro = { ...session.pomodoro };
  const activeMs = computeActiveMs(session, nowEpochMs);
  const workMs = pomodoro.workMinutes * 60_000;
  const cycleElapsed = activeMs % workMs;

  if (session.pausedAtEpochMs !== undefined) {
    pomodoro.state = 'break';
    return { pomodoro, warnings };
  }

  if (cycleElapsed >= workMs - 1000) {
    pomodoro.state = 'break_due';
    warnings.push({
      code: 'BREAK_DUE',
      message: 'Pomodoro work interval reached. Consider taking a break.',
    });
  } else {
    pomodoro.state = 'work';
  }

  return { pomodoro, warnings };
}

export function nextPomodoroAfterResume(pomodoro: PomodoroConfig): PomodoroConfig {
  const nextCycle = pomodoro.cycle + 1;
  const isLongBreak = nextCycle > 0 && nextCycle % pomodoro.targetCycles === 0;
  return {
    ...pomodoro,
    cycle: nextCycle,
    state: isLongBreak ? 'break' : 'work',
  };
}
