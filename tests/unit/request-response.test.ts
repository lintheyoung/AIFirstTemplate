import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/request/errors';
import { errorPayload, successPayload } from '../../lib/request/response';

describe('response envelopes', () => {
  it('formats success payloads consistently', () => {
    expect(successPayload({ ok: true }, 'req_123')).toEqual({
      data: { ok: true },
      request_id: 'req_123',
    });
  });

  it('formats API errors consistently', () => {
    const error = new ApiError({
      code: 'AUTH_UNAUTHORIZED',
      message: 'Authentication is required.',
      status: 401,
    });

    expect(errorPayload(error, 'req_456')).toEqual({
      error: {
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication is required.',
        details: {},
      },
      request_id: 'req_456',
    });
  });
});
