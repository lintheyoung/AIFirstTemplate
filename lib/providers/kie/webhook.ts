import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_MAX_TIMESTAMP_AGE_SECONDS = 5 * 60;

export type KieFluxCallback = {
  code: number;
  msg: string;
  data: {
    taskId: string;
    info?: {
      originImageUrl?: string;
      resultImageUrl?: string;
    };
  };
};

export function verifyKieWebhookSignature(args: {
  taskId: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowSeconds?: number;
  maxTimestampAgeSeconds?: number;
}) {
  if (!args.timestamp || !args.signature || !args.secret) {
    return false;
  }

  const timestampSeconds = Number(args.timestamp);
  if (!Number.isInteger(timestampSeconds)) {
    return false;
  }

  const nowSeconds = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxTimestampAgeSeconds =
    args.maxTimestampAgeSeconds ?? DEFAULT_MAX_TIMESTAMP_AGE_SECONDS;
  if (Math.abs(nowSeconds - timestampSeconds) > maxTimestampAgeSeconds) {
    return false;
  }

  const expected = createHmac('sha256', args.secret)
    .update(`${args.taskId}.${args.timestamp}`)
    .digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(args.signature);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
