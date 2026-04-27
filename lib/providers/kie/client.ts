import { ApiError } from '../../request/errors';

const FLUX_KONTEXT_GENERATE_URL =
  'https://api.kie.ai/api/v1/flux/kontext/generate';

export type KieFetch = typeof fetch;

export type FluxKontextCreateInput = {
  prompt: string;
  inputImage: string;
  aspectRatio?: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
  outputFormat?: 'jpeg' | 'png';
  model?: 'flux-kontext-pro' | 'flux-kontext-max';
  callBackUrl: string;
};

type KieCreateTaskResponse = {
  code?: number;
  data?: {
    taskId?: unknown;
  } | null;
};

export function createKieClient(args: { apiKey: string; fetchImpl?: KieFetch }) {
  const fetchImpl = args.fetchImpl ?? fetch;

  return {
    async createFluxKontextTask(input: FluxKontextCreateInput) {
      let response: Response;
      try {
        response = await fetchImpl(FLUX_KONTEXT_GENERATE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${args.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: input.prompt,
            inputImage: input.inputImage,
            enableTranslation: true,
            aspectRatio: input.aspectRatio,
            outputFormat: input.outputFormat ?? 'png',
            promptUpsampling: false,
            model: input.model ?? 'flux-kontext-pro',
            callBackUrl: input.callBackUrl,
          }),
        });
      } catch (error) {
        throw createKieCreateTaskError({
          transportError: error instanceof Error ? error.message : String(error),
        });
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = { parseError: 'Invalid JSON response from kie.ai.' };
      }

      if (!isValidCreateTaskResponse(response, payload)) {
        throw createKieCreateTaskError(payload);
      }

      return { taskId: String(payload.data.taskId) };
    },
  };
}

function isValidCreateTaskResponse(
  response: Response,
  payload: unknown,
): payload is KieCreateTaskResponse & {
  code: 200;
  data: { taskId: string | number };
} {
  if (!response.ok || !payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as KieCreateTaskResponse;

  return candidate.code === 200 && isValidTaskId(candidate.data?.taskId);
}

function isValidTaskId(taskId: unknown): taskId is string | number {
  if (typeof taskId === 'string') {
    return taskId.trim().length > 0;
  }

  return typeof taskId === 'number' && Number.isFinite(taskId);
}

function createKieCreateTaskError(response: unknown) {
  return new ApiError({
    code: 'INTERNAL_ERROR',
    status: 502,
    message: 'kie.ai failed to create an image task.',
    details: { provider: 'kie-ai', response },
  });
}
