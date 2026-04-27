# Provider Authoring Playbook

Providers execute capability work. They are deliberately smaller than
capabilities: a provider receives a normalized job input and returns a
normalized result to the job service.

## Contract

The provider contract lives in `lib/providers/types.ts`.

Input:

- `jobId`
- `workspaceId`
- `capabilityName`
- `input`

Output:

- `status: 'completed'` with a `result` object and optional numeric `metrics`
- `status: 'failed'` with a stable `errorCode` and user-safe `errorMessage`

Registered starter providers:

- `echo` in `lib/providers/echo.ts`
- `example-transform` in `lib/providers/example-transform.ts`
- `kie-ai` in `lib/providers/kie/image-edit.ts`

`resolveProvider()` in `lib/jobs/service.ts` maps provider names to adapters
and raises `RESOURCE_NOT_FOUND` for unknown providers.

## Kie.ai Image Provider

- Provider name: `kie-ai`
- Capability: `image.edit`
- External model: Flux Kontext
- Required env: `KIE_API_KEY`, `KIE_CALLBACK_BASE_URL`,
  `KIE_WEBHOOK_HMAC_KEY`
- Webhook route: `/api/webhooks/kie/flux-kontext`
- Result rule: kie.ai result URLs are temporary, so callbacks must download and
  persist generated images to R2 before marking jobs succeeded.

Kie GPT Image 2 should be added as a separate provider when it becomes part of
the product contract. Use the Kie Market endpoint
`POST https://api.kie.ai/api/v1/jobs/createTask` with model names such as
`gpt-image-2-text-to-image` or `gpt-image-2-image-to-image`, then query
`GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<taskId>`.
Keep its webhook route separate, for example
`/api/webhooks/kie/gpt-image-2`, because Kie Market callbacks and `resultJson`
shapes can differ from Flux Kontext callbacks.

## Add A Provider

1. Create a file under `lib/providers`.
2. Export a `ProviderAdapter` with a stable `name`.
3. Validate provider-specific input and return `VALIDATION_INVALID_BODY` for
   invalid caller input.
4. Map external service errors to stable platform error codes.
5. Return metadata needed by the job service to expose outputs.
6. Register the provider in `lib/jobs/service.ts`.
7. Add unit tests in `tests/unit/providers.test.ts` or a focused provider test.

For providers with callbacks, also:

1. Create a webhook route under `app/api/webhooks/<provider>/<event>/route.ts`.
2. Verify provider signatures before sending internal events.
3. Send an Inngest event for durable callback handling.
4. Add an Inngest function in `lib/inngest/functions.ts`.
5. Persist final files through `lib/files/service.ts` and R2.
6. Add an integration test for invalid signatures and successful callback
   dispatch.

## Boundaries

Providers must not:

- decide workspace authorization
- write job rows directly
- mutate environment configuration
- choose dev/test/prod resources
- bypass `successResponse()` / `errorResponse()` from `lib/request/response.ts`
- create upload URLs outside `lib/files/service.ts` and `lib/storage`

Providers may call external APIs, transform files, and return normalized
results. They should receive resource identity from the platform layer and
configuration, not hardcode production credentials or bucket names.

## Operating Expectations

Provider behavior must be smokeable in all environments. Use `echo` for a
simple API health check and `example-transform` as the template for work that
derives an output from a file ID. A release stops if a provider writes to the
wrong environment, leaks an external raw error, or returns a shape that the job
service cannot normalize.
