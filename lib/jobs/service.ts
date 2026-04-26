import type { PlatformActor } from '../auth/actors';
import { echoProvider } from '../providers/echo';
import { exampleTransformProvider } from '../providers/example-transform';
import type { ProviderAdapter } from '../providers/types';
import type { JobCreatedEvent } from '../queue/adapter';
import { ApiError } from '../request/errors';

const providers: Record<string, ProviderAdapter> = {
  echo: echoProvider,
  'example-transform': exampleTransformProvider,
};

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
  status: 'queued' | 'succeeded' | 'failed';
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
  uuidFactory?: () => string;
}): JobEnvelope {
  const jobId = createJobId(args.uuidFactory);
  const provider = resolveProvider(args.providerName);

  return {
    id: jobId,
    workspaceId: args.actor.workspaceId,
    capabilityName: args.capabilityName,
    providerName: provider.name,
    status: 'queued',
    result: null,
    errorCode: null,
    errorMessage: null,
  };
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
    status: result.status === 'completed' ? 'succeeded' : 'failed',
    result: result.status === 'completed' ? result.result : null,
    errorCode: result.status === 'failed' ? result.errorCode : null,
    errorMessage: result.status === 'failed' ? result.errorMessage : null,
  };
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
