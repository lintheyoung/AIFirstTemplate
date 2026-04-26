import type { PlatformActor } from '../auth/actors';

export type JobCreatedEvent = {
  jobId: string;
  workspaceId: number;
  capabilityName: string;
  providerName: string;
  input: Record<string, unknown>;
  actor: PlatformActor;
};

export type QueueAdapter = {
  emitJobCreated(event: JobCreatedEvent): Promise<void>;
};
