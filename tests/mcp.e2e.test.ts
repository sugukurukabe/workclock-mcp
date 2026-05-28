import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from '../src/mcp/schemas.js';
import { UI_MIME_TYPE, UI_RESOURCE_URI } from '../src/mcp/uiMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('mcp e2e metadata', () => {
  it('defines expected tools and ui resource', () => {
    expect(TOOL_NAMES).toHaveLength(8);
    expect(TOOL_NAMES).toContain('timelog.export');
    expect(UI_RESOURCE_URI).toBe('ui://workclock/timer.html');
    expect(UI_MIME_TYPE).toContain('mcp-app');
  });

  it('bundles single-file UI with CSP', async () => {
    const htmlPath = path.resolve(__dirname, '../dist/ui/index.html');
    const html = await fs.readFile(htmlPath, 'utf8');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('WorkClock');
  });
});
