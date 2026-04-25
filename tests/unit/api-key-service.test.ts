import { describe, expect, it } from 'vitest';
import {
  createApiKeyPlaintext,
  hashApiKey,
  verifyApiKey,
} from '../../lib/api-keys/service';

describe('api key service', () => {
  it('creates a prefixed plaintext key', () => {
    const key = createApiKeyPlaintext({
      environment: 'test',
      randomBytes: () => Buffer.from('12345678901234567890123456789012'),
    });

    expect(key.startsWith('bcp_test_')).toBe(true);
  });

  it('hashes and verifies keys without storing plaintext', async () => {
    const plaintext = 'bcp_test_secret';
    const hash = await hashApiKey(plaintext);

    expect(hash).not.toBe(plaintext);
    await expect(verifyApiKey(plaintext, hash)).resolves.toBe(true);
    await expect(verifyApiKey('wrong', hash)).resolves.toBe(false);
  });
});
