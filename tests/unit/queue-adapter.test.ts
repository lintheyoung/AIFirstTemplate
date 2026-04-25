import { describe, expect, it, vi } from 'vitest';
import { createInngestQueueAdapter } from '../../lib/queue/inngest';

describe('queue adapter', () => {
  it('emits job.created events through the configured sender', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const adapter = createInngestQueueAdapter({ send });

    await adapter.emitJobCreated({
      jobId: 'job_123',
      workspaceId: 7,
      capabilityName: 'example.echo',
    });

    expect(send).toHaveBeenCalledWith({
      name: 'job.created',
      data: {
        jobId: 'job_123',
        workspaceId: 7,
        capabilityName: 'example.echo',
      },
    });
  });
});
