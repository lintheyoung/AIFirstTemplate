import { jobRepository } from '../jobs/repository';
import { handleKieFluxCallback, runJobFromEvent } from '../jobs/service';
import { normalizeApiError } from '../request/errors';
import { inngest } from './client';

export const runJobCreated = inngest.createFunction(
  { id: 'run-job-created' },
  { event: 'job.created' },
  async ({ event, step }) => {
    await step.run('set job running', () => jobRepository.setRunning(event.data.jobId));

    let result: Awaited<ReturnType<typeof runJobFromEvent>>;
    try {
      result = await step.run('run provider job', () => runJobFromEvent(event.data));
    } catch (error) {
      const apiError = normalizeApiError(error);

      await step.run('set job failed after provider error', () =>
        jobRepository.setFailed(event.data.jobId, apiError.code, apiError.message),
      );

      throw error;
    }

    const providerTaskId = result.result?.provider_task_id;

    if (result.status === 'running' && typeof providerTaskId === 'string') {
      await step.run('confirm job running after provider submission', () =>
        jobRepository.setRunning(event.data.jobId),
      );

      await step.run('set provider task', () =>
        jobRepository.setProviderTask(event.data.jobId, providerTaskId),
      );
    }

    if (result.status === 'failed') {
      await step.run('set job failed', () =>
        jobRepository.setFailed(
          event.data.jobId,
          result.errorCode ?? 'PROVIDER_FAILED',
          result.errorMessage ?? 'Provider job failed.',
        ),
      );
    }

    if (result.status === 'succeeded') {
      await step.run('set job succeeded', () =>
        jobRepository.setSucceeded(
          event.data.jobId,
          resultFileIdFromResult(result.result),
          result.result ?? {},
        ),
      );
    }

    return result;
  },
);

export const handleKieFluxCallbackEvent = inngest.createFunction(
  { id: 'handle-kie-flux-callback' },
  { event: 'kie/flux.callback' },
  async ({ event, step }) =>
    step.run('handle kie flux callback', () =>
      handleKieFluxCallback({
        taskId: event.data.taskId,
        code: event.data.code,
        message: event.data.message,
        resultImageUrl: event.data.resultImageUrl,
      }),
    ),
);

export const functions = [runJobCreated, handleKieFluxCallbackEvent];

function resultFileIdFromResult(result: Record<string, unknown> | null) {
  return typeof result?.result_file_id === 'string' ? result.result_file_id : null;
}
