import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/webhooks/kie/flux-kontext/route';

const send = vi.hoisted(() => vi.fn());

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send,
  },
}));

vi.mock('@/lib/env/schema', () => ({
  env: {
    KIE_WEBHOOK_HMAC_KEY: 'secret',
  },
}));

function signedHeaders(taskId: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', 'secret')
    .update(`${taskId}.${timestamp}`)
    .digest('base64');

  return {
    'content-type': 'application/json',
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': signature,
  };
}

function request(body: unknown, headers: Record<string, string> = signedHeaders('task_123')) {
  return new Request('https://example.test/api/webhooks/kie/flux-kontext', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('kie flux callback route', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  it('verifies signature and enqueues a successful callback', async () => {
    const response = await POST(
      request({
        code: 200,
        msg: 'success',
        data: {
          taskId: 'task_123',
          info: {
            resultImageUrl: 'https://kie.example.test/result.png',
          },
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({
      name: 'kie/flux.callback',
      data: {
        taskId: 'task_123',
        code: 200,
        message: 'success',
        resultImageUrl: 'https://kie.example.test/result.png',
      },
    });
  });

  it('returns unauthorized for an invalid signature', async () => {
    const response = await POST(
      request(
        {
          code: 200,
          msg: 'success',
          data: { taskId: 'task_123', info: {} },
        },
        {
          'content-type': 'application/json',
          'x-webhook-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-webhook-signature': 'invalid',
        },
      ),
    );

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('returns bad request when taskId is missing', async () => {
    const response = await POST(
      request({
        code: 200,
        msg: 'success',
        data: { info: {} },
      }),
    );

    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('returns a stable bad request error for malformed JSON', async () => {
    const response = await POST(
      new Request('https://example.test/api/webhooks/kie/flux-kontext', {
        method: 'POST',
        headers: {
          ...signedHeaders('task_123'),
          'x-request-id': 'req_test',
        },
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_INVALID_BODY',
        message: 'Request body is invalid.',
        details: {},
      },
      request_id: 'req_test',
    });
    expect(send).not.toHaveBeenCalled();
  });
});
