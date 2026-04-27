# App Backend Capabilities

This document explains what the template backend can already do for a mobile or
web app. Use it when deciding whether to build a feature as an API route,
capability, provider, or background workflow.

## Authenticated App Backend

The template is suitable for apps that need a hosted backend for account-aware
workflows:

- Clerk handles sign-in and sign-up UI at `/sign-in` and `/sign-up`.
- Middleware protects `/api/v1/*`.
- API routes call `requireClerkActor()` to resolve a normalized actor.
- Unauthenticated requests return normalized `AUTH_UNAUTHORIZED` errors.
- Authenticated app clients call backend APIs with a Clerk session bearer token.

The current protected starter routes are:

- `GET /api/v1/me`
- `GET /api/v1/capabilities`
- `POST /api/v1/files/create-upload`
- `POST /api/v1/files/:fileId/complete`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/:jobId`

## File Uploads And R2 Storage

The backend owns file metadata and R2 object identity. App clients should not
construct storage keys themselves.

Normal upload flow:

1. App calls `POST /api/v1/files/create-upload`.
2. Backend creates a file row and signed upload URL.
3. App uploads the binary to R2.
4. App calls `POST /api/v1/files/:fileId/complete`.
5. Backend marks the file uploaded and makes it available to jobs.

Generated provider outputs should be downloaded by the backend and persisted to
R2 before a job is marked `succeeded`. Do not expose short-lived provider URLs
as the final app contract.

## Async Jobs And Inngest

Durable work should use jobs rather than long-running API requests.

Current async job flow:

```text
POST /api/v1/jobs
-> job row created
-> job.created event sent to Inngest
-> run-job-created executes provider work
-> provider returns submitted/completed/failed
-> job status is updated
-> app polls GET /api/v1/jobs/:jobId
```

Inngest is used for:

- `run-job-created`: starts provider work after a job is created.
- `handle-kie-flux-callback`: handles verified Kie image callbacks and persists
  final generated images.

`GET /api/inngest` is the sync and smoke endpoint for hosted environments.

## Image Generation And Editing

The template includes a production-shaped image workflow:

```text
Signed-in app user
-> upload source image
-> create image.edit async job
-> Inngest submits Kie.ai Flux Kontext task
-> Kie.ai calls /api/webhooks/kie/flux-kontext
-> backend verifies HMAC
-> Inngest handles callback
-> backend downloads generated image
-> backend stores result in R2
-> app polls job result
```

The supported built-in provider is:

| Capability | Provider | Mode | Purpose |
| --- | --- | --- | --- |
| `image.edit` | `kie-ai` | `async` | Edit/generate from a user source image plus prompt. |

Example job body:

```json
{
  "capability_name": "image.edit",
  "provider_name": "kie-ai",
  "execution_mode": "async",
  "input": {
    "source_file_id": "file_123",
    "prompt": "turn this image into a cinematic product poster",
    "aspect_ratio": "1:1",
    "output_format": "png",
    "model": "flux-kontext-pro"
  }
}
```

Kie GPT Image 2 has also been smoke-tested directly through Kie Market APIs.
If a product needs GPT Image 2 as part of the official backend contract, add it
as a separate provider and webhook route instead of mixing it into the Flux
Kontext provider.

Recommended files for a GPT Image 2 extension:

- `lib/providers/kie/gpt-image-2.ts`
- `lib/providers/kie/gpt-image-2-client.ts`
- `app/api/webhooks/kie/gpt-image-2/route.ts`
- focused tests under `tests/unit` and `tests/integration`

## When To Add What

Use this decision table:

| Need | Add |
| --- | --- |
| A simple protected read/write endpoint | `/api/v1/<resource>` route and a service. |
| A user-discoverable operation | Capability in `/api/v1/capabilities`. |
| Long-running work | Async job plus Inngest function. |
| External AI/model work | Provider under `lib/providers`. |
| External provider callback | Webhook under `/api/webhooks/<provider>/<event>`. |
| A generated file output | Backend-managed R2 persistence. |

Detailed API steps live in `docs/api-authoring-playbook.md`.
