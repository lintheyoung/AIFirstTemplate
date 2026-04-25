import { ApiError } from './errors';

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError({
        code: 'VALIDATION_INVALID_BODY',
        message: 'Request body is invalid.',
        status: 400,
      });
    }

    throw error;
  }
}
