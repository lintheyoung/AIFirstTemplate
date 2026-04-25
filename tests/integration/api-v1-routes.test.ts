import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getMe } from '../../app/api/v1/me/route';
import { GET as getCapabilities } from '../../app/api/v1/capabilities/route';
import { POST as createUpload } from '../../app/api/v1/files/create-upload/route';
import { POST as createJob } from '../../app/api/v1/jobs/route';

const createUploadIntent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/files/service', () => ({
  createUploadIntent,
}));

function request(path: string) {
  return new Request(`https://example.test${path}`, {
    headers: {
      'x-request-id': 'req_test',
    },
  });
}

describe('/api/v1 routes', () => {
  beforeEach(() => {
    createUploadIntent.mockReset();
  });

  it('returns a demo actor from /me', async () => {
    const response = await getMe(request('/api/v1/me'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      data: {
        actor_type: 'api_key',
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
        actorType: 'api_key',
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
