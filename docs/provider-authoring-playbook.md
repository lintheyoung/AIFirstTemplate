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

`resolveProvider()` in `lib/jobs/service.ts` maps provider names to adapters
and raises `RESOURCE_NOT_FOUND` for unknown providers.

## Add A Provider

1. Create a file under `lib/providers`.
2. Export a `ProviderAdapter` with a stable `name`.
3. Validate provider-specific input and return `VALIDATION_INVALID_BODY` for
   invalid caller input.
4. Map external service errors to stable platform error codes.
5. Return metadata needed by the job service to expose outputs.
6. Register the provider in `lib/jobs/service.ts`.
7. Add unit tests in `tests/unit/providers.test.ts` or a focused provider test.

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
