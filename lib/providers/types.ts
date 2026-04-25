export type ProviderJobInput = {
  jobId: string;
  workspaceId: number;
  capabilityName: string;
  input: Record<string, unknown>;
};

export type ProviderCompletedResult = {
  status: 'completed';
  result: Record<string, unknown>;
  metrics?: Record<string, number>;
};

export type ProviderFailedResult = {
  status: 'failed';
  errorCode: string;
  errorMessage: string;
};

export type ProviderResult = ProviderCompletedResult | ProviderFailedResult;

export type ProviderAdapter = {
  name: string;
  run(input: ProviderJobInput): Promise<ProviderResult>;
};
