import { describe, expect, it } from 'vitest';
import { echoProvider } from '../../lib/providers/echo';
import { exampleTransformProvider } from '../../lib/providers/example-transform';

describe('providers', () => {
  it('echo provider returns the submitted input', async () => {
    await expect(
      echoProvider.run({
        jobId: 'job_123',
        workspaceId: 1,
        capabilityName: 'example.echo',
        input: { message: 'hello' },
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      result: {
        echo: { message: 'hello' },
      },
    });
  });

  it('example transform provider returns a derived output description', async () => {
    await expect(
      exampleTransformProvider.run({
        jobId: 'job_456',
        workspaceId: 7,
        capabilityName: 'example.file_transform',
        input: { input_file_id: 'file_abc' },
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      result: {
        output: {
          filename: 'file_abc.result.json',
          sourceFileId: 'file_abc',
        },
      },
    });
  });
});
