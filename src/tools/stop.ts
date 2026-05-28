import type { RequestContext } from '../domain/types.js';
import type { StopInput } from '../mcp/schemas.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function stopTool(
  service: WorkClockService,
  ctx: RequestContext,
  input: StopInput,
) {
  return service.stop(ctx, input);
}
