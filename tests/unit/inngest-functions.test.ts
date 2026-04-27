import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/request/errors';

const setRunning = vi.hoisted(() => vi.fn());
const setProviderTask = vi.hoisted(() => vi.fn());
const setSucceeded = vi.hoisted(() => vi.fn());
const setFailed = vi.hoisted(() => vi.fn());
const runJobFromEvent = vi.hoisted(() => vi.fn());
const handleKieFluxCallback = vi.hoisted(() => vi.fn());

vi.mock('../../lib/inngest/client', () => ({
  inngest: {
    createFunction(_options: unknown, _trigger: unknown, handler: unknown) {
      return { fn: handler };
    },
  },
}));

vi.mock('../../lib/jobs/repository', () => ({
  jobRepository: {
    setRunning,
    setProviderTask,
    setSucceeded,
    setFailed,
  },
}));

vi.mock('../../lib/jobs/service', () => ({
  handleKieFluxCallback,
  runJobFromEvent,
}));

import { handleKieFluxCallbackEvent, runJobCreated } from '../../lib/inngest/functions';

function jobCreatedEvent() {
  return {
    jobId: 'job_123',
    workspaceId: 1,
    capabilityName: 'example.echo',
    providerName: 'echo',
    input: { message: 'hello' },
    actor: {
      actorType: 'user',
      actorId: 'user_test_123',
      workspaceId: 1,
      scopes: ['*'],
    },
  };
}

async function runFunction() {
  const functionUnderTest = runJobCreated as unknown as {
    fn(input: unknown): Promise<unknown>;
  };

  return functionUnderTest.fn({
    event: { data: jobCreatedEvent() },
    step: {
      run: async (_name: string, fn: () => Promise<unknown>) => fn(),
    },
  });
}

async function runKieCallbackFunction() {
  const functionUnderTest = handleKieFluxCallbackEvent as unknown as {
    fn(input: unknown): Promise<unknown>;
  };

  return functionUnderTest.fn({
    event: {
      data: {
        taskId: 'kie_task_123',
        code: 200,
        message: 'success',
        resultImageUrl: 'https://kie.example.test/result.jpeg',
      },
    },
    step: {
      run: async (_name: string, fn: () => Promise<unknown>) => fn(),
    },
  });
}

describe('Inngest functions', () => {
  beforeEach(() => {
    setRunning.mockReset();
    setProviderTask.mockReset();
    setSucceeded.mockReset();
    setFailed.mockReset();
    runJobFromEvent.mockReset();
    handleKieFluxCallback.mockReset();
  });

  it('confirms running status before persisting submitted provider task ids', async () => {
    runJobFromEvent.mockResolvedValue({
      status: 'running',
      result: { provider_task_id: 'kie_task_123' },
    });

    await runFunction();

    expect(setRunning).toHaveBeenCalledTimes(2);
    expect(setRunning).toHaveBeenNthCalledWith(1, 'job_123');
    expect(setRunning).toHaveBeenNthCalledWith(2, 'job_123');
    expect(setProviderTask).toHaveBeenCalledWith('job_123', 'kie_task_123');
    expect(setSucceeded).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('persists failed provider results', async () => {
    runJobFromEvent.mockResolvedValue({
      status: 'failed',
      result: null,
      errorCode: 'KIE_INVALID_INPUT',
      errorMessage: 'source_file_id and prompt are required.',
    });

    await runFunction();

    expect(setRunning).toHaveBeenCalledWith('job_123');
    expect(setFailed).toHaveBeenCalledWith(
      'job_123',
      'KIE_INVALID_INPUT',
      'source_file_id and prompt are required.',
    );
    expect(setProviderTask).not.toHaveBeenCalled();
    expect(setSucceeded).not.toHaveBeenCalled();
  });

  it('persists succeeded provider results without requiring a result file', async () => {
    const result = { echo: { message: 'hello' } };
    runJobFromEvent.mockResolvedValue({
      status: 'succeeded',
      result,
      errorCode: null,
      errorMessage: null,
    });

    await runFunction();

    expect(setRunning).toHaveBeenCalledWith('job_123');
    expect(setSucceeded).toHaveBeenCalledWith('job_123', null, result);
    expect(setProviderTask).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('persists thrown provider errors before rethrowing for retries', async () => {
    const error = new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'kie.ai failed to create an image task.',
      status: 502,
    });
    runJobFromEvent.mockRejectedValue(error);

    await expect(runFunction()).rejects.toBe(error);

    expect(setRunning).toHaveBeenCalledWith('job_123');
    expect(setFailed).toHaveBeenCalledWith(
      'job_123',
      'INTERNAL_ERROR',
      'kie.ai failed to create an image task.',
    );
    expect(setProviderTask).not.toHaveBeenCalled();
    expect(setSucceeded).not.toHaveBeenCalled();
  });

  it('handles queued kie flux callback events', async () => {
    handleKieFluxCallback.mockResolvedValue(undefined);

    await runKieCallbackFunction();

    expect(handleKieFluxCallback).toHaveBeenCalledWith({
      taskId: 'kie_task_123',
      code: 200,
      message: 'success',
      resultImageUrl: 'https://kie.example.test/result.jpeg',
    });
  });
});
