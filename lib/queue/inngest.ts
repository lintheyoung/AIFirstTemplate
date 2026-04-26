import type { JobCreatedEvent, QueueAdapter } from './adapter';
import { inngest } from '../inngest/client';

type InngestSend = (event: {
  name: 'job.created';
  data: JobCreatedEvent;
}) => Promise<unknown>;

export function createInngestQueueAdapter(args: { send: InngestSend }): QueueAdapter {
  return {
    async emitJobCreated(event) {
      await args.send({
        name: 'job.created',
        data: event,
      });
    },
  };
}

export const inngestQueueAdapter = createInngestQueueAdapter({
  send: inngest.send.bind(inngest),
});
