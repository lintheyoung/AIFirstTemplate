import { describe, expect, it } from 'vitest';
import { createQueuedJob, runJobFromEvent } from '../../lib/jobs/service';

describe('jobs service', () => {
  it('creates queued job envelopes without executing a provider', () => {
    const job = createQueuedJob({
      actor: {
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 9,
        scopes: ['*'],
      },
      capabilityName: 'example.file_transform',
      providerName: 'example-transform',
      input: { input_file_id: 'file_123' },
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
});
