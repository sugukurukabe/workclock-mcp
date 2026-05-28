import pino from 'pino';
import { redactObject } from '../security/redact.js';

let loggerInstance: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    loggerInstance = pino({
      level: process.env.LOG_LEVEL ?? 'info',
      base: { service: 'workclock-mcp' },
      hooks: {
        logMethod(inputArgs, method, _level) {
          const redacted = inputArgs.map((arg) =>
            typeof arg === 'object' && arg !== null
              ? redactObject(arg as Record<string, unknown>)
              : arg,
          );
          return method.apply(this, redacted as Parameters<typeof method>);
        },
      },
    });
  }
  return loggerInstance;
}

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return getLogger().child(bindings);
}
