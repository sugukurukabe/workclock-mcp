export type ErrorCode =
  | 'ACTIVE_SESSION_EXISTS'
  | 'NO_ACTIVE_SESSION'
  | 'ALREADY_PAUSED'
  | 'NO_PAUSED_SESSION'
  | 'ROOT_NOT_CONFIGURED'
  | 'ROOT_NOT_ALLOWED'
  | 'PATH_TRAVERSAL_BLOCKED'
  | 'FILE_LOCK_TIMEOUT'
  | 'LOG_WRITE_FAILED'
  | 'INVALID_TIME_RANGE'
  | 'CLOCK_SKEW_DETECTED'
  | 'SESSION_TOO_LONG'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'INTERNAL_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_INPUT';

export class WorkClockError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'WorkClockError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export function isWorkClockError(error: unknown): error is WorkClockError {
  return error instanceof WorkClockError;
}
