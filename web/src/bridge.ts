import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import type { WorkClockEnvelope } from '../../src/domain/types.js';

export type WorkClockBridge = {
  callTool: (name: string, args?: Record<string, unknown>) => Promise<WorkClockEnvelope | null>;
  onResult: (handler: (result: WorkClockEnvelope | null) => void) => void;
  available: boolean;
};

export function createBridge(): WorkClockBridge {
  let app: McpApp | null = null;
  let available = false;

  try {
    app = new McpApp({ name: 'WorkClock Timer', version: '1.0.0' });
    available = true;
  } catch {
    available = false;
  }

  const handlers: Array<(result: WorkClockEnvelope | null) => void> = [];

  if (app) {
    void app.connect().then(() => {
      app!.ontoolresult = (result) => {
        const envelope = (result.structuredContent ?? null) as WorkClockEnvelope | null;
        handlers.forEach((handler) => handler(envelope));
      };
    });
  }

  return {
    available,
    onResult(handler) {
      handlers.push(handler);
    },
    async callTool(name, args = {}) {
      if (!app) return null;
      const response = await app.callServerTool({ name, arguments: args });
      return (response.structuredContent ?? null) as WorkClockEnvelope | null;
    },
  };
}
