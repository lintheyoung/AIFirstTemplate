import { requireClerkActor } from '@/lib/auth/clerk-actor';
import { completeUploadIntent } from '@/lib/files/service';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

export async function POST(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = await requireClerkActor();
    const { fileId } = await context.params;
    const upload = await completeUploadIntent({ actor, fileId });

    return successResponse(
      {
        file_id: upload.fileId,
        status: upload.status,
      },
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
