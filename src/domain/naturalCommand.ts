export type NaturalCommand =
  | { tool: 'timelog.start'; args: Record<string, unknown> }
  | { tool: 'timelog.pause'; args: Record<string, unknown> }
  | { tool: 'timelog.resume'; args: Record<string, unknown> }
  | { tool: 'timelog.stop'; args: Record<string, unknown> }
  | { tool: 'timelog.summary'; args: Record<string, unknown> }
  | { tool: 'timelog.status'; args: Record<string, unknown> };

export function parseNaturalCommand(input: string): NaturalCommand | null {
  const text = input.trim();

  if (/^(休憩|一旦停止|pause|昼休み|割り込み)/i.test(text)) {
    return { tool: 'timelog.pause', args: { reason: text, breakType: 'manual' } };
  }

  if (/^(再開|戻った|continue|resume)/i.test(text)) {
    return { tool: 'timelog.resume', args: {} };
  }

  if (/^(終了|完了|今日はここまで|stop timer|finish task)/i.test(text)) {
    const note = text.replace(/^(終了|完了|今日はここまで|stop timer|finish task)[。.]?\s*/i, '');
    return { tool: 'timelog.stop', args: note ? { note, outcome: 'completed' } : { outcome: 'stopped' } };
  }

  if (/今日の(稼働)?まとめ|today/i.test(text)) {
    return { tool: 'timelog.summary', args: { period: 'today' } };
  }

  if (/今週の作業時間|weekly/i.test(text)) {
    return { tool: 'timelog.summary', args: { period: 'week', groupBy: 'task' } };
  }

  const pomodoroStart = text.match(/^(.+?)を?(\d+)分だけ開始$/);
  if (pomodoroStart) {
    return {
      tool: 'timelog.start',
      args: {
        taskName: pomodoroStart[1]?.trim(),
        mode: 'pomodoro',
        pomodoro: { workMinutes: Number(pomodoroStart[2]) },
      },
    };
  }

  const genericStart = text.match(/^(.+?)(開始|を始める|start)$/i);
  if (genericStart) {
    return {
      tool: 'timelog.start',
      args: { taskName: genericStart[1]?.trim() },
    };
  }

  if (/status|今何してる|タイマー見せて|残り何分/i.test(text)) {
    return { tool: 'timelog.status', args: { includeTodaySummary: true } };
  }

  return null;
}
