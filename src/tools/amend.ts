import type { RequestContext } from '../domain/types.js';
import type { AmendInput } from '../mcp/schemas.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function amendTool(
  service: WorkClockService,
  ctx: RequestContext,
  input: AmendInput,
) {
  return service.amend(ctx, input);
}
