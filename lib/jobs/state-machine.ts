import { jobStatusValues, type JobStatusValue } from '../db/schema';

export type JobStatus = JobStatusValue;

export const jobStateMachineStatuses = jobStatusValues;

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  queued: ['dispatching', 'cancelled'],
  dispatching: ['running', 'succeeded', 'failed', 'timed_out'],
  running: ['succeeded', 'failed', 'timed_out', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
  timed_out: [],
};

export function isTerminalJobStatus(status: JobStatus) {
  return (
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'timed_out'
  );
}

export function assertJobTransition(current: JobStatus, next: JobStatus) {
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Invalid job status transition from '${current}' to '${next}'.`);
  }
}
