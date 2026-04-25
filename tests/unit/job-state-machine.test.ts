import { describe, expect, it } from 'vitest';
import { jobStatusValues } from '../../lib/db/schema';
import {
  assertJobTransition,
  jobStateMachineStatuses,
  isTerminalJobStatus,
} from '../../lib/jobs/state-machine';

describe('job state machine', () => {
  it('keeps state machine statuses aligned with the schema contract', () => {
    expect(jobStateMachineStatuses).toEqual(jobStatusValues);
  });

  it('allows queued jobs to dispatch', () => {
    expect(() => assertJobTransition('queued', 'dispatching')).not.toThrow();
  });

  it('rejects terminal jobs returning to queued', () => {
    expect(() => assertJobTransition('succeeded', 'queued')).toThrow(
      "Invalid job status transition from 'succeeded' to 'queued'.",
    );
  });

  it('identifies terminal statuses', () => {
    expect(isTerminalJobStatus('succeeded')).toBe(true);
    expect(isTerminalJobStatus('running')).toBe(false);
  });
});
