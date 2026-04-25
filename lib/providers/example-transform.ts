import type { ProviderAdapter } from './types';

export const exampleTransformProvider: ProviderAdapter = {
  name: 'example-transform',
  async run(job) {
    const inputFileId = job.input.input_file_id;

    if (typeof inputFileId !== 'string' || inputFileId.length === 0) {
      return {
        status: 'failed',
        errorCode: 'VALIDATION_INVALID_BODY',
        errorMessage: 'input_file_id is required.',
      };
    }

    return {
      status: 'completed',
      result: {
        output: {
          filename: `${inputFileId}.result.json`,
          mimeType: 'application/json',
          sourceFileId: inputFileId,
          storageKey: `ws/${job.workspaceId}/output/${job.jobId}/${inputFileId}.result.json`,
        },
      },
    };
  },
};
