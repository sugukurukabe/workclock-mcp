export interface AppConfig {
  mode: 'local' | 'remote';
  logDir?: string;
  timezone: string;
  defaultMode: 'timer' | 'pomodoro';
  defaultWorkMinutes: number;
  defaultShortBreakMinutes: number;
  defaultLongBreakMinutes: number;
  maxSessionHours: number;
  exposeLocalPaths: boolean;
  enableGitContext: boolean;
  projectName?: string;
  remoteRequireAuth: boolean;
  allowedOrigins: string[];
  trustedGatewayHmacSecret?: string;
  port: number;
  host: string;
  logLevel: string;
  userKey: string;
  workspaceKey: string;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function loadConfig(): AppConfig {
  const allowedOrigins = (process.env.WORKCLOCK_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    mode: process.env.WORKCLOCK_MODE === 'remote' ? 'remote' : 'local',
    logDir: process.env.WORKCLOCK_LOG_DIR || undefined,
    timezone: process.env.WORKCLOCK_TIMEZONE ?? 'Asia/Tokyo',
    defaultMode: process.env.WORKCLOCK_DEFAULT_MODE === 'pomodoro' ? 'pomodoro' : 'timer',
    defaultWorkMinutes: parseIntEnv(process.env.WORKCLOCK_DEFAULT_WORK_MINUTES, 25),
    defaultShortBreakMinutes: parseIntEnv(process.env.WORKCLOCK_DEFAULT_SHORT_BREAK_MINUTES, 5),
    defaultLongBreakMinutes: parseIntEnv(process.env.WORKCLOCK_DEFAULT_LONG_BREAK_MINUTES, 15),
    maxSessionHours: parseIntEnv(process.env.WORKCLOCK_MAX_SESSION_HOURS, 12),
    exposeLocalPaths: parseBool(process.env.WORKCLOCK_EXPOSE_LOCAL_PATHS, false),
    enableGitContext: parseBool(process.env.WORKCLOCK_ENABLE_GIT_CONTEXT, false),
    projectName: process.env.WORKCLOCK_PROJECT_NAME || undefined,
    remoteRequireAuth: parseBool(process.env.WORKCLOCK_REMOTE_REQUIRE_AUTH, true),
    allowedOrigins,
    trustedGatewayHmacSecret: process.env.WORKCLOCK_TRUSTED_GATEWAY_HMAC_SECRET || undefined,
    port: parseIntEnv(process.env.PORT, 3002),
    host: process.env.HOST ?? '127.0.0.1',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    userKey: process.env.WORKCLOCK_USER_KEY ?? 'default',
    workspaceKey: process.env.WORKCLOCK_WORKSPACE_KEY ?? 'default',
  };
}
