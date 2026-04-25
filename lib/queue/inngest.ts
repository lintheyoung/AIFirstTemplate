import type { JobCreatedEvent, QueueAdapter } from './adapter';

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
