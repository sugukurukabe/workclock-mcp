import type { RequestContext } from '../domain/types.js';
import type { StatusInput } from '../mcp/schemas.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function statusTool(
  service: WorkClockService,
  ctx: RequestContext,
  input: StatusInput,
) {
  return service.status(ctx, input);
}
