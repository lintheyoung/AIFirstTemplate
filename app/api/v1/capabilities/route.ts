import { requireClerkActor } from '@/lib/auth/clerk-actor';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

const capabilities = [
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
] as const;

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    await requireClerkActor();

    return successResponse({ capabilities }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
