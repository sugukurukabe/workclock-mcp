import type { RequestContext } from '../domain/types.js';
import type { PauseInput } from '../mcp/schemas.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function pauseTool(
  service: WorkClockService,
  ctx: RequestContext,
  input: PauseInput,
) {
  return service.pause(ctx, input);
}
