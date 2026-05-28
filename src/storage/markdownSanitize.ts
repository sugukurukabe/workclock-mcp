/* eslint-disable no-control-regex */
export function stripControlChars(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').trim();
}

export function limitString(input: string, max: number): string {
  const cleaned = stripControlChars(input);
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max);
}

export function escapeMarkdownTableCell(input: string): string {
  return input
    .slice(0, 500)
    .replace(/\r?\n/g, '<br>')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

export function safeYamlString(input: string): string {
  const cleaned = limitString(input, 200);
  return JSON.stringify(cleaned);
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => limitString(tag.replace(/^#/, ''), 30).toLowerCase()))].slice(
    0,
    10,
  );
}

export function formatTags(tags: string[]): string {
  return normalizeTags(tags)
    .map((tag) => `#${tag}`)
    .join(' ');
}

export function escapeMarkdownInline(input: string): string {
  return limitString(input, 500).replace(/[<>]/g, '');
}
