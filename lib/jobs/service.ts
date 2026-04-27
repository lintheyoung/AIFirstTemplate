import type { PlatformActor } from '../auth/actors';
import { createGeneratedImageFromUrl } from '../files/service';
import { echoProvider } from '../providers/echo';
import { exampleTransformProvider } from '../providers/example-transform';
import { kieImageEditProvider } from '../providers/kie/image-edit';
import type { ProviderAdapter } from '../providers/types';
import type { JobCreatedEvent } from '../queue/adapter';
import { ApiError } from '../request/errors';
import {
  jobRepository,
  type JobRecord,
  type JobRepository,
} from './repository';

const providers: Record<string, ProviderAdapter> = {
  echo: echoProvider,
  'example-transform': exampleTransformProvider,
  'kie-ai': kieImageEditProvider,
};
const terminalJobStatuses = new Set<JobRecord['status']>([
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
]);

export function createJobId(uuidFactory = () => crypto.randomUUID()) {
  return `job_${uuidFactory().replace(/-/g, '')}`;
}

export function resolveProvider(providerName: string) {
  const provider = providers[providerName];

  if (!provider) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: `Provider '${providerName}' is not registered.`,
      status: 404,
    });
  }

  return provider;
}

type JobEnvelope = {
  id: string;
  workspaceId: number;
  capabilityName: string;
  providerName: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type JobRunArgs = {
  jobId: string;
  workspaceId: number;
  capabilityName: string;
  providerName: string;
  input: Record<string, unknown>;
};

export function createQueuedJob(args: {
  actor: PlatformActor;
  capabilityName: string;
  providerName: string;
  input: Record<string, unknown>;
  repository?: JobRepository;
  uuidFactory?: () => string;
}): Promise<JobEnvelope> {
  const jobId = createJobId(args.uuidFactory);
  const provider = resolveProvider(args.providerName);
  const repository = args.repository ?? jobRepository;
  const sourceFileId =
    typeof args.input.source_file_id === 'string' ? args.input.source_file_id : null;

  return repository
    .createJob({
      id: jobId,
      workspaceId: args.actor.workspaceId,
      capabilityName: args.capabilityName,
      providerName: provider.name,
      status: 'queued',
      inputJson: JSON.stringify(args.input),
      sourceFileId,
      createdByType: args.actor.actorType,
      createdById: args.actor.actorId,
    })
    .then(jobToEnvelope);
}

function jobToEnvelope(job: Pick<
  JobRecord,
  | 'id'
  | 'workspaceId'
  | 'capabilityName'
  | 'providerName'
  | 'status'
  | 'resultJson'
  | 'errorCode'
  | 'errorMessage'
>): JobEnvelope {
  return {
    id: job.id,
    workspaceId: job.workspaceId,
    capabilityName: job.capabilityName,
    providerName: job.providerName,
    status: envelopeStatus(job.status),
    result: parseJobResult(job.resultJson),
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
  };
}

function envelopeStatus(status: JobRecord['status']): JobEnvelope['status'] {
  if (status === 'running' || status === 'succeeded' || status === 'failed') {
    return status;
  }

  return 'queued';
}

function parseJobResult(resultJson: string | null) {
  if (!resultJson) {
    return null;
  }

  return JSON.parse(resultJson) as Record<string, unknown>;
}

export async function getJobForActor(args: {
  actor: PlatformActor;
  jobId: string;
  repository?: JobRepository;
}) {
  const repository = args.repository ?? jobRepository;
  const job = await repository.getById(args.jobId);

  if (!job || job.workspaceId !== args.actor.workspaceId) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Job was not found.',
      status: 404,
    });
  }

  return job;
}

export async function runProviderJob(args: JobRunArgs): Promise<JobEnvelope> {
  const provider = resolveProvider(args.providerName);
  const result = await provider.run({
    jobId: args.jobId,
    workspaceId: args.workspaceId,
    capabilityName: args.capabilityName,
    input: args.input,
  });

  return {
    id: args.jobId,
    workspaceId: args.workspaceId,
    capabilityName: args.capabilityName,
    providerName: provider.name,
    status: providerResultStatus(result.status),
    result: providerResultValue(result),
    errorCode: result.status === 'failed' ? result.errorCode : null,
    errorMessage: result.status === 'failed' ? result.errorMessage : null,
  };
}

function providerResultStatus(status: 'completed' | 'failed' | 'submitted'): JobEnvelope['status'] {
  if (status === 'completed') {
    return 'succeeded';
  }

  if (status === 'submitted') {
    return 'running';
  }

  return 'failed';
}

function providerResultValue(
  result: Awaited<ReturnType<ProviderAdapter['run']>>,
): Record<string, unknown> | null {
  if (result.status === 'completed') {
    return result.result;
  }

  if (result.status === 'submitted') {
    return { provider_task_id: result.providerTaskId };
  }

  return null;
}

export async function runJobInline(args: {
  actor: PlatformActor;
  capabilityName: string;
  providerName: string;
  input: Record<string, unknown>;
}) {
  const jobId = createJobId();

  return runProviderJob({
    jobId,
    workspaceId: args.actor.workspaceId,
    capabilityName: args.capabilityName,
    providerName: args.providerName,
    input: args.input,
  });
}

export async function runJobFromEvent(event: JobCreatedEvent) {
  return runProviderJob({
    jobId: event.jobId,
    workspaceId: event.workspaceId,
    capabilityName: event.capabilityName,
    providerName: event.providerName,
    input: event.input,
  });
}

export async function handleKieFluxCallback(args: {
  taskId: string;
  code: number;
  message: string;
  resultImageUrl?: string;
  repository?: JobRepository;
  createGeneratedImage?: typeof createGeneratedImageFromUrl;
}) {
  const repository = args.repository ?? jobRepository;
  const createGeneratedImage = args.createGeneratedImage ?? createGeneratedImageFromUrl;
  const job = await repository.findByProviderTask('kie-ai', args.taskId);

  if (!job) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: 'kie.ai task was not found.',
      status: 404,
    });
  }

  if (terminalJobStatuses.has(job.status)) {
    return;
  }

  if (args.code !== 200 || !args.resultImageUrl) {
    await repository.setFailed(job.id, `KIE_${args.code}`, args.message);
    return;
  }

  const outputFormat = desiredKieOutputFormat(job.inputJson);
  const generated = await createGeneratedImage({
    workspaceId: job.workspaceId,
    sourceUrl: args.resultImageUrl,
    filename: `${job.id}.${outputFormat}`,
    mimeType: `image/${outputFormat}`,
  });

  await repository.setSucceeded(job.id, generated.fileId, {
    provider_task_id: args.taskId,
    result_file_id: generated.fileId,
  });
}

function desiredKieOutputFormat(inputJson: string): 'jpeg' | 'png' {
  try {
    const input = JSON.parse(inputJson) as { output_format?: unknown };
    return input.output_format === 'jpeg' ? 'jpeg' : 'png';
  } catch {
    return 'png';
  }
}
