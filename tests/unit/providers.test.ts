import { describe, expect, it } from 'vitest';
import { echoProvider } from '../../lib/providers/echo';
import { exampleTransformProvider } from '../../lib/providers/example-transform';
import { createKieImageEditProvider } from '../../lib/providers/kie/image-edit';

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

  it('kie image edit provider submits a Flux Kontext task', async () => {
    const createdTasks: unknown[] = [];
    const provider = createKieImageEditProvider({
      callbackBaseUrl: 'https://app.example.test',
      client: {
        async createFluxKontextTask(input) {
          createdTasks.push(input);
          return { taskId: 'kie_task_123' };
        },
      },
      async createInputImageUrl(args) {
        expect(args).toEqual({
          fileId: 'file_source',
          workspaceId: 7,
        });
        return 'https://files.example.test/source.png?signature=test';
      },
    });

    await expect(
      provider.run({
        jobId: 'job_789',
        workspaceId: 7,
        capabilityName: 'image.edit',
        input: {
          source_file_id: 'file_source',
          prompt: 'make the kitchen brighter',
        },
      }),
    ).resolves.toEqual({
      status: 'submitted',
      providerTaskId: 'kie_task_123',
    });

    expect(createdTasks).toEqual([
      {
        prompt: 'make the kitchen brighter',
        inputImage: 'https://files.example.test/source.png?signature=test',
        aspectRatio: '1:1',
        outputFormat: 'png',
        model: 'flux-kontext-pro',
        callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
      },
    ]);
  });

  it('kie image edit provider returns a stable failure for invalid input', async () => {
    const provider = createKieImageEditProvider({
      callbackBaseUrl: 'https://app.example.test',
      client: {
        async createFluxKontextTask() {
          throw new Error('client should not be called');
        },
      },
      async createInputImageUrl() {
        throw new Error('file lookup should not be called');
      },
    });

    await expect(
      provider.run({
        jobId: 'job_789',
        workspaceId: 7,
        capabilityName: 'image.edit',
        input: {
          source_file_id: '',
          prompt: '',
        },
      }),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'KIE_INVALID_INPUT',
      errorMessage: 'source_file_id and prompt are required.',
    });
  });
});
