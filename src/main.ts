#!/usr/bin/env node
import { loadConfig } from './config.js';
import { startHttpServer, startStdioServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const mode = process.argv.includes('--http') ? 'http' : 'stdio';

  if (mode === 'http') {
    await startHttpServer(config);
    return;
  }

  await startStdioServer(config);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
