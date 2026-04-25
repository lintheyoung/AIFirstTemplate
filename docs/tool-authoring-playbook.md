# Capability Authoring Playbook

A capability is a stable product operation exposed to clients through the API.
The starter advertises capabilities at `GET /api/v1/capabilities` and executes
jobs at `POST /api/v1/jobs`.

## Existing Capabilities

| Capability | Provider | Modes | Purpose |
| --- | --- | --- | --- |
| `example.echo` | `echo` | `sync` | JSON-only request/response smoke |
| `example.file_transform` | `example-transform` | `sync`, `async` | File-derived output shape smoke |

The API accepts `capability_name`, `provider_name`, `execution_mode`, and
`input`. The current starter runs jobs inline through `runJobInline()` in
`lib/jobs/service.ts`; async mode is part of the API contract and queue
boundary, but production background execution should be wired through
`lib/queue/adapter.ts` and `lib/queue/inngest.ts`.

## Add A Capability

1. Choose a stable dotted name, such as `document.extract`.
2. Add the capability to the list in `app/api/v1/capabilities/route.ts`.
3. Decide which provider owns the work.
4. Validate request input at the route or service boundary before dispatch.
5. Keep workspace authorization in auth/job services, not inside the provider.
6. Add or reuse a provider under `lib/providers`.
7. Add tests for the provider and the route/service path.
8. Add hosted test smoke evidence before release.

## Boundary Rules

Platform core owns auth, actor shape, workspace scoping, API envelopes, file
upload intents, job IDs, status normalization, attempts, and final job state.
Capabilities own product input semantics and the provider selection needed to
perform the work.

Do not put product-specific capability behavior into `lib/auth`,
`lib/workspaces`, `lib/files`, `lib/storage`, or `lib/request`. If capability
logic needs external calls, keep those calls behind a provider adapter.

## Release Guardrails

Every new capability must have a dev/test/prod story:

- Dev can use disposable credentials and sample data.
- Test smoke must use staging resources.
- Prod smoke must use low-risk production data.
- Release stops if the capability writes to the wrong environment or bypasses
  the normalized API response shape.
