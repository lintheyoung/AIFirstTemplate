import { describe, expect, it, vi } from 'vitest';
import type { CreateJobInput, JobRecord, JobRepository } from '../../lib/jobs/repository';
import {
  createQueuedJob,
  getJobForActor,
  handleKieFluxCallback,
  runJobFromEvent,
} from '../../lib/jobs/service';

describe('jobs service', () => {
  function makeJobRecord(overrides: Partial<JobRecord> & Pick<JobRecord, 'id'>): JobRecord {
    return {
      id: overrides.id,
      workspaceId: overrides.workspaceId ?? 1,
      capabilityName: overrides.capabilityName ?? 'example.file_transform',
      providerName: overrides.providerName ?? 'example-transform',
      status: overrides.status ?? 'queued',
      sourceFileId: overrides.sourceFileId ?? null,
      resultFileId: overrides.resultFileId ?? null,
      providerTaskId: overrides.providerTaskId ?? null,
      inputJson: overrides.inputJson ?? '{}',
      resultJson: overrides.resultJson ?? null,
      errorCode: overrides.errorCode ?? null,
      errorMessage: overrides.errorMessage ?? null,
      idempotencyKey: overrides.idempotencyKey ?? null,
      createdByType: overrides.createdByType ?? 'user',
      createdById: overrides.createdById ?? 'user_test_123',
      createdAt: overrides.createdAt ?? new Date('2026-04-26T00:00:00.000Z'),
      startedAt: overrides.startedAt ?? null,
      finishedAt: overrides.finishedAt ?? null,
    };
  }

  function createFakeRepository(overrides: Partial<JobRepository> = {}): JobRepository {
    return {
      async createJob(input: CreateJobInput) {
        return makeJobRecord(input);
      },
      async getById() {
        return null;
      },
      async setRunning() {},
      async setProviderTask() {},
      async findByProviderTask() {
        return null;
      },
      async setSucceeded() {},
      async setFailed() {},
      ...overrides,
    };
  }

  it('creates queued job envelopes without executing a provider', async () => {
    const repository = createFakeRepository();

    const job = await createQueuedJob({
      actor: {
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 9,
        scopes: ['*'],
      },
      capabilityName: 'example.file_transform',
      providerName: 'example-transform',
      input: { input_file_id: 'file_123' },
      repository,
      uuidFactory: () => '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(job).toEqual({
      id: 'job_123e4567e89b12d3a456426614174000',
      workspaceId: 9,
      capabilityName: 'example.file_transform',
      providerName: 'example-transform',
      status: 'queued',
      result: null,
      errorCode: null,
      errorMessage: null,
    });
  });

  it('creates a durable async image edit job with source file metadata', async () => {
    const created: unknown[] = [];
    const repository = createFakeRepository({
      async createJob(input: CreateJobInput) {
        created.push(input);
        return makeJobRecord(input);
      },
    });

    const job = await createQueuedJob({
      actor: {
        actorType: 'user',
        actorId: 'user_123',
        workspaceId: 1,
        scopes: ['*'],
      },
      capabilityName: 'image.edit',
      providerName: 'kie-ai',
      input: {
        source_file_id: 'file_source',
        prompt: 'make it cinematic',
      },
      repository,
      uuidFactory: () => '00000000-0000-0000-0000-000000000002',
    });

    expect(job.id).toBe('job_00000000000000000000000000000002');
    expect(created).toEqual([
      expect.objectContaining({
        id: 'job_00000000000000000000000000000002',
        workspaceId: 1,
        capabilityName: 'image.edit',
        providerName: 'kie-ai',
        status: 'queued',
        sourceFileId: 'file_source',
        inputJson: JSON.stringify({
          source_file_id: 'file_source',
          prompt: 'make it cinematic',
        }),
        createdByType: 'user',
        createdById: 'user_123',
      }),
    ]);
  });

  it('returns a job for an actor in the same workspace', async () => {
    const persistedJob = {
      id: 'job_same_workspace',
      workspaceId: 3,
    };
    const repository = createFakeRepository({
      async getById(jobId: string) {
        expect(jobId).toBe('job_same_workspace');
        return makeJobRecord(persistedJob);
      },
    });

    await expect(
      getJobForActor({
        actor: {
          actorType: 'user',
          actorId: 'user_123',
          workspaceId: 3,
          scopes: ['*'],
        },
        jobId: 'job_same_workspace',
        repository,
      }),
    ).resolves.toMatchObject(persistedJob);
  });

  it('throws not found when a job is missing', async () => {
    const repository = createFakeRepository({
      async getById() {
        return null;
      },
    });

    await expect(
      getJobForActor({
        actor: {
          actorType: 'user',
          actorId: 'user_123',
          workspaceId: 3,
          scopes: ['*'],
        },
        jobId: 'job_missing',
        repository,
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      message: 'Job was not found.',
    });
  });

  it('throws not found for jobs in a different workspace', async () => {
    const repository = createFakeRepository({
      async getById() {
        return makeJobRecord({
          id: 'job_other_workspace',
          workspaceId: 4,
        });
      },
    });

    await expect(
      getJobForActor({
        actor: {
          actorType: 'user',
          actorId: 'user_123',
          workspaceId: 3,
          scopes: ['*'],
        },
        jobId: 'job_other_workspace',
        repository,
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      message: 'Job was not found.',
    });
  });

  it('runs provider jobs from Inngest job.created events', async () => {
    const job = await runJobFromEvent({
      jobId: 'job_123',
      workspaceId: 9,
      capabilityName: 'example.file_transform',
      providerName: 'example-transform',
      input: { input_file_id: 'file_123' },
      actor: {
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 9,
        scopes: ['*'],
      },
    });

    expect(job).toEqual({
      id: 'job_123',
      workspaceId: 9,
      capabilityName: 'example.file_transform',
      providerName: 'example-transform',
      status: 'succeeded',
      result: {
        output: {
          filename: 'file_123.result.json',
          mimeType: 'application/json',
          sourceFileId: 'file_123',
          storageKey: 'ws/9/output/job_123/file_123.result.json',
        },
      },
      errorCode: null,
      errorMessage: null,
    });
  });

  it('stores a successful kie callback result and marks the job succeeded', async () => {
    const job = makeJobRecord({
      id: 'job_123',
      workspaceId: 7,
      providerName: 'kie-ai',
      providerTaskId: 'task_123',
      status: 'running',
    });
    const setSucceeded = vi.fn<JobRepository['setSucceeded']>();
    const repository = createFakeRepository({
      async findByProviderTask(providerName: string, providerTaskId: string) {
        expect(providerName).toBe('kie-ai');
        expect(providerTaskId).toBe('task_123');
        return job;
      },
      setSucceeded,
    });
    const createGeneratedImage = vi.fn().mockResolvedValue({
      fileId: 'file_result',
      storageKey: 'ws/7/generated/file_result/job_123.png',
    });

    await handleKieFluxCallback({
      taskId: 'task_123',
      code: 200,
      message: 'success',
      resultImageUrl: 'https://kie.example.test/result.png',
      repository,
      createGeneratedImage,
    });

    expect(createGeneratedImage).toHaveBeenCalledWith({
      workspaceId: 7,
      sourceUrl: 'https://kie.example.test/result.png',
      filename: 'job_123.png',
      mimeType: 'image/png',
    });
    expect(setSucceeded).toHaveBeenCalledWith('job_123', 'file_result', {
      provider_task_id: 'task_123',
      result_file_id: 'file_result',
    });
  });

  it('preserves requested jpeg output format for kie callback persistence', async () => {
    const job = makeJobRecord({
      id: 'job_123',
      workspaceId: 7,
      providerName: 'kie-ai',
      providerTaskId: 'task_123',
      status: 'running',
      inputJson: JSON.stringify({ output_format: 'jpeg' }),
    });
    const setSucceeded = vi.fn<JobRepository['setSucceeded']>();
    const repository = createFakeRepository({
      async findByProviderTask() {
        return job;
      },
      setSucceeded,
    });
    const createGeneratedImage = vi.fn().mockResolvedValue({
      fileId: 'file_result',
      storageKey: 'ws/7/generated/file_result/job_123.jpeg',
    });

    await handleKieFluxCallback({
      taskId: 'task_123',
      code: 200,
      message: 'success',
      resultImageUrl: 'https://kie.example.test/result.jpeg',
      repository,
      createGeneratedImage,
    });

    expect(createGeneratedImage).toHaveBeenCalledWith({
      workspaceId: 7,
      sourceUrl: 'https://kie.example.test/result.jpeg',
      filename: 'job_123.jpeg',
      mimeType: 'image/jpeg',
    });
    expect(setSucceeded).toHaveBeenCalledWith('job_123', 'file_result', {
      provider_task_id: 'task_123',
      result_file_id: 'file_result',
    });
  });

  it('marks kie callbacks failed when the provider reports an error', async () => {
    const setFailed = vi.fn<JobRepository['setFailed']>();
    const repository = createFakeRepository({
      async findByProviderTask() {
        return makeJobRecord({ id: 'job_failed', providerName: 'kie-ai' });
      },
      setFailed,
    });
    const createGeneratedImage = vi.fn();

    await handleKieFluxCallback({
      taskId: 'task_failed',
      code: 501,
      message: 'generation failed',
      repository,
      createGeneratedImage,
    });

    expect(setFailed).toHaveBeenCalledWith(
      'job_failed',
      'KIE_501',
      'generation failed',
    );
    expect(createGeneratedImage).not.toHaveBeenCalled();
  });

  it('throws not found for callbacks with an unknown kie task', async () => {
    const repository = createFakeRepository({
      async findByProviderTask() {
        return null;
      },
    });

    await expect(
      handleKieFluxCallback({
        taskId: 'task_missing',
        code: 200,
        message: 'success',
        resultImageUrl: 'https://kie.example.test/result.png',
        repository,
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      message: 'kie.ai task was not found.',
    });
  });

  it('ignores duplicate successful kie callbacks for terminal succeeded jobs', async () => {
    const setSucceeded = vi.fn<JobRepository['setSucceeded']>();
    const setFailed = vi.fn<JobRepository['setFailed']>();
    const createGeneratedImage = vi.fn();
    const repository = createFakeRepository({
      async findByProviderTask() {
        return makeJobRecord({
          id: 'job_done',
          providerName: 'kie-ai',
          status: 'succeeded',
          resultFileId: 'file_existing',
        });
      },
      setSucceeded,
      setFailed,
    });

    await handleKieFluxCallback({
      taskId: 'task_done',
      code: 200,
      message: 'success',
      resultImageUrl: 'https://kie.example.test/result.png',
      repository,
      createGeneratedImage,
    });

    expect(createGeneratedImage).not.toHaveBeenCalled();
    expect(setSucceeded).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('ignores late failed kie callbacks for terminal succeeded jobs', async () => {
    const setSucceeded = vi.fn<JobRepository['setSucceeded']>();
    const setFailed = vi.fn<JobRepository['setFailed']>();
    const repository = createFakeRepository({
      async findByProviderTask() {
        return makeJobRecord({
          id: 'job_done',
          providerName: 'kie-ai',
          status: 'succeeded',
          resultFileId: 'file_existing',
        });
      },
      setSucceeded,
      setFailed,
    });

    await handleKieFluxCallback({
      taskId: 'task_done',
      code: 501,
      message: 'late failure',
      repository,
    });

    expect(setSucceeded).not.toHaveBeenCalled();
    expect(setFailed).not.toHaveBeenCalled();
  });
});
