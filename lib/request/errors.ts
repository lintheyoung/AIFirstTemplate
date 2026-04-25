export type ApiErrorCode =
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'VALIDATION_INVALID_BODY'
  | 'RESOURCE_NOT_FOUND'
  | 'JOB_INVALID_STATE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(args: {
    code: ApiErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.status = args.status;
    this.details = args.details ?? {};
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError({
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred.',
    status: 500,
  });
}
