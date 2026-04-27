import { requireClerkActor } from '@/lib/auth/clerk-actor';
import { getJobForActor } from '@/lib/jobs/service';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = await requireClerkActor();
    const { jobId } = await context.params;
    const job = await getJobForActor({ actor, jobId });

    return successResponse(
      {
        job: {
          id: job.id,
          workspace_id: job.workspaceId,
          capability_name: job.capabilityName,
          provider_name: job.providerName,
          status: job.status,
          source_file_id: job.sourceFileId,
          result_file_id: job.resultFileId,
          result: publicJobResult({
            capabilityName: job.capabilityName,
            providerName: job.providerName,
            resultFileId: job.resultFileId,
            resultJson: job.resultJson,
          }),
          error_code: job.errorCode,
          error_message: job.errorMessage,
        },
      },
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function publicJobResult(args: {
  capabilityName: string;
  providerName: string;
  resultFileId: string | null;
  resultJson: string | null;
}) {
  if (!args.resultJson) {
    return null;
  }

  const result = JSON.parse(args.resultJson) as Record<string, unknown>;

  if (args.providerName !== 'kie-ai' || args.capabilityName !== 'image.edit') {
    return result;
  }

  const publicResult: Record<string, unknown> = {};
  if (typeof result.provider_task_id === 'string') {
    publicResult.provider_task_id = result.provider_task_id;
  }
  if (typeof result.result_file_id === 'string') {
    publicResult.result_file_id = result.result_file_id;
  } else if (args.resultFileId) {
    publicResult.result_file_id = args.resultFileId;
  }

  return publicResult;
}
