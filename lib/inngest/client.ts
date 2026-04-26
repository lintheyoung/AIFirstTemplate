import { Inngest } from 'inngest';
import { projectConfig } from '../../config/project';

export const inngest = new Inngest({
  id: projectConfig.slug,
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
