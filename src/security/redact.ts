const SENSITIVE_KEYS = new Set([
  'note',
  'notes',
  'markdown',
  'promptPack',
  'authorization',
  'token',
  'accessToken',
  'secret',
]);

export function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      output[key] = redactObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? redactObject(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === 'string' && looksLikeAbsolutePath(value)) {
      output[key] = '[PATH]';
    } else {
      output[key] = value;
    }
  }
  return output;
}

function looksLikeAbsolutePath(value: string): boolean {
  return (
    value.startsWith('/') ||
    /^[A-Za-z]:\\/.test(value) ||
    value.includes(':\\') ||
    value.includes('/Users/') ||
    value.includes('\\Users\\')
  );
}

export function hashKey(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
