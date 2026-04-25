import type { PlatformActor } from '../auth/actors';
import { echoProvider } from '../providers/echo';
import { exampleTransformProvider } from '../providers/example-transform';
import type { ProviderAdapter } from '../providers/types';
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

export async function runJobInline(args: {
  actor: PlatformActor;
  capabilityName: string;
  providerName: string;
  input: Record<string, unknown>;
}) {
  const jobId = createJobId();
  const provider = resolveProvider(args.providerName);
  const result = await provider.run({
    jobId,
    workspaceId: args.actor.workspaceId,
    capabilityName: args.capabilityName,
    input: args.input,
  });

  return {
    id: jobId,
    workspaceId: args.actor.workspaceId,
    capabilityName: args.capabilityName,
    providerName: provider.name,
    status: result.status === 'completed' ? 'succeeded' : 'failed',
    result: result.status === 'completed' ? result.result : null,
    errorCode: result.status === 'failed' ? result.errorCode : null,
    errorMessage: result.status === 'failed' ? result.errorMessage : null,
  };
}
