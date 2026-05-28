import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppConfig } from '../config.js';
import type { RequestContext } from '../domain/types.js';
import { newRequestId } from '../domain/ids.js';
import type { AuthContext } from '../security/auth.js';

const authStorage = new AsyncLocalStorage<AuthContext>();

export function runWithAuthContext<T>(auth: AuthContext, fn: () => T): T {
  return authStorage.run(auth, fn);
}

export function buildRequestContext(
  config: AppConfig,
  auth?: AuthContext,
  source: RequestContext['source'] = 'chat',
  toolCallId?: string,
): RequestContext {
  const resolvedAuth = auth ?? authStorage.getStore();
  return {
    userKey: resolvedAuth?.userKey ?? config.userKey,
    workspaceKey: resolvedAuth?.workspaceKey ?? config.workspaceKey,
    requestId: newRequestId(),
    source,
    toolCallId,
  };
}
