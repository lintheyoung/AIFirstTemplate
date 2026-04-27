import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyKieWebhookSignature } from '../../lib/providers/kie/webhook';

describe('kie webhook verification', () => {
  const nowSeconds = 1777190000;

  it('accepts a valid HMAC signature', () => {
    const signature = createHmac('sha256', 'secret')
      .update('task_123.1777190000')
      .digest('base64');

    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: '1777190000',
        signature,
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(true);
  });

  it('rejects an invalid HMAC signature', () => {
    const signature = createHmac('sha256', 'secret')
      .update('task_123.1777190000')
      .digest('base64');

    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: '1777190000',
        signature: signature.replace(/.$/, 'x'),
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(false);
  });

  it('rejects missing timestamp, signature, or secret', () => {
    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: null,
        signature: 'signature',
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(false);
    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: '1777190000',
        signature: null,
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(false);
    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: '1777190000',
        signature: 'signature',
        secret: '',
        nowSeconds,
      }),
    ).toBe(false);
  });

  it('rejects stale timestamps', () => {
    const timestamp = '1777189000';
    const signature = createHmac('sha256', 'secret')
      .update(`task_123.${timestamp}`)
      .digest('base64');

    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp,
        signature,
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(false);
  });

  it('rejects future timestamps outside the replay window', () => {
    const timestamp = '1777191000';
    const signature = createHmac('sha256', 'secret')
      .update(`task_123.${timestamp}`)
      .digest('base64');

    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp,
        signature,
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(false);
  });

  it('rejects non-numeric timestamps', () => {
    const timestamp = 'not-a-timestamp';
    const signature = createHmac('sha256', 'secret')
      .update(`task_123.${timestamp}`)
      .digest('base64');

    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp,
        signature,
        secret: 'secret',
        nowSeconds,
      }),
    ).toBe(false);
  });
});
