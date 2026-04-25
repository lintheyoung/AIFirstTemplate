import type { ProviderAdapter } from './types';

export const echoProvider: ProviderAdapter = {
  name: 'echo',
  async run(job) {
    return {
      status: 'completed',
      result: {
        echo: job.input,
      },
    };
  },
};
