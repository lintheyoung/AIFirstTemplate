import { requireDemoActor } from '@/lib/auth/demo-actor';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

export async function GET(request: Request) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = requireDemoActor();

    return successResponse(
      {
        actor_type: actor.actorType,
        actor_id: actor.actorId,
        workspace_id: actor.workspaceId,
        scopes: actor.scopes,
      },
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
