import { env } from '../../env/schema';
import { fileRepository } from '../../files/repository';
import { r2StorageAdapter } from '../../storage/r2';
import type { ProviderAdapter, ProviderJobInput } from '../types';
import { createKieClient, type FluxKontextCreateInput } from './client';

type KieImageEditClient = {
  createFluxKontextTask(input: FluxKontextCreateInput): Promise<{ taskId: string }>;
};

type CreateInputImageUrlArgs = {
  fileId: string;
  workspaceId: number;
};

type CreateKieImageEditProviderArgs = {
  client?: KieImageEditClient;
  callbackBaseUrl?: string;
  createInputImageUrl?: (args: CreateInputImageUrlArgs) => Promise<string>;
};

const DEFAULT_ASPECT_RATIO = '1:1';
const DEFAULT_OUTPUT_FORMAT = 'png';
const DEFAULT_MODEL = 'flux-kontext-pro';

export function createKieImageEditProvider(
  args: CreateKieImageEditProviderArgs = {},
): ProviderAdapter {
  return {
    name: 'kie-ai',
    async run(job) {
      const client = args.client ?? createKieClient({ apiKey: env.KIE_API_KEY });
      const callbackBaseUrl = args.callbackBaseUrl ?? env.KIE_CALLBACK_BASE_URL;
      const createInputImageUrl = args.createInputImageUrl ?? createDefaultInputImageUrl;
      const parsed = parseKieImageEditInput(job.input);

      if (!parsed) {
        return invalidInput('source_file_id and prompt are required.');
      }

      try {
        const inputImage = await createInputImageUrl({
          fileId: parsed.sourceFileId,
          workspaceId: job.workspaceId,
        });
        const task = await client.createFluxKontextTask({
          prompt: parsed.prompt,
          inputImage,
          aspectRatio: parsed.aspectRatio,
          outputFormat: parsed.outputFormat,
          model: parsed.model,
          callBackUrl: `${trimTrailingSlash(callbackBaseUrl)}/api/webhooks/kie/flux-kontext`,
        });

        return {
          status: 'submitted',
          providerTaskId: task.taskId,
        };
      } catch (error) {
        if (error instanceof KieInvalidInputError) {
          return invalidInput(error.message);
        }

        throw error;
      }
    },
  };
}

export const kieImageEditProvider = createKieImageEditProvider();

function parseKieImageEditInput(input: ProviderJobInput['input']) {
  const sourceFileId = input.source_file_id;
  const prompt = input.prompt;

  if (typeof sourceFileId !== 'string' || sourceFileId.trim().length === 0) {
    return null;
  }

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return null;
  }

  return {
    sourceFileId,
    prompt,
    aspectRatio: parseAspectRatio(input.aspect_ratio),
    outputFormat: parseOutputFormat(input.output_format),
    model: parseModel(input.model),
  };
}

function parseAspectRatio(input: unknown): FluxKontextCreateInput['aspectRatio'] {
  if (
    input === '21:9' ||
    input === '16:9' ||
    input === '4:3' ||
    input === '1:1' ||
    input === '3:4' ||
    input === '9:16'
  ) {
    return input;
  }

  return DEFAULT_ASPECT_RATIO;
}

function parseOutputFormat(input: unknown): FluxKontextCreateInput['outputFormat'] {
  if (input === 'jpeg' || input === 'png') {
    return input;
  }

  return DEFAULT_OUTPUT_FORMAT;
}

function parseModel(input: unknown): FluxKontextCreateInput['model'] {
  if (input === 'flux-kontext-pro' || input === 'flux-kontext-max') {
    return input;
  }

  return DEFAULT_MODEL;
}

async function createDefaultInputImageUrl(args: CreateInputImageUrlArgs) {
  const file = await fileRepository.getById(args.fileId);

  if (!file || file.workspaceId !== args.workspaceId || file.status !== 'uploaded') {
    throw new KieInvalidInputError('Source file must exist in the workspace and be uploaded.');
  }

  return r2StorageAdapter.createDownloadUrl({
    bucket: file.storageBucket,
    key: file.storageKey,
    responseContentType: file.mimeType,
  });
}

class KieInvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KieInvalidInputError';
  }
}

function invalidInput(errorMessage: string) {
  return {
    status: 'failed' as const,
    errorCode: 'KIE_INVALID_INPUT',
    errorMessage,
  };
}

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}
