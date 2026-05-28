// Minimal stdio JSON-RPC smoke test against the built server.
// Spawns dist/main.js --stdio, runs initialize -> tools/list -> timelog.start -> timelog.status,
// and asserts the v2-alpha server responds correctly over the wire.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workclock-smoke-'));

const child = spawn(process.execPath, [path.join(root, 'dist', 'main.js'), '--stdio'], {
  env: { ...process.env, WORKCLOCK_LOG_DIR: tmpDir, WORKCLOCK_TIMEZONE: 'Asia/Tokyo' },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buffer = '';
const pending = new Map();

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 8000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    child.stdin.write(payload);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function assert(cond, label) {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ok: ${label}`);
}

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '1.0.0' },
  });
  assert(init.result?.serverInfo?.name === 'sugukuru-workclock-mcp', 'initialize returns server info');

  notify('notifications/initialized', {});

  const list = await rpc('tools/list', {});
  const names = (list.result?.tools ?? []).map((t) => t.name).sort();
  assert(names.length === 8, `tools/list returns 8 tools (got ${names.length})`);
  assert(names.includes('timelog.start'), 'tools/list includes timelog.start');
  assert(names.includes('timelog.export'), 'tools/list includes timelog.export');

  const start = await rpc('tools/call', {
    name: 'timelog.start',
    arguments: { taskName: '設計レビュー', mode: 'timer' },
  });
  const startStructured = start.result?.structuredContent;
  assert(startStructured?.ok === true, 'timelog.start ok');
  assert(startStructured?.activeSession?.taskName === '設計レビュー', 'active session task name set');

  const status = await rpc('tools/call', {
    name: 'timelog.status',
    arguments: { includeTodaySummary: true },
  });
  assert(status.result?.structuredContent?.activeSession?.taskName === '設計レビュー', 'status reflects active session');

  const dup = await rpc('tools/call', {
    name: 'timelog.start',
    arguments: { taskName: '別タスク' },
  });
  assert(dup.result?.isError === true, 'second start returns isError');
  assert(dup.result?.structuredContent?.error?.code === 'ACTIVE_SESSION_EXISTS', 'duplicate start -> ACTIVE_SESSION_EXISTS');

  const exported = await rpc('tools/call', {
    name: 'timelog.export',
    arguments: { format: 'standup', period: 'today' },
  });
  assert(exported.result?.structuredContent?.action === 'exported', 'export returns exported action');

  console.log('\nSMOKE PASSED');
  process.exitCode = 0;
} catch (err) {
  console.error(`\nSMOKE FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  child.kill();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}
