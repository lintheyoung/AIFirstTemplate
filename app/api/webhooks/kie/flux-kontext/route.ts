import { env } from '@/lib/env/schema';
import { inngest } from '@/lib/inngest/client';
import { verifyKieWebhookSignature, type KieFluxCallback } from '@/lib/providers/kie/webhook';
import { ApiError } from '@/lib/request/errors';
import { parseJsonBody } from '@/lib/request/json';
import { errorResponse, resolveRequestId } from '@/lib/request/response';

export async function POST(request: Request) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const payload = (await parseJsonBody(request)) as Partial<KieFluxCallback>;
    const taskId = payload.data?.taskId;

    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new ApiError({
        code: 'VALIDATION_INVALID_BODY',
        message: 'Missing taskId.',
        status: 400,
      });
    }

    const verified = verifyKieWebhookSignature({
      taskId,
      timestamp: request.headers.get('x-webhook-timestamp'),
      signature: request.headers.get('x-webhook-signature'),
      secret: env.KIE_WEBHOOK_HMAC_KEY,
    });

    if (!verified) {
      throw new ApiError({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Invalid signature.',
        status: 401,
      });
    }

    await inngest.send({
      name: 'kie/flux.callback',
      data: {
        taskId,
        code: payload.code ?? 0,
        message: payload.msg ?? '',
        resultImageUrl: payload.data?.info?.resultImageUrl,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
