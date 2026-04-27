import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getMe } from '../../app/api/v1/me/route';
import { GET as getCapabilities } from '../../app/api/v1/capabilities/route';
import { POST as completeUpload } from '../../app/api/v1/files/[fileId]/complete/route';
import { POST as createUpload } from '../../app/api/v1/files/create-upload/route';
import { GET as getJob } from '../../app/api/v1/jobs/[jobId]/route';
import { POST as createJob } from '../../app/api/v1/jobs/route';

const createUploadIntent = vi.hoisted(() => vi.fn());
const completeUploadIntent = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const emitJobCreated = vi.hoisted(() => vi.fn());
const getJobForActor = vi.hoisted(() => vi.fn());
const createPersistedJob = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth,
}));

vi.mock('@/lib/files/service', () => ({
  completeUploadIntent,
  createUploadIntent,
}));

vi.mock('@/lib/queue/inngest', () => ({
  inngestQueueAdapter: {
    emitJobCreated,
  },
}));

vi.mock('@/lib/jobs/repository', () => ({
  jobRepository: {
    createJob: createPersistedJob,
    getById: vi.fn(),
    setRunning: vi.fn(),
    setProviderTask: vi.fn(),
    findByProviderTask: vi.fn(),
    setSucceeded: vi.fn(),
    setFailed: vi.fn(),
  },
}));

vi.mock('@/lib/jobs/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/jobs/service')>();

  return {
    ...actual,
    getJobForActor,
  };
});

function request(path: string) {
  return new Request(`https://example.test${path}`, {
    headers: {
      'x-request-id': 'req_test',
    },
  });
}

describe('/api/v1 routes', () => {
  beforeEach(() => {
    auth.mockResolvedValue({ userId: 'user_test_123', orgId: null });
    completeUploadIntent.mockReset();
    createUploadIntent.mockReset();
    emitJobCreated.mockReset();
    getJobForActor.mockReset();
    createPersistedJob.mockReset();
    createPersistedJob.mockImplementation((input) =>
      Promise.resolve({
        ...input,
        sourceFileId: input.sourceFileId ?? null,
        resultFileId: null,
        providerTaskId: null,
        resultJson: null,
        errorCode: null,
        errorMessage: null,
      }),
    );
  });

  it('requires Clerk authentication for v1 route handlers', async () => {
    auth.mockResolvedValue({ userId: null, orgId: null });

    const responses = await Promise.all([
      getMe(request('/api/v1/me')),
      getCapabilities(request('/api/v1/capabilities')),
      createUpload(
        new Request('https://example.test/api/v1/files/create-upload', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req_test',
          },
          body: JSON.stringify({
            filename: 'notes.txt',
            mime_type: 'text/plain',
            size_bytes: 12,
          }),
        }),
      ),
      completeUpload(
        new Request('https://example.test/api/v1/files/file_test/complete', {
          method: 'POST',
          headers: {
            'x-request-id': 'req_test',
          },
        }),
        { params: Promise.resolve({ fileId: 'file_test' }) },
      ),
      createJob(
        new Request('https://example.test/api/v1/jobs', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req_test',
          },
          body: JSON.stringify({
            capability_name: 'example.echo',
            provider_name: 'echo',
            input: { message: 'hello' },
          }),
        }),
      ),
      getJob(request('/api/v1/jobs/job_test'), {
        params: Promise.resolve({ jobId: 'job_test' }),
      }),
    ]);

    for (const response of responses) {
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: {
          code: 'AUTH_UNAUTHORIZED',
          message: 'Authentication is required.',
        },
        request_id: 'req_test',
      });
    }
    expect(completeUploadIntent).not.toHaveBeenCalled();
    expect(createUploadIntent).not.toHaveBeenCalled();
    expect(emitJobCreated).not.toHaveBeenCalled();
    expect(getJobForActor).not.toHaveBeenCalled();
  });

  it('returns the Clerk actor from /me', async () => {
    const response = await getMe(request('/api/v1/me'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      data: {
        actor_type: 'user',
        actor_id: 'user_test_123',
        workspace_id: 1,
      },
      request_id: 'req_test',
    });
  });

  it('lists example capabilities', async () => {
    const response = await getCapabilities(request('/api/v1/capabilities'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.capabilities).toEqual([
      {
        name: 'example.echo',
        provider: 'echo',
        execution_modes: ['sync'],
      },
      {
        name: 'example.file_transform',
        provider: 'example-transform',
        execution_modes: ['sync', 'async'],
      },
      {
        name: 'image.edit',
        provider: 'kie-ai',
        execution_modes: ['async'],
      },
    ]);
  });

  it('creates upload intents through the file service', async () => {
    createUploadIntent.mockResolvedValue({
      fileId: 'file_test',
      uploadUrl: 'https://upload.example.test/signed',
      headers: { 'content-type': 'text/plain' },
      visibility: 'private',
      publicUrl: null,
    });

    const response = await createUpload(
      new Request('https://example.test/api/v1/files/create-upload', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          filename: 'notes.txt',
          mime_type: 'text/plain',
          size_bytes: 12,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      data: {
        file_id: 'file_test',
        upload_url: 'https://upload.example.test/signed',
        headers: { 'content-type': 'text/plain' },
        visibility: 'private',
        public_url: null,
      },
      request_id: 'req_test',
    });
    expect(createUploadIntent).toHaveBeenCalledWith({
      actor: expect.objectContaining({
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 1,
      }),
      input: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 12,
        visibility: undefined,
      },
    });
  });

  it('returns validation errors for invalid upload intent bodies', async () => {
    const response = await createUpload(
      new Request('https://example.test/api/v1/files/create-upload', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          filename: '',
          mime_type: 'text/plain',
          size_bytes: 0,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'VALIDATION_INVALID_BODY',
        message: 'Request body is invalid.',
      },
      request_id: 'req_test',
    });
    expect(createUploadIntent).not.toHaveBeenCalled();
  });

  it('returns validation errors for malformed upload intent JSON', async () => {
    const response = await createUpload(
      new Request('https://example.test/api/v1/files/create-upload', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: '{"filename":',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'VALIDATION_INVALID_BODY',
        message: 'Request body is invalid.',
      },
      request_id: 'req_test',
    });
    expect(createUploadIntent).not.toHaveBeenCalled();
  });

  it('completes upload intents through the file service', async () => {
    completeUploadIntent.mockResolvedValue({
      fileId: 'file_test',
      status: 'uploaded',
    });

    const response = await completeUpload(
      new Request('https://example.test/api/v1/files/file_test/complete', {
        method: 'POST',
        headers: {
          'x-request-id': 'req_test',
        },
      }),
      { params: Promise.resolve({ fileId: 'file_test' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        file_id: 'file_test',
        status: 'uploaded',
      },
      request_id: 'req_test',
    });
    expect(completeUploadIntent).toHaveBeenCalledWith({
      actor: expect.objectContaining({
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 1,
      }),
      fileId: 'file_test',
    });
  });

  it('creates synchronous jobs through the example providers', async () => {
    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          capability_name: 'example.echo',
          provider_name: 'echo',
          input: { message: 'hello' },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      data: {
        job: {
          workspace_id: 1,
          capability_name: 'example.echo',
          provider_name: 'echo',
          status: 'succeeded',
          result: {
            echo: { message: 'hello' },
          },
          error_code: null,
          error_message: null,
        },
      },
      request_id: 'req_test',
    });
    expect(body.data.job.id).toMatch(/^job_[a-f0-9]{32}$/);
    expect(body.data.job.workspaceId).toBeUndefined();
    expect(body.data.job.capabilityName).toBeUndefined();
    expect(body.data.job.providerName).toBeUndefined();
  });

  it('queues asynchronous jobs through the Inngest adapter', async () => {
    emitJobCreated.mockResolvedValue(undefined);

    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          capability_name: 'example.file_transform',
          provider_name: 'example-transform',
          execution_mode: 'async',
          input: { input_file_id: 'file_123' },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      data: {
        job: {
          workspace_id: 1,
          capability_name: 'example.file_transform',
          provider_name: 'example-transform',
          status: 'queued',
          result: null,
          error_code: null,
          error_message: null,
        },
      },
      request_id: 'req_test',
    });
    expect(body.data.job.id).toMatch(/^job_[a-f0-9]{32}$/);
    expect(createPersistedJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 1,
        capabilityName: 'example.file_transform',
        providerName: 'example-transform',
        status: 'queued',
        inputJson: JSON.stringify({ input_file_id: 'file_123' }),
        sourceFileId: null,
        createdByType: 'user',
        createdById: 'user_test_123',
      }),
    );
    expect(emitJobCreated).toHaveBeenCalledWith({
      jobId: body.data.job.id,
      workspaceId: 1,
      capabilityName: 'example.file_transform',
      providerName: 'example-transform',
      input: { input_file_id: 'file_123' },
      actor: {
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 1,
        scopes: ['*'],
      },
    });
  });

  it('queues image edit jobs through the registered kie.ai provider', async () => {
    emitJobCreated.mockResolvedValue(undefined);

    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          capability_name: 'image.edit',
          provider_name: 'kie-ai',
          execution_mode: 'async',
          input: {
            source_file_id: 'file_source',
            prompt: 'make it cinematic',
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      data: {
        job: {
          workspace_id: 1,
          capability_name: 'image.edit',
          provider_name: 'kie-ai',
          status: 'queued',
          result: null,
          error_code: null,
          error_message: null,
        },
      },
      request_id: 'req_test',
    });
    expect(createPersistedJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 1,
        capabilityName: 'image.edit',
        providerName: 'kie-ai',
        status: 'queued',
        inputJson: JSON.stringify({
          source_file_id: 'file_source',
          prompt: 'make it cinematic',
        }),
        sourceFileId: 'file_source',
        createdByType: 'user',
        createdById: 'user_test_123',
      }),
    );
    expect(emitJobCreated).toHaveBeenCalledWith({
      jobId: body.data.job.id,
      workspaceId: 1,
      capabilityName: 'image.edit',
      providerName: 'kie-ai',
      input: {
        source_file_id: 'file_source',
        prompt: 'make it cinematic',
      },
      actor: {
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 1,
        scopes: ['*'],
      },
    });
  });

  it('rejects synchronous kie.ai image edit jobs', async () => {
    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          capability_name: 'image.edit',
          provider_name: 'kie-ai',
          input: {
            source_file_id: 'file_source',
            prompt: 'make it cinematic',
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'JOB_INVALID_STATE',
        message: "Provider 'kie-ai' for capability 'image.edit' only supports async execution.",
      },
      request_id: 'req_test',
    });
    expect(createPersistedJob).not.toHaveBeenCalled();
    expect(emitJobCreated).not.toHaveBeenCalled();
  });

  it('returns a persisted job by id', async () => {
    getJobForActor.mockResolvedValue({
      id: 'job_test',
      workspaceId: 1,
      capabilityName: 'image.edit',
      providerName: 'kie-ai',
      status: 'succeeded',
      sourceFileId: 'file_source',
      resultFileId: 'file_result',
      resultJson: JSON.stringify({
        provider_task_id: 'task_123',
        result_file_id: 'file_result',
        result_url: 'https://files.example.test/result.png',
        publicUrl: 'https://files.example.test/result.png',
      }),
      errorCode: null,
      errorMessage: null,
    });

    const response = await getJob(request('/api/v1/jobs/job_test'), {
      params: Promise.resolve({ jobId: 'job_test' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        job: {
          id: 'job_test',
          workspace_id: 1,
          capability_name: 'image.edit',
          provider_name: 'kie-ai',
          status: 'succeeded',
          source_file_id: 'file_source',
          result_file_id: 'file_result',
          result: {
            provider_task_id: 'task_123',
            result_file_id: 'file_result',
          },
          error_code: null,
          error_message: null,
        },
      },
      request_id: 'req_test',
    });
    expect(getJobForActor).toHaveBeenCalledWith({
      actor: {
        actorType: 'user',
        actorId: 'user_test_123',
        workspaceId: 1,
        scopes: ['*'],
      },
      jobId: 'job_test',
    });
  });

  it('returns validation errors for invalid job bodies', async () => {
    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          capability_name: '',
          provider_name: 'echo',
          input: null,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'VALIDATION_INVALID_BODY',
        message: 'Request body is invalid.',
      },
      request_id: 'req_test',
    });
  });

  it('returns validation errors for malformed job JSON', async () => {
    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: '{"capability_name":',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'VALIDATION_INVALID_BODY',
        message: 'Request body is invalid.',
      },
      request_id: 'req_test',
    });
  });

  it('returns a stable client error for unknown job providers', async () => {
    const response = await createJob(
      new Request('https://example.test/api/v1/jobs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req_test',
        },
        body: JSON.stringify({
          capability_name: 'example.missing',
          provider_name: 'missing-provider',
          input: {},
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: "Provider 'missing-provider' is not registered.",
      },
      request_id: 'req_test',
    });
  });
});
