import { formatInTimeZone } from 'date-fns-tz';
import type { ActiveSession, CompletedSession, WorkEvent } from '../domain/types.js';
import { computeActiveMs } from '../domain/timerMath.js';
import {
  escapeMarkdownInline,
  escapeMarkdownTableCell,
  formatTags,
  safeYamlString,
} from './markdownSanitize.js';

export interface RenderDailyMarkdownInput {
  date: string;
  timezone: string;
  activeSession: ActiveSession | null;
  completedSessions: CompletedSession[];
  events: WorkEvent[];
  nowEpochMs: number;
}

export function renderDailyMarkdown(input: RenderDailyMarkdownInput): string {
  const { date, timezone, activeSession, completedSessions, events, nowEpochMs } = input;
  const dayEvents = events.filter((event) =>
    formatInTimeZone(new Date(event.atEpochMs), timezone, 'yyyy-MM-dd') === date,
  );

  const lines: string[] = [];
  lines.push('---');
  lines.push(`date: ${safeYamlString(date)}`);
  lines.push(`timezone: ${safeYamlString(timezone)}`);
  lines.push('generatedBy: Sugukuru WorkClock MCP');
  lines.push('schemaVersion: 1');
  lines.push('---');
  lines.push('');
  lines.push(`# Work Log - ${date}`);
  lines.push('');

  if (activeSession) {
    const elapsed = computeActiveMs(activeSession, nowEpochMs);
    lines.push('## Active Session');
    lines.push(`- Task: ${escapeMarkdownInline(activeSession.taskName)}`);
    lines.push(
      `- Started: ${formatInTimeZone(new Date(activeSession.startedAtEpochMs), timezone, 'HH:mm')}`,
    );
    lines.push(`- Elapsed: ${formatDuration(elapsed)}`);
    lines.push(`- Mode: ${activeSession.mode}`);
    if (activeSession.pomodoro) {
      const workMs = activeSession.pomodoro.workMinutes * 60_000;
      const cycleMs = elapsed % workMs;
      lines.push(
        `- Pomodoro: work ${Math.floor(cycleMs / 60_000)}/${activeSession.pomodoro.workMinutes}`,
      );
    }
    lines.push('');
  }

  lines.push('## Sessions');
  lines.push('');
  lines.push(
    '| Start | End | Duration | Task | Project | Ticket | Tags | Notes |',
  );
  lines.push('|---|---:|---:|---|---|---|---|---|');

  for (const session of completedSessions) {
    const startDay = formatInTimeZone(new Date(session.startedAtEpochMs), timezone, 'yyyy-MM-dd');
    if (startDay !== date) continue;
    const note =
      formatInTimeZone(new Date(session.endedAtEpochMs), timezone, 'yyyy-MM-dd') !== date
        ? 'crossed midnight'
        : (session.note ?? '');
    lines.push(
      `| ${formatInTimeZone(new Date(session.startedAtEpochMs), timezone, 'HH:mm')} | ${formatInTimeZone(new Date(session.endedAtEpochMs), timezone, 'HH:mm')} | ${formatDuration(session.totalActiveMs)} | ${escapeMarkdownTableCell(session.taskName)} | ${escapeMarkdownTableCell(session.project ?? '')} | ${escapeMarkdownTableCell(session.ticket ?? '')} | ${escapeMarkdownTableCell(formatTags(session.tags))} | ${escapeMarkdownTableCell(note)} |`,
    );
  }

  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push('| Group | Duration |');
  lines.push('|---|---:|');
  const totals = aggregateByTask(completedSessions, date, timezone);
  for (const total of totals) {
    lines.push(`| ${escapeMarkdownTableCell(total.key)} | ${formatDuration(total.totalActiveMs)} |`);
  }

  lines.push('');
  lines.push('## Events');
  lines.push('');
  for (const event of dayEvents) {
    const time = formatInTimeZone(new Date(event.atEpochMs), timezone, 'HH:mm');
    const tags = event.tags ? ` ${formatTags(event.tags)}` : '';
    const note = event.note ? ` ${escapeMarkdownInline(event.note)}` : '';
    lines.push(
      `- ${time} ${event.type.toUpperCase()} ${escapeMarkdownInline(event.taskName ?? '')}${tags}${note}`,
    );
  }

  lines.push('');
  lines.push('## LLM Summary Pack');
  lines.push('');
  lines.push('今日の主な作業:');
  for (const total of totals.slice(0, 10)) {
    lines.push(`- ${total.key}: ${formatDuration(total.totalActiveMs)}`);
  }
  lines.push('');
  lines.push('見積もり改善メモ:');
  lines.push(`- interrupt count: ${countInterruptions(dayEvents)}`);
  lines.push(
    `- longest focus block: ${Math.floor(Math.max(...completedSessions.map((s) => s.totalActiveMs), 0) / 60_000)}m`,
  );
  lines.push(`- context switches: ${Math.max(completedSessions.length - 1, 0)}`);

  return `${lines.join('\n')}\n`;
}

function aggregateByTask(
  sessions: CompletedSession[],
  date: string,
  timezone: string,
): Array<{ key: string; totalActiveMs: number }> {
  const map = new Map<string, number>();
  for (const session of sessions) {
    const startDay = formatInTimeZone(new Date(session.startedAtEpochMs), timezone, 'yyyy-MM-dd');
    if (startDay !== date) continue;
    map.set(session.taskName, (map.get(session.taskName) ?? 0) + session.totalActiveMs);
  }
  return [...map.entries()]
    .map(([key, totalActiveMs]) => ({ key, totalActiveMs }))
    .sort((a, b) => b.totalActiveMs - a.totalActiveMs);
}

function countInterruptions(events: WorkEvent[]): number {
  return events.filter((event) => event.type === 'paused').length;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatDurationHuman(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
