import type { RequestContext } from '../domain/types.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function resumeTool(service: WorkClockService, ctx: RequestContext) {
  return service.resume(ctx);
}
