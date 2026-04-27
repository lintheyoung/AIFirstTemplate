import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/request/errors';
import { createKieClient } from '../../lib/providers/kie/client';

describe('kie client', () => {
  it('submits a Flux Kontext image task with the expected request details', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        code: 200,
        msg: 'success',
        data: { taskId: 12345 },
      }),
    );
    const client = createKieClient({
      apiKey: 'kie_key',
      fetchImpl,
    });

    const result = await client.createFluxKontextTask({
      prompt: 'make it cinematic',
      inputImage: 'https://files.example.test/source.png',
      aspectRatio: '1:1',
      callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
    });

    expect(result).toEqual({ taskId: '12345' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.kie.ai/api/v1/flux/kontext/generate',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer kie_key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'make it cinematic',
          inputImage: 'https://files.example.test/source.png',
          enableTranslation: true,
          aspectRatio: '1:1',
          outputFormat: 'png',
          promptUpsampling: false,
          model: 'flux-kontext-pro',
          callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
        }),
      },
    );
  });

  it('throws a stable 502 ApiError for provider failures', async () => {
    const payload = {
      code: 500,
      msg: 'failed',
      data: null,
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json(payload, { status: 200 }),
    );
    const client = createKieClient({
      apiKey: 'kie_key',
      fetchImpl,
    });

    await expect(
      client.createFluxKontextTask({
        prompt: 'make it cinematic',
        inputImage: 'https://files.example.test/source.png',
        callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'kie.ai failed to create an image task.',
      details: { provider: 'kie-ai', response: payload },
    } satisfies Partial<ApiError>);
  });

  it('throws a stable 502 ApiError when provider JSON parsing fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('not-json', { status: 200 }),
    );
    const client = createKieClient({
      apiKey: 'kie_key',
      fetchImpl,
    });

    await expect(
      client.createFluxKontextTask({
        prompt: 'make it cinematic',
        inputImage: 'https://files.example.test/source.png',
        callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'kie.ai failed to create an image task.',
      details: { provider: 'kie-ai' },
    } satisfies Partial<ApiError>);
  });

  it('throws a stable 502 ApiError when the provider request fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const client = createKieClient({
      apiKey: 'kie_key',
      fetchImpl,
    });

    await expect(
      client.createFluxKontextTask({
        prompt: 'make it cinematic',
        inputImage: 'https://files.example.test/source.png',
        callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'kie.ai failed to create an image task.',
      details: {
        provider: 'kie-ai',
        response: { transportError: 'socket hang up' },
      },
    } satisfies Partial<ApiError>);
  });

  it('rejects provider responses with invalid taskId types', async () => {
    const payload = {
      code: 200,
      msg: 'success',
      data: { taskId: { id: 'task_123' } },
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json(payload, { status: 200 }),
    );
    const client = createKieClient({
      apiKey: 'kie_key',
      fetchImpl,
    });

    await expect(
      client.createFluxKontextTask({
        prompt: 'make it cinematic',
        inputImage: 'https://files.example.test/source.png',
        callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'kie.ai failed to create an image task.',
      details: { provider: 'kie-ai', response: payload },
    } satisfies Partial<ApiError>);
  });
});
