import { and, eq } from 'drizzle-orm';
import { db } from '../db/drizzle';
import { jobs, type ActorTypeValue, type JobStatusValue } from '../db/schema';

export type JobRecord = typeof jobs.$inferSelect;

export type CreateJobInput = {
  id: string;
  workspaceId: number;
  capabilityName: string;
  providerName: string;
  status: JobStatusValue;
  inputJson: string;
  sourceFileId?: string | null;
  createdByType: ActorTypeValue;
  createdById: string;
  idempotencyKey?: string | null;
};

export type JobRepository = {
  createJob(input: CreateJobInput): Promise<JobRecord>;
  getById(jobId: string): Promise<JobRecord | null>;
  setRunning(jobId: string): Promise<void>;
  setProviderTask(jobId: string, providerTaskId: string): Promise<void>;
  findByProviderTask(providerName: string, providerTaskId: string): Promise<JobRecord | null>;
  setSucceeded(
    jobId: string,
    resultFileId: string | null,
    result: Record<string, unknown>,
  ): Promise<void>;
  setFailed(jobId: string, errorCode: string, errorMessage: string): Promise<void>;
};

export const jobRepository: JobRepository = {
  async createJob(input) {
    const [record] = await db.insert(jobs).values(input).returning();
    return record;
  },
  async getById(jobId) {
    const [record] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return record ?? null;
  },
  async setRunning(jobId) {
    await db
      .update(jobs)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(jobs.id, jobId));
  },
  async setProviderTask(jobId, providerTaskId) {
    await db.update(jobs).set({ providerTaskId }).where(eq(jobs.id, jobId));
  },
  async findByProviderTask(providerName, providerTaskId) {
    const [record] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.providerName, providerName), eq(jobs.providerTaskId, providerTaskId)))
      .limit(1);
    return record ?? null;
  },
  async setSucceeded(jobId, resultFileId, result) {
    await db
      .update(jobs)
      .set({
        status: 'succeeded',
        resultFileId,
        resultJson: JSON.stringify(result),
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  },
  async setFailed(jobId, errorCode, errorMessage) {
    await db
      .update(jobs)
      .set({
        status: 'failed',
        errorCode,
        errorMessage,
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  },
};
