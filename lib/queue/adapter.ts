export type JobCreatedEvent = {
  jobId: string;
  workspaceId: number;
  capabilityName: string;
};

export type QueueAdapter = {
  emitJobCreated(event: JobCreatedEvent): Promise<void>;
};
