import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '../config.js';
import { WorkClockError } from '../mcp/errors.js';

export function createOriginMiddleware(config: AppConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const origin = req.header('origin');
    if (!origin) {
      next();
      return;
    }

    if (config.mode === 'local' && config.allowedOrigins.length === 0) {
      const allowedLocal = [`http://${config.host}:${config.port}`, `http://127.0.0.1:${config.port}`, `http://localhost:${config.port}`];
      if (allowedLocal.includes(origin)) {
        next();
        return;
      }
    }

    if (config.allowedOrigins.length === 0) {
      next(new WorkClockError('AUTH_REQUIRED', 'Origin not allowed.'));
      return;
    }

    if (config.allowedOrigins.includes(origin)) {
      next();
      return;
    }

    next(new WorkClockError('AUTH_REQUIRED', 'Origin not allowed.'));
  };
}

export function applyCorsHeaders(req: Request, res: Response, config: AppConfig): void {
  const origin = req.header('origin');
  if (!origin) return;

  const allowed =
    config.allowedOrigins.length > 0
      ? config.allowedOrigins
      : [`http://${config.host}:${config.port}`, `http://127.0.0.1:${config.port}`, `http://localhost:${config.port}`];

  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, mcp-session-id, x-workclock-user, x-workclock-workspace, x-workclock-signature');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  }
}
