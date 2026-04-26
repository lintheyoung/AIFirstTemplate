import { runJobFromEvent } from '../jobs/service';
import { inngest } from './client';

export const runJobCreated = inngest.createFunction(
  { id: 'run-job-created' },
  { event: 'job.created' },
  async ({ event, step }) => {
    return step.run('run provider job', () => runJobFromEvent(event.data));
  },
);

export const functions = [runJobCreated];
