import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '../../config/platform';

export function createApiKeyPlaintext(args: {
  environment: AppEnvironment;
  randomBytes?: () => Buffer;
}) {
  const bytes = args.randomBytes ? args.randomBytes() : randomBytes(32);
  return `bcp_${args.environment}_${bytes.toString('base64url')}`;
}

export async function hashApiKey(plaintext: string) {
  return createHash('sha256').update(plaintext).digest('hex');
}

export async function verifyApiKey(plaintext: string, expectedHash: string) {
  const actual = Buffer.from(await hashApiKey(plaintext), 'utf8');
  const expected = Buffer.from(expectedHash, 'utf8');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function keyPrefix(plaintext: string) {
  return plaintext.slice(0, 16);
}
