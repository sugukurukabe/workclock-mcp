import { describe, expect, it } from 'vitest';
import { escapeMarkdownTableCell, safeYamlString } from '../src/storage/markdownSanitize.js';
import { renderDailyMarkdown } from '../src/storage/markdownRenderer.js';

describe('markdownRenderer', () => {
  it('escapes unsafe table content', () => {
    expect(escapeMarkdownTableCell('a|b\nc')).toContain('\\|');
    expect(escapeMarkdownTableCell('a|b\nc')).toContain('<br>');
  });

  it('renders sections', () => {
    const md = renderDailyMarkdown({
      date: '2026-05-28',
      timezone: 'Asia/Tokyo',
      activeSession: null,
      completedSessions: [],
      events: [],
      nowEpochMs: Date.now(),
    });
    expect(md).toContain('## Sessions');
    expect(md).toContain('## LLM Summary Pack');
    expect(safeYamlString('test')).toBe('"test"');
  });
});
