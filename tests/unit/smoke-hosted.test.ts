import { describe, expect, it, vi } from 'vitest';
import { runHostedSmoke } from '../../scripts/smoke-hosted';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

describe('hosted smoke', () => {
  it('checks unauthenticated auth protection, Inngest sync, and Vercel region', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/api/v1/me')) {
        return jsonResponse(
          {
            error: {
              code: 'AUTH_UNAUTHORIZED',
              message: 'Authentication is required.',
              details: {},
            },
            request_id: 'req_smoke',
          },
          {
            status: 401,
            headers: {
              'x-vercel-id': 'sin1::abc',
            },
          },
        );
      }

      if (url.endsWith('/api/inngest')) {
        return jsonResponse(
          {
            has_event_key: true,
            has_signing_key: true,
            function_count: 1,
          },
          {
            status: 200,
            headers: {
              'x-inngest-env': 'test',
              'x-vercel-id': 'sin1::sin1::abc',
            },
          },
        );
      }

      throw new Error(`Unexpected request ${url}`);
    });

    await expect(
      runHostedSmoke({
        baseUrl: 'https://test.app.pest.gg',
        expectEnv: 'test',
        expectRegion: 'sin1',
        fetcher,
      }),
    ).resolves.toMatchObject({
      status: 'ok',
      baseUrl: 'https://test.app.pest.gg',
      checks: {
        unauthenticatedApi: 'ok',
        inngest: 'ok',
      },
    });
  });

  it('runs authenticated smoke checks when a Clerk bearer token is provided', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/v1/me') && init?.headers instanceof Headers) {
        return jsonResponse(
          {
            data: {
              actor_type: 'user',
              actor_id: 'user_test',
              workspace_id: 1,
              scopes: ['*'],
            },
            request_id: 'req_smoke',
          },
          {
            status: 200,
            headers: {
              'x-vercel-id': 'sin1::auth',
            },
          },
        );
      }

      if (url.endsWith('/api/v1/me')) {
        return jsonResponse(
          {
            error: { code: 'AUTH_UNAUTHORIZED', message: 'Authentication is required.' },
            request_id: 'req_smoke',
          },
          { status: 401, headers: { 'x-vercel-id': 'sin1::unauth' } },
        );
      }

      if (url.endsWith('/api/v1/capabilities')) {
        return jsonResponse(
          {
            data: {
              capabilities: [{ name: 'example.echo', provider: 'echo' }],
            },
            request_id: 'req_smoke',
          },
          { status: 200, headers: { 'x-vercel-id': 'sin1::capabilities' } },
        );
      }

      if (url.endsWith('/api/inngest')) {
        return jsonResponse(
          { has_event_key: true, has_signing_key: true, function_count: 1 },
          {
            status: 200,
            headers: {
              'x-inngest-env': 'Production',
              'x-vercel-id': 'sin1::sin1::inngest',
            },
          },
        );
      }

      throw new Error(`Unexpected request ${url}`);
    });

    const result = await runHostedSmoke({
      baseUrl: 'https://app.pest.gg',
      expectEnv: 'prod',
      expectRegion: 'sin1',
      clerkBearerToken: 'session_token',
      fetcher,
    });

    expect(result.checks.authenticatedMe).toBe('ok');
    expect(result.checks.authenticatedCapabilities).toBe('ok');
    expect(fetcher).toHaveBeenCalledWith(
      'https://app.pest.gg/api/v1/me',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it('fails when Vercel does not route a hosted response through the expected region', async () => {
    await expect(
      runHostedSmoke({
        baseUrl: 'https://test.app.pest.gg',
        expectEnv: 'test',
        expectRegion: 'sin1',
        fetcher: async (url: string) => {
          if (url.endsWith('/api/v1/me')) {
            return jsonResponse(
              { error: { code: 'AUTH_UNAUTHORIZED' }, request_id: 'req_smoke' },
              { status: 401, headers: { 'x-vercel-id': 'iad1::abc' } },
            );
          }

          return jsonResponse(
            { has_event_key: true, has_signing_key: true, function_count: 1 },
            {
              status: 200,
              headers: {
                'x-inngest-env': 'test',
                'x-vercel-id': 'iad1::iad1::abc',
              },
            },
          );
        },
      }),
    ).rejects.toThrow('Expected x-vercel-id to include sin1, but received iad1::abc.');
  });
});
