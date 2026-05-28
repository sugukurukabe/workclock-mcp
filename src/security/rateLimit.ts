import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { WorkClockError } from '../mcp/errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createRateLimitMiddleware(maxRequests = 120, windowMs = 60_000) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    const key = req.authContext?.userKey ?? req.ip ?? 'anonymous';
    const now = Date.now();
    const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > maxRequests) {
      next(new WorkClockError('RATE_LIMITED', 'Too many requests.'));
      return;
    }

    next();
  };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
