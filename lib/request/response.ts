import { ApiError, normalizeApiError } from './errors';

export function resolveRequestId(headerValue: string | null) {
  return headerValue && headerValue.trim()
    ? headerValue.trim()
    : `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function successPayload<T>(data: T, requestId: string) {
  return {
    data,
    request_id: requestId,
  };
}

export function errorPayload(error: ApiError, requestId: string) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    request_id: requestId,
  };
}

export function successResponse<T>(data: T, requestId: string, init?: ResponseInit) {
  return Response.json(successPayload(data, requestId), init);
}

export function errorResponse(error: unknown, requestId: string) {
  const normalized = normalizeApiError(error);
  return Response.json(errorPayload(normalized, requestId), {
    status: normalized.status,
  });
}
