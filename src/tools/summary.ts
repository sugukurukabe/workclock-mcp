import type { RequestContext } from '../domain/types.js';
import type { SummaryInput } from '../mcp/schemas.js';
import type { WorkClockService } from '../services/workClockService.js';

export async function summaryTool(
  service: WorkClockService,
  ctx: RequestContext,
  input: SummaryInput,
) {
  return service.summary(ctx, input);
}
