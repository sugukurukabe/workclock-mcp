import type { RequestContext } from '../domain/types.js';
import type { StartInput } from '../mcp/schemas.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function startTool(
  service: WorkClockService,
  ctx: RequestContext,
  input: StartInput,
) {
  return service.start(ctx, input);
}
