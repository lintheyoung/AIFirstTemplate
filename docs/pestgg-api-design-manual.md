# PestGGApp API Design Manual

This is the product API standard for PestGGApp. Use it before creating or
changing any backend endpoint, capability, provider, webhook, or mobile app
integration.

The goal is simple: a mobile app should be able to depend on a stable,
predictable backend contract while the backend remains safe to evolve through
Linear, Symphony, and human review.

## Design References

This manual borrows the parts that fit PestGGApp from mature API systems:

- [GitLab REST API](https://docs.gitlab.com/api/rest/): versioned REST,
  resource naming, pagination, status codes, and deprecation discipline.
- [GitLab REST API documentation styleguide](https://docs.gitlab.com/development/documentation/restful_api_styleguide/):
  every resource document should include method, path, attributes, examples,
  and response shape.
- [Appwrite REST API](https://appwrite.io/docs/apis/rest): app backend service
  boundaries for auth, storage, databases, functions, and messaging.
- [Zulip REST API](https://zulip.com/api/rest): one API contract powering web
  and mobile clients.
- [Chatwoot APIs](https://developers.chatwoot.com/api-reference/introduction):
  API categories by audience, especially client APIs, application APIs, and
  platform APIs.
- [Chatwoot webhook verification](https://www.chatwoot.com/hc/user-guide/articles/1677693021-how-to-use-webhooks):
  signed webhook requests with timestamped HMAC verification.
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api):
  explicit row and request authorization thinking. PestGGApp should keep this
  idea, but should not expose database tables directly to the mobile app.

## Non-Negotiable API Rules

1. Mobile app traffic goes through PestGGApp backend routes. The app must not
   call Neon, R2, Kie, Inngest, or other provider secrets directly.
2. Public app APIs live under `app/api/v1`.
3. Every `/api/v1/*` route requires Clerk authentication through
   `middleware.ts` and `requireClerkActor()`.
4. Every durable user or file operation must enforce workspace ownership at the
   service or repository boundary.
5. Route handlers stay thin: parse input, resolve actor, call a service, return
   a normalized response.
6. Long-running model work uses jobs and Inngest. Do not block a mobile HTTP
   request while waiting for AI generation.
7. Provider URLs are never the final mobile contract. Generated assets must be
   downloaded by the backend and persisted to R2.
8. Webhooks must verify signatures before enqueueing or mutating state.
9. New endpoints must include tests, documentation, and a Linear API contract.
10. Breaking API changes require a new version path or an explicit migration
    plan in the release notes.

## API Categories

Use these path families consistently.

| Category | Path | Audience | Auth | Purpose |
| --- | --- | --- | --- | --- |
| App API | `/api/v1/*` | Mobile app and first-party web app | Clerk required | Product features and user workflows. |
| Provider webhooks | `/api/webhooks/<provider>/<event>` | External providers | Provider signature | Async callbacks from Kie and future providers. |
| Inngest sync | `/api/inngest` | Inngest platform | Inngest signing key | Function discovery and function execution. |
| Future admin API | `/api/admin/v1/*` | Internal operators | Admin role required | Operations, moderation, billing support. |
| Future public API | `/api/public/v1/*` | External integrations | API key or OAuth | Partner and automation use cases. |

Do not mix these audiences. For example, a Kie callback must not live under
`/api/v1`, and a mobile app route must not accept provider webhook signatures as
authentication.

## Resource Model

PestGGApp currently has these backend resource families:

| Resource | Current or planned role | Durable owner |
| --- | --- | --- |
| `me` | Current actor profile and workspace context. | Clerk actor plus workspace lookup. |
| `capabilities` | Discoverable operations the client can execute. | Static registry plus provider registry. |
| `files` | User uploads and generated assets. | Workspace, R2, file table. |
| `jobs` | Async and sync provider work. | Workspace, job table, Inngest. |
| `image-jobs` | Future convenience wrapper over image generation workflows. | Workspace, jobs, files. |
| `devices` | Future mobile device installation and push token records. | Workspace and user. |
| `captures` | Future scene, monitoring, or app-originated capture records. | Workspace and user. |
| `notifications` | Future app notification feed and delivery state. | Workspace and user. |
| `usage` | Future usage accounting and quota surfaces. | Workspace, jobs, provider records. |

Use plural nouns for collections: `files`, `jobs`, `devices`, `captures`. Keep
singleton context resources singular: `me`.

## URL And Method Rules

Use standard HTTP methods:

| Operation | Method | Example |
| --- | --- | --- |
| List resources | `GET` | `GET /api/v1/jobs` |
| Get one resource | `GET` | `GET /api/v1/jobs/:jobId` |
| Create a resource | `POST` | `POST /api/v1/files/create-upload` |
| Replace a resource | `PUT` | Future full replacement endpoints only. |
| Partially update | `PATCH` | Future status or settings updates. |
| Delete or revoke | `DELETE` | Future delete/revoke endpoints. |

Prefer resource nouns over verbs. Use action suffixes only when the action is
not a normal CRUD operation:

- Good: `POST /api/v1/files/create-upload`
- Good: `POST /api/v1/files/:fileId/complete`
- Good: `POST /api/v1/jobs/:jobId/cancel`
- Avoid: `POST /api/v1/do-image-generation`
- Avoid: `GET /api/v1/getJob`

Path parameters use lower camel resource names in docs, for example `:jobId`.
JSON fields use `snake_case`, for example `job_id` and `workspace_id`.

## Versioning And Compatibility

The stable mobile contract starts at `/api/v1`.

- Additive fields are allowed in `v1`.
- New optional request fields are allowed in `v1`.
- Removing a field, changing field meaning, changing enum semantics, or changing
  success status codes is a breaking change.
- Breaking changes require `/api/v2` or a documented migration period.
- Deprecated fields must stay readable until the mobile app version that uses
  them is no longer supported.

When an endpoint changes, update the relevant manual section and include the
compatibility note in the PR description.

## Authentication

The mobile app calls `/api/v1/*` with a Clerk session bearer token:

```http
Authorization: Bearer <clerk-session-token>
Content-Type: application/json
```

Route handlers must call `requireClerkActor()` before reading or writing
workspace data. Services receive the normalized `PlatformActor`; services must
not call Clerk directly.

Current actor shape:

```ts
type PlatformActor = {
  actorType: 'user' | 'api_key' | 'system';
  actorId: string;
  workspaceId: number;
  scopes: string[];
};
```

Future API-key actors must keep this shape so services can remain auth-provider
agnostic.

## Authorization And Workspace Boundaries

Every resource with durable state belongs to one workspace. A user may only
read or mutate records in their workspace unless an explicit admin API says
otherwise.

Required checks:

- File lookup: file must exist and `file.workspaceId === actor.workspaceId`.
- Job lookup: job must exist and `job.workspaceId === actor.workspaceId`.
- Generated asset access: result file must belong to the same workspace as the
  job that produced it.
- Device/capture/notification lookup: future records must include workspace and
  user ownership checks.

A missing resource and an inaccessible resource should both return
`RESOURCE_NOT_FOUND` to avoid leaking object existence across workspaces.

## Response Envelope

All `/api/v1/*` success responses use:

```json
{
  "data": {},
  "request_id": "req_..."
}
```

All handled failures use:

```json
{
  "error": {
    "code": "VALIDATION_INVALID_BODY",
    "message": "Request body is invalid.",
    "details": {}
  },
  "request_id": "req_..."
}
```

Rules:

- Always include `request_id`.
- Echo `x-request-id` if the client provided one; otherwise generate one.
- Do not return raw provider responses to mobile clients.
- Do not expose stack traces, provider secrets, signed upload credentials beyond
  the intended short-lived upload URL, or internal database IDs unless they are
  part of the API contract.

## Error Codes

Use stable machine-readable error codes.

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `AUTH_UNAUTHORIZED` | `401` | No valid Clerk session or invalid provider signature. |
| `AUTH_FORBIDDEN` | `403` | Authenticated actor lacks a required scope or role. |
| `VALIDATION_INVALID_BODY` | `400` | Body, query, or path parameter failed validation. |
| `RESOURCE_NOT_FOUND` | `404` | Resource missing or inaccessible to the actor. |
| `JOB_INVALID_STATE` | `400` or `409` | Requested job transition is not allowed. |
| `INTERNAL_ERROR` | `500` or `502` | Unexpected backend or provider failure. |

Add new error codes deliberately. Each new code must be documented and covered
by at least one test.

## Pagination, Filtering, And Sorting

List endpoints should use cursor pagination unless there is a strong reason not
to.

Default query parameters:

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | integer | `20` | Minimum `1`, maximum `100`. |
| `cursor` | string | none | Opaque server-generated cursor. |
| `sort` | enum | endpoint-specific | Use stable fields such as `created_at_desc`. |

Recommended list response:

```json
{
  "data": {
    "items": [],
    "next_cursor": "cursor_...",
    "has_more": true
  },
  "request_id": "req_..."
}
```

Filtering rules:

- Keep filter names explicit: `status`, `created_after`, `created_before`.
- Use ISO 8601 strings for timestamps.
- Reject unknown filter values with `VALIDATION_INVALID_BODY`.
- Do not expose broad unbounded lists to the mobile app.

## Idempotency

Mobile clients can retry requests because cellular networks are imperfect.
Creation endpoints that can charge money, consume quota, or create provider work
should support idempotency.

Recommended request header:

```http
Idempotency-Key: <client-generated-stable-key>
```

Current `jobs` storage already has an `idempotencyKey` column. Before relying on
it for public behavior, add route parsing, repository lookup, and tests.

Idempotency behavior:

- Same workspace plus same idempotency key returns the original created resource.
- Different body with the same key returns a validation or conflict error.
- Keys should expire only after the product has a clear retention policy.

## File And Asset APIs

The backend owns file identity and storage keys.

Upload flow:

1. `POST /api/v1/files/create-upload`
2. Mobile app uploads bytes to the returned signed URL.
3. `POST /api/v1/files/:fileId/complete`
4. Backend marks the file uploaded.

Request example:

```json
{
  "filename": "source.png",
  "mime_type": "image/png",
  "size_bytes": 1250000,
  "visibility": "private"
}
```

Success example:

```json
{
  "data": {
    "file_id": "file_...",
    "upload_url": "https://...",
    "headers": {},
    "visibility": "private",
    "public_url": null
  },
  "request_id": "req_..."
}
```

Rules:

- Private is the default visibility.
- Clients must not choose R2 keys.
- Generated provider outputs should be stored as private files unless the
  product explicitly needs a public delivery URL.
- Future download APIs should issue short-lived signed URLs for private files.

## Job And Capability APIs

Capabilities describe what the backend can do. Jobs execute capabilities.

Current built-in capabilities:

| Capability | Provider | Mode | Purpose |
| --- | --- | --- | --- |
| `example.echo` | `echo` | `sync` | Template sanity check. |
| `example.file_transform` | `example-transform` | `sync`, `async` | Template file workflow. |
| `image.edit` | `kie-ai` | `async` | Edit or generate from a source image plus prompt. |

Use `POST /api/v1/jobs` when an operation has provider execution, retry,
progress, callback, cost, or generated output.

Job creation request:

```json
{
  "capability_name": "image.edit",
  "provider_name": "kie-ai",
  "execution_mode": "async",
  "input": {
    "source_file_id": "file_...",
    "prompt": "turn this image into a cinematic product poster",
    "aspect_ratio": "1:1",
    "output_format": "png",
    "model": "flux-kontext-pro"
  }
}
```

Job creation success:

```json
{
  "data": {
    "job": {
      "id": "job_...",
      "workspace_id": 1,
      "capability_name": "image.edit",
      "provider_name": "kie-ai",
      "status": "queued",
      "result": null,
      "error_code": null,
      "error_message": null
    }
  },
  "request_id": "req_..."
}
```

Public job statuses:

| Status | Meaning |
| --- | --- |
| `queued` | Accepted and waiting for execution or provider callback. |
| `running` | Provider work is in progress. |
| `succeeded` | Output is available through backend-managed result fields. |
| `failed` | Execution failed with `error_code` and `error_message`. |

The database may contain more internal statuses, but the mobile app should only
depend on the public status contract unless an endpoint documents otherwise.

## Image Generation Contract

The current supported image flow is source-image plus prompt through Kie:

```text
Clerk signed-in mobile user
-> create upload intent
-> upload source image to R2
-> complete upload
-> create async image.edit job
-> Inngest runs provider submission
-> Kie calls signed webhook
-> backend stores generated result in R2
-> mobile polls job until succeeded or failed
```

Mobile client responsibilities:

- Upload the source file exactly once per intended source asset.
- Create a job with a clear prompt.
- Poll `GET /api/v1/jobs/:jobId` with backoff.
- Render job states without assuming instant completion.

Backend responsibilities:

- Validate prompt and source file access.
- Submit provider work through an adapter.
- Verify callbacks.
- Persist final image bytes to R2.
- Return only stable result fields such as `result_file_id` and
  `provider_task_id`.

Do not expose Kie temporary result URLs as the final product API.

## Webhook Contract

Provider webhooks are not app APIs.

Required behavior:

1. Parse the raw or verified payload according to provider needs.
2. Validate required event identity, such as `taskId`.
3. Verify HMAC signature and timestamp before queueing work.
4. Enqueue a normalized internal event to Inngest.
5. Return a small acknowledgement body.
6. Never perform heavy provider result downloads inside the webhook request when
   it can be moved to Inngest.

Current webhook:

```text
POST /api/webhooks/kie/flux-kontext
```

Expected invalid-signature behavior:

```json
{
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Invalid signature.",
    "details": {}
  },
  "request_id": "req_..."
}
```

## Mobile Client Guidelines

The mobile app should treat the backend as a stable product server, not as a
thin proxy to vendors.

Client requirements:

- Attach Clerk bearer token to `/api/v1/*`.
- Generate and pass `x-request-id` for important user actions.
- Use retry with backoff for transient network failures.
- Use idempotency keys for future costly creation endpoints.
- Poll async jobs with backoff; do not poll more than once every few seconds for
  normal image generation.
- Store only backend resource IDs, not provider URLs or provider secrets.
- Show provider or job failure messages only after mapping them to product-safe
  copy.

## Future PestGGApp Endpoint Shape

These paths are recommended for the product as it grows. Add them only when the
business feature exists.

```text
GET    /api/v1/me
GET    /api/v1/capabilities

POST   /api/v1/files/create-upload
POST   /api/v1/files/:fileId/complete
GET    /api/v1/files/:fileId
POST   /api/v1/files/:fileId/create-download

POST   /api/v1/jobs
GET    /api/v1/jobs
GET    /api/v1/jobs/:jobId
POST   /api/v1/jobs/:jobId/cancel

POST   /api/v1/image-jobs
GET    /api/v1/image-jobs/:jobId

POST   /api/v1/devices
PATCH  /api/v1/devices/:deviceId
DELETE /api/v1/devices/:deviceId

POST   /api/v1/captures
GET    /api/v1/captures
GET    /api/v1/captures/:captureId

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:notificationId
```

`image-jobs` can be a product-friendly wrapper around `jobs` once the mobile app
needs a simpler, image-specific contract. Until then, `POST /api/v1/jobs` is the
canonical execution API.

## API Documentation Template

Every supported endpoint must be documented with this shape:

```md
### Create Upload Intent

`POST /api/v1/files/create-upload`

Creates a backend-owned file record and a short-lived signed upload URL.

Auth: Clerk user required.

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `filename` | string | Yes | Original client filename. |
| `mime_type` | string | Yes | MIME type of the upload. |
| `size_bytes` | integer | Yes | Byte length of the upload. |

Success:

- Status: `201`
- `data.file_id`
- `data.upload_url`
- `data.headers`

Errors:

- `AUTH_UNAUTHORIZED`
- `VALIDATION_INVALID_BODY`
```

If an API change lacks this level of contract, it is not ready for
implementation.

## Linear Issue Contract

Every API-related Linear todo should include:

```md
## API Contract

- Repo: PestGGAPPBackend
- API category: App API / Webhook / Inngest / Admin / Public
- Method and path: `POST /api/v1/example`
- Auth: Clerk user required
- Workspace rule: actor can only access records in actor.workspaceId
- Request body:
  - `field_name`: type and validation rule
- Success response:
  - status:
  - `data.*` fields:
- Failure responses:
  - `AUTH_UNAUTHORIZED`
  - `VALIDATION_INVALID_BODY`
  - `RESOURCE_NOT_FOUND`
- Async behavior:
  - none / creates job / emits Inngest event / waits for webhook
- Tests:
  - unauthenticated request
  - invalid body
  - success path
  - workspace boundary
- Docs to update:
  - `docs/pestgg-api-design-manual.md`
  - resource-specific doc, if present
```

Symphony should refuse to implement a vague API todo until this contract is
clear.

## Implementation Checklist

For every API change:

1. Read this manual.
2. Read [API Authoring Playbook](docs/api-authoring-playbook.md).
3. If the endpoint starts provider work, read
   [Capability Authoring Playbook](docs/tool-authoring-playbook.md).
4. If the endpoint integrates a model/vendor, read
   [Provider Authoring Playbook](docs/provider-authoring-playbook.md).
5. Write or update failing tests first.
6. Implement the route as a thin HTTP layer.
7. Put business behavior in `lib/<resource>/service.ts`.
8. Put durable persistence in `lib/<resource>/repository.ts`.
9. Use `successResponse()` and `errorResponse()`.
10. Run `npm test`, `npm run typecheck`, and `npm run lint`.
11. For hosted behavior, run `npm run smoke:hosted` against test.
12. Update this manual when the public API contract changes.

## Review Checklist

Human review and automated review should check:

- Is the endpoint in the correct API category?
- Does it use the right HTTP method and resource name?
- Does it require Clerk or provider signature as appropriate?
- Does the service enforce workspace ownership?
- Does it avoid exposing provider internals?
- Does it return the standard envelope?
- Are errors stable and documented?
- Does it have tests for auth, validation, success, and workspace boundary?
- Does async work go through jobs and Inngest?
- Does the mobile app have enough status information without depending on
  internal database or provider behavior?

## Current Product Position

The backend is already suitable as a mobile app backend for:

- Clerk-authenticated app users.
- User-owned file uploads.
- Backend-managed R2 storage.
- Async image editing/generation using Kie.
- Inngest-backed long-running work.
- Webhook-verified provider callbacks.
- Polling job status from the mobile app.

Before production mobile scale, add these product hardening items as separate
Linear todos:

- Real workspace membership lookup instead of the starter workspace fallback.
- Cursor list endpoints for files and jobs.
- Short-lived private file download URLs.
- Idempotency key support on job creation.
- Rate limits or quota checks for expensive image generation.
- Product-safe error message mapping for provider failures.
- Device registration and push notification API, if the mobile app needs push.
