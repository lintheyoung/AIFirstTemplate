# Kie Image Edit Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in app user upload their own image, submit a prompt to kie.ai Flux Kontext, and receive a generated image saved back into this backend's R2 storage.

**Architecture:** Keep the mobile app thin: it authenticates with Clerk, uploads source images to R2 through this backend, creates an async image-edit job, and polls this backend for status. The backend persists file and job state in Postgres, submits Flux Kontext work to kie.ai from an Inngest function, accepts verified kie.ai callbacks, downloads the short-lived generated image, stores it in R2, and exposes the final result through `/api/v1/jobs/:id`.

**Tech Stack:** Next.js App Router, Clerk, Drizzle/Postgres, Cloudflare R2 S3 client, Inngest, kie.ai Flux Kontext API, Vitest.

---

## External Contract Summary

- kie.ai create task endpoint: `POST https://api.kie.ai/api/v1/flux/kontext/generate`
- kie.ai task query endpoint: `GET https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=<taskId>`
- Authentication: `Authorization: Bearer ${KIE_API_KEY}`
- Image edit mode requires `prompt` and `inputImage`.
- `inputImage` must be a URL accessible to kie.ai's servers.
- `callBackUrl` should point to this backend, for example `https://app.pest.gg/api/webhooks/kie/flux-kontext`.
- Successful callback shape:

```json
{
  "code": 200,
  "msg": "BFL image generated successfully.",
  "data": {
    "taskId": "task12345",
    "info": {
      "originImageUrl": "https://example.com/original.jpg",
      "resultImageUrl": "https://example.com/result.jpg"
    }
  }
}
```

- Failed callback codes to map: `400` content policy violation, `500` internal error, `501` generation failed.
- Webhook verification, when enabled: compare `X-Webhook-Signature` to `base64(HMAC-SHA256(taskId + "." + X-Webhook-Timestamp, KIE_WEBHOOK_HMAC_KEY))` using constant-time comparison.

## File Structure

- Modify `lib/env/schema.ts`: add kie.ai env variables and keep validation centralized.
- Modify `.env.example`, `.env.test.example`, `.env.production.example`: document the new required secrets and callback base.
- Modify `lib/db/schema.ts`: add columns needed to find a job by kie.ai task ID and store source/result file references.
- Create `lib/files/repository.ts`: durable file insert, lookup, status update, and generated result file creation.
- Modify `lib/files/service.ts`: persist upload intents and add source/result file helpers.
- Modify `lib/storage/adapter.ts` and `lib/storage/r2.ts`: add signed download and direct object write support for source/result image workflows.
- Create `app/api/v1/files/[fileId]/complete/route.ts`: app confirms direct upload finished before using the file as image input.
- Modify `lib/jobs/service.ts`: persist jobs, transition states, submit async work, and expose job read model.
- Create `lib/jobs/repository.ts`: durable job insert, status transition, provider task ID lookup, and result update.
- Modify `app/api/v1/jobs/route.ts`: use durable job creation for async jobs.
- Create `app/api/v1/jobs/[jobId]/route.ts`: app polls job state and final result.
- Modify `app/api/v1/capabilities/route.ts`: advertise `image.edit` with provider `kie-ai`.
- Create `lib/providers/kie/client.ts`: typed kie.ai HTTP client.
- Create `lib/providers/kie/webhook.ts`: callback payload parsing and HMAC verification.
- Create `lib/providers/kie/image-edit.ts`: provider adapter that submits Flux Kontext tasks.
- Modify `lib/providers/types.ts`: support a provider result that means "submitted to remote async provider".
- Modify `lib/inngest/functions.ts`: submit async kie.ai work and update job state.
- Create `app/api/webhooks/kie/flux-kontext/route.ts`: verify kie.ai callback, acknowledge quickly, and update the job.
- Add tests under `tests/unit` and `tests/integration` listed in the tasks below.
- Update `docs/api-authoring-playbook.md`, `docs/provider-authoring-playbook.md`, `docs/tool-authoring-playbook.md`, and `README.md` so Symphony and humans know how to add image providers later.

---

## Task 1: Env Contract For Kie.ai

**Files:**
- Modify: `lib/env/schema.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `.env.production.example`
- Test: `tests/unit/env-schema.test.ts`

- [ ] **Step 1: Add failing env tests**

Add this test case to `tests/unit/env-schema.test.ts`:

```ts
it('requires kie.ai image provider settings', () => {
  const env = validEnv();

  expect(parseAppEnv(env)).toMatchObject({
    KIE_API_KEY: 'kie_test_key',
    KIE_CALLBACK_BASE_URL: 'https://example.test',
    KIE_WEBHOOK_HMAC_KEY: 'kie_hmac_key',
  });
});
```

If `validEnv()` does not exist, extend the existing valid env fixture with:

```ts
KIE_API_KEY: 'kie_test_key',
KIE_CALLBACK_BASE_URL: 'https://example.test',
KIE_WEBHOOK_HMAC_KEY: 'kie_hmac_key',
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- tests/unit/env-schema.test.ts
```

Expected: FAIL because `KIE_API_KEY`, `KIE_CALLBACK_BASE_URL`, and `KIE_WEBHOOK_HMAC_KEY` are not in `AppEnv`.

- [ ] **Step 3: Extend env schema**

In `lib/env/schema.ts`, add these fields to `appEnvSchema`:

```ts
KIE_API_KEY: z.string().min(1),
KIE_CALLBACK_BASE_URL: z.string().url(),
KIE_WEBHOOK_HMAC_KEY: z.string().min(1),
```

- [ ] **Step 4: Update env examples**

Add these lines to `.env.example`, `.env.test.example`, and `.env.production.example`:

```dotenv
KIE_API_KEY=replace_me
KIE_CALLBACK_BASE_URL=http://localhost:3024
KIE_WEBHOOK_HMAC_KEY=replace_me
```

For `.env.test.example`, use:

```dotenv
KIE_CALLBACK_BASE_URL=https://test.app.pest.gg
```

For `.env.production.example`, use:

```dotenv
KIE_CALLBACK_BASE_URL=https://app.pest.gg
```

- [ ] **Step 5: Verify env tests pass**

Run:

```bash
npm test -- tests/unit/env-schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/env/schema.ts .env.example .env.test.example .env.production.example tests/unit/env-schema.test.ts
git commit -m "feat: add kie image provider env contract"
```

---

## Task 2: Storage And File Persistence Foundation

**Files:**
- Create: `lib/files/repository.ts`
- Modify: `lib/files/service.ts`
- Modify: `lib/storage/adapter.ts`
- Modify: `lib/storage/r2.ts`
- Modify: `lib/db/schema.ts`
- Test: `tests/unit/files-service.test.ts`

- [ ] **Step 1: Add failing file persistence tests**

Add tests to `tests/unit/files-service.test.ts` for persisted upload intents:

```ts
it('creates a pending upload record before returning a signed upload URL', async () => {
  const inserted: unknown[] = [];
  const repository = {
    async createPendingUpload(input: unknown) {
      inserted.push(input);
    },
  };
  const storage = {
    async createUploadUrl() {
      return {
        url: 'https://upload.example.test/source',
        headers: { 'content-type': 'image/png' },
      };
    },
    async createDownloadUrl() {
      return 'https://download.example.test/source';
    },
    async putObject() {
      return undefined;
    },
    publicUrl() {
      return 'https://files.example.test/result.png';
    },
  };

  const upload = await createUploadIntent({
    actor: {
      actorType: 'user',
      actorId: 'user_123',
      workspaceId: 1,
      scopes: ['*'],
    },
    input: {
      filename: 'source image.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      visibility: 'private',
    },
    storage,
    storageBucket: 'test-bucket',
    repository,
    uuidFactory: () => '00000000-0000-0000-0000-000000000001',
  });

  expect(upload.fileId).toBe('file_00000000000000000000000000000001');
  expect(inserted).toEqual([
    expect.objectContaining({
      id: 'file_00000000000000000000000000000001',
      workspaceId: 1,
      filename: 'source image.png',
      mimeType: 'image/png',
      storageBucket: 'test-bucket',
      storageKey: 'ws/1/input/file_00000000000000000000000000000001/source-image.png',
      status: 'pending_upload',
    }),
  ]);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- tests/unit/files-service.test.ts
```

Expected: FAIL because `repository` injection and `putObject` are not supported yet.

- [ ] **Step 3: Extend storage adapter type**

Update `lib/storage/adapter.ts` so `StorageAdapter` includes:

```ts
createDownloadUrl(args: {
  bucket: string;
  key: string;
  responseContentType?: string;
}): Promise<string>;
putObject(args: {
  bucket: string;
  key: string;
  body: Uint8Array;
  mimeType: string;
}): Promise<void>;
publicUrl(args: { key: string }): string | null;
```

- [ ] **Step 4: Implement R2 direct object write**

In `lib/storage/r2.ts`, import `PutObjectCommand` if not already imported and implement:

```ts
async putObject(args) {
  await createClient().send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.mimeType,
    }),
  );
},
```

- [ ] **Step 5: Create file repository**

Create `lib/files/repository.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/drizzle';
import { files, type ActorTypeValue, type FileStatusValue, type FileVisibilityValue } from '../db/schema';

export type FileRecord = typeof files.$inferSelect;

export type CreateFileRecordInput = {
  id: string;
  workspaceId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  visibility: FileVisibilityValue;
  status: FileStatusValue;
  metadataJson?: string;
  uploadedByType: ActorTypeValue;
  uploadedById: string;
};

export type FileRepository = {
  createPendingUpload(input: CreateFileRecordInput): Promise<void>;
  markUploaded(fileId: string): Promise<FileRecord | null>;
  getById(fileId: string): Promise<FileRecord | null>;
  createGeneratedFile(input: CreateFileRecordInput): Promise<void>;
};

export const fileRepository: FileRepository = {
  async createPendingUpload(input) {
    await db.insert(files).values({ ...input, metadataJson: input.metadataJson ?? '{}' });
  },
  async markUploaded(fileId) {
    const [record] = await db
      .update(files)
      .set({ status: 'uploaded', updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning();

    return record ?? null;
  },
  async getById(fileId) {
    const [record] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    return record ?? null;
  },
  async createGeneratedFile(input) {
    await db.insert(files).values({ ...input, metadataJson: input.metadataJson ?? '{}' });
  },
};
```

- [ ] **Step 6: Inject repository into file service**

In `lib/files/service.ts`, import `fileRepository` and add an optional `repository` arg to `createUploadIntent`. After computing `storageKey`, call:

```ts
const repository = args.repository ?? fileRepository;
await repository.createPendingUpload({
  id: fileId,
  workspaceId: args.actor.workspaceId,
  filename: args.input.filename,
  mimeType: args.input.mimeType,
  sizeBytes: args.input.sizeBytes,
  storageProvider: 'r2',
  storageBucket,
  storageKey,
  visibility,
  status: 'pending_upload',
  uploadedByType: args.actor.actorType,
  uploadedById: args.actor.actorId,
});
```

- [ ] **Step 7: Verify focused tests pass**

Run:

```bash
npm test -- tests/unit/files-service.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/files/repository.ts lib/files/service.ts lib/storage/adapter.ts lib/storage/r2.ts lib/db/schema.ts tests/unit/files-service.test.ts
git commit -m "feat: persist file upload intents"
```

---

## Task 3: File Upload Completion Endpoint

**Files:**
- Create: `app/api/v1/files/[fileId]/complete/route.ts`
- Modify: `lib/files/service.ts`
- Test: `tests/integration/api-v1-routes.test.ts`

- [ ] **Step 1: Add failing route test**

In `tests/integration/api-v1-routes.test.ts`, mock `completeUploadIntent` from `@/lib/files/service` and add:

```ts
it('marks an uploaded source file as uploaded', async () => {
  completeUploadIntent.mockResolvedValue({
    fileId: 'file_source',
    status: 'uploaded',
  });

  const response = await completeUpload(
    new Request('https://example.test/api/v1/files/file_source/complete', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req_test',
      },
      body: '{}',
    }),
    { params: Promise.resolve({ fileId: 'file_source' }) },
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toEqual({
    data: {
      file_id: 'file_source',
      status: 'uploaded',
    },
    request_id: 'req_test',
  });
});
```

- [ ] **Step 2: Run route test and confirm failure**

Run:

```bash
npm test -- tests/integration/api-v1-routes.test.ts
```

Expected: FAIL because the route and service function do not exist.

- [ ] **Step 3: Add service function**

In `lib/files/service.ts`, add:

```ts
export async function completeUploadIntent(args: {
  actor: PlatformActor;
  fileId: string;
  repository?: FileRepository;
}) {
  const repository = args.repository ?? fileRepository;
  const file = await repository.getById(args.fileId);

  if (!file || file.workspaceId !== args.actor.workspaceId) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: 'File was not found.',
      status: 404,
    });
  }

  const updated = await repository.markUploaded(args.fileId);

  return {
    fileId: args.fileId,
    status: updated?.status ?? 'uploaded',
  };
}
```

Also import `ApiError` and `FileRepository`.

- [ ] **Step 4: Add route**

Create `app/api/v1/files/[fileId]/complete/route.ts`:

```ts
import { requireClerkActor } from '@/lib/auth/clerk-actor';
import { completeUploadIntent } from '@/lib/files/service';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

export async function POST(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = await requireClerkActor();
    const { fileId } = await context.params;
    const result = await completeUploadIntent({ actor, fileId });

    return successResponse(
      {
        file_id: result.fileId,
        status: result.status,
      },
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
```

- [ ] **Step 5: Verify route tests pass**

Run:

```bash
npm test -- tests/integration/api-v1-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/v1/files/[fileId]/complete/route.ts lib/files/service.ts tests/integration/api-v1-routes.test.ts
git commit -m "feat: add file upload completion route"
```

---

## Task 4: Kie.ai Client And Webhook Verification

**Files:**
- Create: `lib/providers/kie/client.ts`
- Create: `lib/providers/kie/webhook.ts`
- Test: `tests/unit/kie-client.test.ts`
- Test: `tests/unit/kie-webhook.test.ts`

- [ ] **Step 1: Add failing client tests**

Create `tests/unit/kie-client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createKieClient } from '../../lib/providers/kie/client';

describe('kie client', () => {
  it('submits a Flux Kontext image edit task', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        code: 200,
        msg: 'success',
        data: { taskId: 'task_123' },
      }),
    );
    const client = createKieClient({
      apiKey: 'kie_key',
      fetchImpl,
    });

    const result = await client.createFluxKontextTask({
      prompt: 'make it cinematic',
      inputImage: 'https://files.example.test/source.png',
      aspectRatio: '1:1',
      outputFormat: 'png',
      model: 'flux-kontext-pro',
      callBackUrl: 'https://app.example.test/api/webhooks/kie/flux-kontext',
    });

    expect(result).toEqual({ taskId: 'task_123' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.kie.ai/api/v1/flux/kontext/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer kie_key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Add failing webhook tests**

Create `tests/unit/kie-webhook.test.ts`:

```ts
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyKieWebhookSignature } from '../../lib/providers/kie/webhook';

describe('kie webhook verification', () => {
  it('accepts a valid HMAC signature', () => {
    const signature = createHmac('sha256', 'secret')
      .update('task_123.1777190000')
      .digest('base64');

    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: '1777190000',
        signature,
        secret: 'secret',
      }),
    ).toBe(true);
  });

  it('rejects an invalid HMAC signature', () => {
    expect(
      verifyKieWebhookSignature({
        taskId: 'task_123',
        timestamp: '1777190000',
        signature: 'invalid',
        secret: 'secret',
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
npm test -- tests/unit/kie-client.test.ts tests/unit/kie-webhook.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement kie client**

Create `lib/providers/kie/client.ts`:

```ts
import { ApiError } from '../../request/errors';

export type KieFetch = typeof fetch;

export type FluxKontextCreateInput = {
  prompt: string;
  inputImage: string;
  aspectRatio?: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
  outputFormat?: 'jpeg' | 'png';
  model?: 'flux-kontext-pro' | 'flux-kontext-max';
  callBackUrl: string;
};

export function createKieClient(args: { apiKey: string; fetchImpl?: KieFetch }) {
  const fetchImpl = args.fetchImpl ?? fetch;

  return {
    async createFluxKontextTask(input: FluxKontextCreateInput) {
      const response = await fetchImpl('https://api.kie.ai/api/v1/flux/kontext/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.prompt,
          inputImage: input.inputImage,
          enableTranslation: true,
          aspectRatio: input.aspectRatio,
          outputFormat: input.outputFormat ?? 'png',
          promptUpsampling: false,
          model: input.model ?? 'flux-kontext-pro',
          callBackUrl: input.callBackUrl,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.code !== 200 || !payload.data?.taskId) {
        throw new ApiError({
          code: 'INTERNAL_ERROR',
          message: 'kie.ai failed to create an image task.',
          status: 502,
          details: { provider: 'kie-ai', response: payload },
        });
      }

      return { taskId: String(payload.data.taskId) };
    },
  };
}
```

- [ ] **Step 5: Implement webhook verification**

Create `lib/providers/kie/webhook.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type KieFluxCallback = {
  code: number;
  msg: string;
  data: {
    taskId: string;
    info?: {
      originImageUrl?: string;
      resultImageUrl?: string;
    };
  };
};

export function verifyKieWebhookSignature(args: {
  taskId: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
}) {
  if (!args.timestamp || !args.signature || !args.secret) {
    return false;
  }

  const expected = createHmac('sha256', args.secret)
    .update(`${args.taskId}.${args.timestamp}`)
    .digest('base64');

  const actualBuffer = Buffer.from(args.signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
npm test -- tests/unit/kie-client.test.ts tests/unit/kie-webhook.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/providers/kie/client.ts lib/providers/kie/webhook.ts tests/unit/kie-client.test.ts tests/unit/kie-webhook.test.ts
git commit -m "feat: add kie client and webhook verification"
```

---

## Task 5: Durable Job Repository And Job Read API

**Files:**
- Create: `lib/jobs/repository.ts`
- Modify: `lib/jobs/service.ts`
- Modify: `lib/db/schema.ts`
- Modify: `app/api/v1/jobs/route.ts`
- Create: `app/api/v1/jobs/[jobId]/route.ts`
- Test: `tests/unit/jobs-service.test.ts`
- Test: `tests/integration/api-v1-routes.test.ts`

- [ ] **Step 1: Add job schema fields**

In `lib/db/schema.ts`, add these columns to `jobs`:

```ts
sourceFileId: varchar('source_file_id', { length: 64 }).references(() => files.id),
resultFileId: varchar('result_file_id', { length: 64 }).references(() => files.id),
providerTaskId: varchar('provider_task_id', { length: 255 }),
```

Add indexes:

```ts
providerTaskIdx: index('jobs_provider_task_idx').on(table.providerName, table.providerTaskId),
```

- [ ] **Step 2: Add failing service tests**

In `tests/unit/jobs-service.test.ts`, add:

```ts
it('creates a durable async image edit job with source file metadata', async () => {
  const created: unknown[] = [];
  const repository = {
    async createJob(input: unknown) {
      created.push(input);
      return input;
    },
  };

  const job = await createQueuedJob({
    actor: {
      actorType: 'user',
      actorId: 'user_123',
      workspaceId: 1,
      scopes: ['*'],
    },
    capabilityName: 'image.edit',
    providerName: 'kie-ai',
    input: {
      source_file_id: 'file_source',
      prompt: 'make it cinematic',
    },
    repository,
    uuidFactory: () => '00000000-0000-0000-0000-000000000002',
  });

  expect(job.id).toBe('job_00000000000000000000000000000002');
  expect(created).toEqual([
    expect.objectContaining({
      id: 'job_00000000000000000000000000000002',
      workspaceId: 1,
      capabilityName: 'image.edit',
      providerName: 'kie-ai',
      status: 'queued',
      sourceFileId: 'file_source',
    }),
  ]);
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
npm test -- tests/unit/jobs-service.test.ts
```

Expected: FAIL because durable repository injection is not supported.

- [ ] **Step 4: Create job repository**

Create `lib/jobs/repository.ts`:

```ts
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
  setSucceeded(jobId: string, resultFileId: string, result: Record<string, unknown>): Promise<void>;
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
    await db.update(jobs).set({ status: 'running', startedAt: new Date() }).where(eq(jobs.id, jobId));
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
```

- [ ] **Step 5: Persist queued jobs**

Modify `createQueuedJob()` in `lib/jobs/service.ts` to accept `repository?: JobRepository`, persist the job, and return the persisted envelope. Extract `source_file_id` from input when it is a string:

```ts
const sourceFileId =
  typeof args.input.source_file_id === 'string' ? args.input.source_file_id : null;
await repository.createJob({
  id: jobId,
  workspaceId: args.actor.workspaceId,
  capabilityName: args.capabilityName,
  providerName: provider.name,
  status: 'queued',
  inputJson: JSON.stringify(args.input),
  sourceFileId,
  createdByType: args.actor.actorType,
  createdById: args.actor.actorId,
});
```

- [ ] **Step 6: Add job read service**

Add to `lib/jobs/service.ts`:

```ts
export async function getJobForActor(args: {
  actor: PlatformActor;
  jobId: string;
  repository?: JobRepository;
}) {
  const repository = args.repository ?? jobRepository;
  const job = await repository.getById(args.jobId);

  if (!job || job.workspaceId !== args.actor.workspaceId) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Job was not found.',
      status: 404,
    });
  }

  return job;
}
```

- [ ] **Step 7: Add `GET /api/v1/jobs/:jobId`**

Create `app/api/v1/jobs/[jobId]/route.ts`:

```ts
import { requireClerkActor } from '@/lib/auth/clerk-actor';
import { getJobForActor } from '@/lib/jobs/service';
import {
  errorResponse,
  resolveRequestId,
  successResponse,
} from '@/lib/request/response';

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = await requireClerkActor();
    const { jobId } = await context.params;
    const job = await getJobForActor({ actor, jobId });

    return successResponse(
      {
        job: {
          id: job.id,
          workspace_id: job.workspaceId,
          capability_name: job.capabilityName,
          provider_name: job.providerName,
          status: job.status,
          source_file_id: job.sourceFileId,
          result_file_id: job.resultFileId,
          result: job.resultJson ? JSON.parse(job.resultJson) : null,
          error_code: job.errorCode,
          error_message: job.errorMessage,
        },
      },
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
```

- [ ] **Step 8: Add route test for job polling**

In `tests/integration/api-v1-routes.test.ts`, mock `getJobForActor()` and add:

```ts
it('returns a persisted job by id', async () => {
  getJobForActor.mockResolvedValue({
    id: 'job_test',
    workspaceId: 1,
    capabilityName: 'image.edit',
    providerName: 'kie-ai',
    status: 'succeeded',
    sourceFileId: 'file_source',
    resultFileId: 'file_result',
    resultJson: JSON.stringify({ image_url: 'https://files.example.test/result.png' }),
    errorCode: null,
    errorMessage: null,
  });

  const response = await getJob(
    request('/api/v1/jobs/job_test'),
    { params: Promise.resolve({ jobId: 'job_test' }) },
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.data.job).toMatchObject({
    id: 'job_test',
    status: 'succeeded',
    result_file_id: 'file_result',
  });
});
```

- [ ] **Step 9: Verify tests pass**

Run:

```bash
npm test -- tests/unit/jobs-service.test.ts tests/integration/api-v1-routes.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/db/schema.ts lib/jobs/repository.ts lib/jobs/service.ts app/api/v1/jobs/route.ts app/api/v1/jobs/[jobId]/route.ts tests/unit/jobs-service.test.ts tests/integration/api-v1-routes.test.ts
git commit -m "feat: persist jobs and expose job polling"
```

---

## Task 6: Kie.ai Provider Submission Through Inngest

**Files:**
- Modify: `lib/providers/types.ts`
- Create: `lib/providers/kie/image-edit.ts`
- Modify: `lib/jobs/service.ts`
- Modify: `lib/inngest/functions.ts`
- Modify: `app/api/v1/capabilities/route.ts`
- Test: `tests/unit/providers.test.ts`
- Test: `tests/unit/queue-adapter.test.ts`
- Test: `tests/integration/api-v1-routes.test.ts`

- [ ] **Step 1: Add failing capability test**

In `tests/integration/api-v1-routes.test.ts`, update the capabilities expectation to include:

```ts
{
  name: 'image.edit',
  provider: 'kie-ai',
  execution_modes: ['async'],
}
```

- [ ] **Step 2: Add failing provider test**

In `tests/unit/providers.test.ts`, add:

```ts
it('submits kie.ai image edit tasks and returns provider task id', async () => {
  const provider = createKieImageEditProvider({
    client: {
      async createFluxKontextTask() {
        return { taskId: 'task_123' };
      },
    },
    createInputImageUrl: async () => 'https://files.example.test/source.png',
    callbackBaseUrl: 'https://app.example.test',
  });

  const result = await provider.run({
    jobId: 'job_test',
    workspaceId: 1,
    capabilityName: 'image.edit',
    input: {
      source_file_id: 'file_source',
      prompt: 'make it cinematic',
      aspect_ratio: '1:1',
      output_format: 'png',
      model: 'flux-kontext-pro',
    },
  });

  expect(result).toEqual({
    status: 'submitted',
    providerTaskId: 'task_123',
  });
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
npm test -- tests/unit/providers.test.ts tests/integration/api-v1-routes.test.ts
```

Expected: FAIL because provider and capability are missing.

- [ ] **Step 4: Extend provider result type**

In `lib/providers/types.ts`, add:

```ts
export type ProviderSubmittedResult = {
  status: 'submitted';
  providerTaskId: string;
};
```

Change:

```ts
export type ProviderResult = ProviderCompletedResult | ProviderFailedResult;
```

to:

```ts
export type ProviderResult = ProviderCompletedResult | ProviderFailedResult | ProviderSubmittedResult;
```

- [ ] **Step 5: Create kie image edit provider**

Create `lib/providers/kie/image-edit.ts`:

```ts
import { env } from '../../env/schema';
import { fileRepository } from '../../files/repository';
import { r2StorageAdapter } from '../../storage/r2';
import type { ProviderAdapter } from '../types';
import { createKieClient } from './client';

export function createKieImageEditProvider(args?: {
  client?: ReturnType<typeof createKieClient>;
  callbackBaseUrl?: string;
  createInputImageUrl?: (fileId: string, workspaceId: number) => Promise<string>;
}): ProviderAdapter {
  const client = args?.client ?? createKieClient({ apiKey: env.KIE_API_KEY });
  const callbackBaseUrl = args?.callbackBaseUrl ?? env.KIE_CALLBACK_BASE_URL;

  const createInputImageUrl =
    args?.createInputImageUrl ??
    (async (fileId: string, workspaceId: number) => {
      const file = await fileRepository.getById(fileId);

      if (!file || file.workspaceId !== workspaceId || file.status !== 'uploaded') {
        throw new Error('Source image file is not ready.');
      }

      return r2StorageAdapter.createDownloadUrl({
        bucket: file.storageBucket,
        key: file.storageKey,
        responseContentType: file.mimeType,
      });
    });

  return {
    name: 'kie-ai',
    async run(input) {
      const sourceFileId = String(input.input.source_file_id ?? '');
      const prompt = String(input.input.prompt ?? '').trim();

      if (!sourceFileId || !prompt) {
        return {
          status: 'failed',
          errorCode: 'KIE_INVALID_INPUT',
          errorMessage: 'source_file_id and prompt are required.',
        };
      }

      const inputImage = await createInputImageUrl(sourceFileId, input.workspaceId);
      const task = await client.createFluxKontextTask({
        prompt,
        inputImage,
        aspectRatio: input.input.aspect_ratio as '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | undefined,
        outputFormat: (input.input.output_format as 'jpeg' | 'png' | undefined) ?? 'png',
        model: (input.input.model as 'flux-kontext-pro' | 'flux-kontext-max' | undefined) ?? 'flux-kontext-pro',
        callBackUrl: `${callbackBaseUrl}/api/webhooks/kie/flux-kontext`,
      });

      return {
        status: 'submitted',
        providerTaskId: task.taskId,
      };
    },
  };
}

export const kieImageEditProvider = createKieImageEditProvider();
```

- [ ] **Step 6: Register provider**

In `lib/jobs/service.ts`, import and add:

```ts
import { kieImageEditProvider } from '../providers/kie/image-edit';

const providers: Record<string, ProviderAdapter> = {
  echo: echoProvider,
  'example-transform': exampleTransformProvider,
  'kie-ai': kieImageEditProvider,
};
```

- [ ] **Step 7: Handle submitted result**

In `runProviderJob()`, handle `submitted`:

```ts
if (result.status === 'submitted') {
  return {
    id: args.jobId,
    workspaceId: args.workspaceId,
    capabilityName: args.capabilityName,
    providerName: provider.name,
    status: 'running',
    result: { provider_task_id: result.providerTaskId },
    errorCode: null,
    errorMessage: null,
  };
}
```

- [ ] **Step 8: Persist provider task in Inngest function**

In `lib/inngest/functions.ts`, after `runJobFromEvent`, update repository state:

```ts
const result = await step.run('run provider job', () => runJobFromEvent(event.data));

if (result.status === 'running' && typeof result.result?.provider_task_id === 'string') {
  await step.run('record provider task id', () =>
    jobRepository.setProviderTask(event.data.jobId, String(result.result?.provider_task_id)),
  );
}

return result;
```

Also call `jobRepository.setRunning(event.data.jobId)` before provider execution.

- [ ] **Step 9: Advertise capability**

In `app/api/v1/capabilities/route.ts`, add:

```ts
{
  name: 'image.edit',
  provider: 'kie-ai',
  execution_modes: ['async'],
}
```

- [ ] **Step 10: Verify tests pass**

Run:

```bash
npm test -- tests/unit/providers.test.ts tests/unit/queue-adapter.test.ts tests/integration/api-v1-routes.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/providers/types.ts lib/providers/kie/image-edit.ts lib/jobs/service.ts lib/inngest/functions.ts app/api/v1/capabilities/route.ts tests/unit/providers.test.ts tests/unit/queue-adapter.test.ts tests/integration/api-v1-routes.test.ts
git commit -m "feat: submit kie image edit jobs"
```

---

## Task 7: Kie.ai Callback To R2 Result Storage

**Files:**
- Create: `app/api/webhooks/kie/flux-kontext/route.ts`
- Modify: `lib/providers/kie/webhook.ts`
- Modify: `lib/files/service.ts`
- Modify: `lib/jobs/service.ts`
- Test: `tests/integration/kie-webhook-route.test.ts`
- Test: `tests/unit/files-service.test.ts`

- [ ] **Step 1: Add failing webhook route test**

Create `tests/integration/kie-webhook-route.test.ts`:

```ts
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/webhooks/kie/flux-kontext/route';

const handleKieFluxCallback = vi.hoisted(() => vi.fn());

vi.mock('@/lib/jobs/service', () => ({
  handleKieFluxCallback,
}));

vi.mock('@/lib/env/schema', () => ({
  env: {
    KIE_WEBHOOK_HMAC_KEY: 'secret',
  },
}));

describe('kie flux callback route', () => {
  it('verifies signature and handles a successful callback', async () => {
    handleKieFluxCallback.mockResolvedValue(undefined);
    const timestamp = '1777190000';
    const signature = createHmac('sha256', 'secret')
      .update(`task_123.${timestamp}`)
      .digest('base64');

    const response = await POST(
      new Request('https://example.test/api/webhooks/kie/flux-kontext', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': signature,
        },
        body: JSON.stringify({
          code: 200,
          msg: 'success',
          data: {
            taskId: 'task_123',
            info: {
              resultImageUrl: 'https://kie.example.test/result.png',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(handleKieFluxCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task_123',
        code: 200,
      }),
    );
  });
});
```

- [ ] **Step 2: Run webhook route test and confirm failure**

Run:

```bash
npm test -- tests/integration/kie-webhook-route.test.ts
```

Expected: FAIL because the route and handler do not exist.

- [ ] **Step 3: Add generated image persistence service**

In `lib/files/service.ts`, add:

```ts
export async function createGeneratedImageFromUrl(args: {
  workspaceId: number;
  sourceUrl: string;
  filename: string;
  mimeType: string;
  storage?: StorageAdapter;
  repository?: FileRepository;
  storageBucket?: string;
  uuidFactory?: UuidFactory;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = args.fetchImpl ?? fetch;
  const storage = args.storage ?? r2StorageAdapter;
  const repository = args.repository ?? fileRepository;
  const storageBucket = args.storageBucket ?? env.R2_BUCKET_NAME;
  const response = await fetchImpl(args.sourceUrl);

  if (!response.ok) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to download generated image.',
      status: 502,
    });
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const fileId = createFileId(args.uuidFactory);
  const storageKey = `ws/${args.workspaceId}/generated/${fileId}/${sanitizeFilename(args.filename)}`;

  await storage.putObject({
    bucket: storageBucket,
    key: storageKey,
    body: bytes,
    mimeType: args.mimeType,
  });

  await repository.createGeneratedFile({
    id: fileId,
    workspaceId: args.workspaceId,
    filename: args.filename,
    mimeType: args.mimeType,
    sizeBytes: bytes.byteLength,
    storageProvider: 'r2',
    storageBucket,
    storageKey,
    visibility: 'private',
    status: 'ready',
    uploadedByType: 'system',
    uploadedById: 'kie-ai',
  });

  return {
    fileId,
    storageKey,
    publicUrl: storage.publicUrl({ key: storageKey }),
  };
}
```

- [ ] **Step 4: Add callback handler**

In `lib/jobs/service.ts`, add:

```ts
export async function handleKieFluxCallback(args: {
  taskId: string;
  code: number;
  message: string;
  resultImageUrl?: string;
  repository?: JobRepository;
}) {
  const repository = args.repository ?? jobRepository;
  const job = await repository.findByProviderTask('kie-ai', args.taskId);

  if (!job) {
    throw new ApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: 'kie.ai task was not found.',
      status: 404,
    });
  }

  if (args.code !== 200 || !args.resultImageUrl) {
    await repository.setFailed(job.id, `KIE_${args.code}`, args.message);
    return;
  }

  const generated = await createGeneratedImageFromUrl({
    workspaceId: job.workspaceId,
    sourceUrl: args.resultImageUrl,
    filename: `${job.id}.png`,
    mimeType: 'image/png',
  });

  await repository.setSucceeded(job.id, generated.fileId, {
    provider_task_id: args.taskId,
    result_file_id: generated.fileId,
    result_url: generated.publicUrl,
  });
}
```

Also import `createGeneratedImageFromUrl`.

- [ ] **Step 5: Create webhook route**

Create `app/api/webhooks/kie/flux-kontext/route.ts`:

```ts
import { env } from '@/lib/env/schema';
import { handleKieFluxCallback } from '@/lib/jobs/service';
import { verifyKieWebhookSignature, type KieFluxCallback } from '@/lib/providers/kie/webhook';

export async function POST(request: Request) {
  const payload = (await request.json()) as KieFluxCallback;
  const taskId = payload.data?.taskId;

  if (!taskId) {
    return Response.json({ error: 'Missing taskId' }, { status: 400 });
  }

  const verified = verifyKieWebhookSignature({
    taskId,
    timestamp: request.headers.get('x-webhook-timestamp'),
    signature: request.headers.get('x-webhook-signature'),
    secret: env.KIE_WEBHOOK_HMAC_KEY,
  });

  if (!verified) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  await handleKieFluxCallback({
    taskId,
    code: payload.code,
    message: payload.msg,
    resultImageUrl: payload.data.info?.resultImageUrl,
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 6: Verify webhook tests pass**

Run:

```bash
npm test -- tests/integration/kie-webhook-route.test.ts tests/unit/files-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/webhooks/kie/flux-kontext/route.ts lib/providers/kie/webhook.ts lib/files/service.ts lib/jobs/service.ts tests/integration/kie-webhook-route.test.ts tests/unit/files-service.test.ts
git commit -m "feat: handle kie image callbacks"
```

---

## Task 8: Docs, Smoke Contract, And Symphony Guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/api-authoring-playbook.md`
- Modify: `docs/provider-authoring-playbook.md`
- Modify: `docs/tool-authoring-playbook.md`
- Modify: `docs/environment-runbook.md`
- Test: `tests/unit/docs-required.test.ts`

- [ ] **Step 1: Add failing docs alignment checks**

In `tests/unit/docs-required.test.ts`, add required terms:

```ts
{
  path: 'README.md',
  requiredTerms: ['image.edit', 'kie-ai', 'KIE_API_KEY'],
},
{
  path: 'docs/provider-authoring-playbook.md',
  requiredTerms: ['kie-ai', 'Flux Kontext', 'KIE_WEBHOOK_HMAC_KEY'],
},
{
  path: 'docs/api-authoring-playbook.md',
  requiredTerms: ['/api/v1/jobs/:jobId', '/api/webhooks/kie/flux-kontext'],
},
```

- [ ] **Step 2: Run docs test and confirm failure**

Run:

```bash
npm test -- tests/unit/docs-required.test.ts
```

Expected: FAIL because docs do not mention the new provider and routes.

- [ ] **Step 3: Update README API surface**

Add these bullets to the API section in `README.md`:

```md
- `POST /api/v1/files/:fileId/complete`
- `GET /api/v1/jobs/:jobId`
- `POST /api/webhooks/kie/flux-kontext`
```

Add a short capability note:

```md
The `image.edit` capability uses provider `kie-ai` and runs asynchronously. App clients upload a source image, mark the upload complete, create an async job with `source_file_id` and `prompt`, then poll `GET /api/v1/jobs/:jobId`.
```

- [ ] **Step 4: Update provider playbook**

In `docs/provider-authoring-playbook.md`, add a "Kie.ai image provider" section describing:

```md
- Provider name: `kie-ai`
- Capability: `image.edit`
- External model: Flux Kontext
- Required env: `KIE_API_KEY`, `KIE_CALLBACK_BASE_URL`, `KIE_WEBHOOK_HMAC_KEY`
- Webhook route: `/api/webhooks/kie/flux-kontext`
- Result rule: kie.ai result URLs are temporary, so callbacks must download and persist generated images to R2 before marking jobs succeeded.
```

- [ ] **Step 5: Update API playbook**

In `docs/api-authoring-playbook.md`, document the mobile app flow:

```md
1. `POST /api/v1/files/create-upload`
2. App uploads to the returned signed URL.
3. `POST /api/v1/files/:fileId/complete`
4. `POST /api/v1/jobs` with `provider_name: "kie-ai"` and `capability_name: "image.edit"`
5. `GET /api/v1/jobs/:jobId` until `succeeded` or `failed`
```

- [ ] **Step 6: Verify docs tests pass**

Run:

```bash
npm test -- tests/unit/docs-required.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/api-authoring-playbook.md docs/provider-authoring-playbook.md docs/tool-authoring-playbook.md docs/environment-runbook.md tests/unit/docs-required.test.ts
git commit -m "docs: document kie image workflow"
```

---

## Task 9: Full Verification And Release Handoff

**Files:**
- No new files.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run env contract**

Run:

```bash
npm run check:env-contract -- .env.test.example
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Prepare PR handoff**

The PR description must include:

```md
## Summary
- Added authenticated mobile image edit flow using kie.ai Flux Kontext.
- Added durable file/job state and job polling.
- Added verified kie.ai callback handling and R2 result persistence.

## API
- `POST /api/v1/files/create-upload`
- `POST /api/v1/files/:fileId/complete`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/:jobId`
- `POST /api/webhooks/kie/flux-kontext`

## Env
- `KIE_API_KEY`
- `KIE_CALLBACK_BASE_URL`
- `KIE_WEBHOOK_HMAC_KEY`

## Verification
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run check:env-contract -- .env.test.example`
- `npm run build`
```

- [ ] **Step 7: Commit final verification note if docs changed during verification**

If only generated local artifacts changed, do not commit them. If docs were updated, commit:

```bash
git add README.md docs
git commit -m "docs: add kie verification handoff"
```

---

## Manual Setup Required

Before hosted test/prod verification, an operator must provide:

- `KIE_API_KEY` from kie.ai API key management.
- `KIE_WEBHOOK_HMAC_KEY` from kie.ai settings.
- `KIE_CALLBACK_BASE_URL=https://test.app.pest.gg` in Vercel test/staging.
- `KIE_CALLBACK_BASE_URL=https://app.pest.gg` in Vercel production.
- Confirm kie.ai callback settings are enabled so callbacks include `X-Webhook-Timestamp` and `X-Webhook-Signature`.

## Hosted Smoke Script

After deployment to test, run this with a real Clerk session token and a small PNG:

```bash
BASE_URL=https://test.app.pest.gg
TOKEN=<clerk-session-token>

curl -sS -X POST "$BASE_URL/api/v1/files/create-upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"source.png","mime_type":"image/png","size_bytes":1024}' > /tmp/kie-upload.json

# Upload source.png to the returned upload_url with the returned headers.

FILE_ID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/kie-upload.json","utf8")).data.file_id)')

curl -sS -X POST "$BASE_URL/api/v1/files/$FILE_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -sS -X POST "$BASE_URL/api/v1/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"capability_name\":\"image.edit\",\"provider_name\":\"kie-ai\",\"execution_mode\":\"async\",\"input\":{\"source_file_id\":\"$FILE_ID\",\"prompt\":\"turn this image into a cinematic product poster\",\"aspect_ratio\":\"1:1\",\"output_format\":\"png\",\"model\":\"flux-kontext-pro\"}}" > /tmp/kie-job.json

JOB_ID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/kie-job.json","utf8")).data.job.id)')

curl -sS "$BASE_URL/api/v1/jobs/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Expected final job state after callback:

```json
{
  "status": "succeeded",
  "provider_name": "kie-ai",
  "capability_name": "image.edit",
  "result_file_id": "file_..."
}
```

## Self-Review

- Spec coverage: the plan covers authenticated source upload, upload completion, durable async job creation, kie.ai Flux Kontext submission, callback HMAC verification, result download, R2 persistence, job polling, docs, and verification.
- Placeholder scan: the plan contains no placeholder markers and no unspecified "add tests" steps.
- Type consistency: provider names use `kie-ai`; capability name uses `image.edit`; route paths use `/api/v1/jobs/:jobId` and `/api/webhooks/kie/flux-kontext`; env names use `KIE_API_KEY`, `KIE_CALLBACK_BASE_URL`, and `KIE_WEBHOOK_HMAC_KEY`.
