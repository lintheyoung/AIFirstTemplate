import { z } from 'zod';
import { requireClerkActor } from '@/lib/auth/clerk-actor';
import { createUploadIntent } from '@/lib/files/service';
import { ApiError } from '@/lib/request/errors';
import { parseJsonBody } from '@/lib/request/json';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

const createUploadSchema = z.object({
  filename: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
  visibility: z.enum(['private', 'public']).optional(),
});

export async function POST(request: Request) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = await requireClerkActor();
    const body = createUploadSchema.parse(await parseJsonBody(request));
    const upload = await createUploadIntent({
      actor,
      input: {
        filename: body.filename,
        mimeType: body.mime_type,
        sizeBytes: body.size_bytes,
        visibility: body.visibility,
      },
    });

    return successResponse(
      {
        file_id: upload.fileId,
        upload_url: upload.uploadUrl,
        headers: upload.headers,
        visibility: upload.visibility,
        public_url: upload.publicUrl,
      },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        new ApiError({
          code: 'VALIDATION_INVALID_BODY',
          message: 'Request body is invalid.',
          status: 400,
          details: { issues: error.issues },
        }),
        requestId,
      );
    }

    return errorResponse(error, requestId);
  }
}
