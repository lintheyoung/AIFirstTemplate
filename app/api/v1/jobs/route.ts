import { z } from 'zod';
import { requireDemoActor } from '@/lib/auth/demo-actor';
import { runJobInline } from '@/lib/jobs/service';
import { ApiError } from '@/lib/request/errors';
import { parseJsonBody } from '@/lib/request/json';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

const createJobSchema = z.object({
  capability_name: z.string().min(1),
  provider_name: z.string().min(1),
  execution_mode: z.enum(['sync', 'async']).default('sync'),
  input: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = requireDemoActor();
    const body = createJobSchema.parse(await parseJsonBody(request));
    const job = await runJobInline({
      actor,
      capabilityName: body.capability_name,
      providerName: body.provider_name,
      input: body.input,
    });

    return successResponse(
      {
        job: {
          id: job.id,
          workspace_id: job.workspaceId,
          capability_name: job.capabilityName,
          provider_name: job.providerName,
          status: job.status,
          result: job.result,
          error_code: job.errorCode,
          error_message: job.errorMessage,
        },
      },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        new ApiError({
          code: 'VALIDATION_INVALID_BODY',
          message: 'Request body is invalid.',
          status: 400,
          details: { issues: error.issues },
        }),
        requestId,
      );
    }

    return errorResponse(error, requestId);
  }
}
