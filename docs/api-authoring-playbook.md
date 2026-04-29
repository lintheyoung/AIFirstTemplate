# API Authoring Playbook

Use this guide when adding or changing public backend routes. It is written for
humans and for Symphony agents working from Linear issues.

For product-level API design rules, read
`docs/pestgg-api-design-manual.md` first. This playbook is the implementation
checklist for turning that contract into routes, services, tests, and docs.

## Route Contract

Public application routes live under `app/api/v1`. Every `/api/v1/*` route is
Clerk-authenticated by `middleware.ts` and must also resolve the actor in the
route handler with `requireClerkActor()` before reading or writing workspace
data.

Keep API handlers thin:

1. Parse and validate request input.
2. Resolve the actor with `requireClerkActor()`.
3. Call a service in `lib/.../service.ts`.
4. Return the normalized API response envelope.

Use `successResponse()` for successful responses and `errorResponse()` for
handled failures. Throw or return an `ApiError` when validation, authorization,
lookup, or provider execution fails. Do not return raw JSON shapes directly
from `/api/v1` routes.

## Add A REST Endpoint

1. Confirm the endpoint fits the product contract in
   `docs/pestgg-api-design-manual.md`.
2. Create or update `app/api/v1/<resource>/route.ts`.
3. Add validation at the route or service boundary. Prefer explicit `zod`
   schemas for request bodies and query parameters.
4. Call `requireClerkActor()` before dispatching to services.
5. Put durable business behavior in `lib/<resource>/service.ts`.
6. Keep storage, database, queue, and provider calls behind existing adapters.
7. Add integration coverage in `tests/integration/api-v1-routes.test.ts` or a
   focused integration test beside it.
8. Update docs if the endpoint is part of the supported template surface.
9. Run `npm run typecheck`, `npm test`, and `npm run lint`.
10. Run `npm run smoke:local` when a local server is available.

## API Addition Template

Use this checklist for every new endpoint. Copy it into the Linear issue or PR
description so humans and Symphony agree on the contract before coding.

```md
## API Contract

- Method and path: `POST /api/v1/example`
- Auth: Clerk user required through `requireClerkActor()`
- Workspace rule: actor must own or be allowed to access the target workspace
- Request body:
  - `name`: non-empty string
- Success response:
  - `data.example_id`: stable string ID
  - `request_id`: present
- Failure responses:
  - `AUTH_UNAUTHORIZED` when unauthenticated
  - `VALIDATION_INVALID_BODY` when body is invalid
  - `RESOURCE_NOT_FOUND` when the resource is missing or inaccessible
- Tests:
  - unauthenticated request
  - invalid request body
  - successful authenticated request
  - workspace boundary, if the endpoint reads or writes workspace data
```

Minimal route shape:

```ts
import { z } from 'zod';
import { requireClerkActor } from '@/lib/auth/clerk';
import { ApiError } from '@/lib/request/errors';
import { parseJsonBody } from '@/lib/request/json';
import { errorResponse, resolveRequestId, successResponse } from '@/lib/request/response';
import { createExample } from '@/lib/examples/service';

const createExampleSchema = z.object({
  name: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const requestId = resolveRequestId(request.headers.get('x-request-id'));

  try {
    const actor = await requireClerkActor();
    const parsed = createExampleSchema.safeParse(await parseJsonBody(request));

    if (!parsed.success) {
      throw new ApiError({
        code: 'VALIDATION_INVALID_BODY',
        message: 'Invalid request body.',
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const result = await createExample({
      actor,
      input: parsed.data,
    });

    return successResponse(result, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
```

Minimal service shape:

```ts
import type { PlatformActor } from '@/lib/auth/types';

export async function createExample(args: {
  actor: PlatformActor;
  input: { name: string };
}) {
  return {
    example_id: `example_${args.actor.actorId}`,
    name: args.input.name,
  };
}
```

Keep the route responsible for HTTP concerns and the service responsible for
business behavior. If the service needs storage, database, queue, or provider
access, call existing adapters from the service rather than from the route.

## API File Map

For a new resource named `widgets`, the default file map is:

| Purpose | Path |
| --- | --- |
| Collection route | `app/api/v1/widgets/route.ts` |
| Item route | `app/api/v1/widgets/[widgetId]/route.ts` |
| Service | `lib/widgets/service.ts` |
| Repository, if durable data is needed | `lib/widgets/repository.ts` |
| Integration tests | `tests/integration/api-v1-routes.test.ts` or `tests/integration/widgets-routes.test.ts` |
| Unit tests for service logic | `tests/unit/widgets-service.test.ts` |

Only create a repository when the endpoint owns database persistence. For thin
wrappers over existing behavior, call the existing service.

## Add Capability Behavior

If the new API behavior is a durable product operation that clients should
discover and execute, model it as a capability instead of a one-off route.
Follow `docs/tool-authoring-playbook.md` for capability naming, advertisement at
`GET /api/v1/capabilities`, sync versus async modes, and `POST /api/v1/jobs`
dispatch.

If the capability performs external work, file transforms, model calls, or other
provider-specific behavior, follow `docs/provider-authoring-playbook.md` and keep
that behavior behind `lib/providers`.

## Mobile Image Edit Flow

The mobile app stays thin for `image.edit` jobs:

1. `POST /api/v1/files/create-upload`
2. App uploads the source image to the returned signed URL.
3. `POST /api/v1/files/:fileId/complete`
4. `POST /api/v1/jobs` with `provider_name: "kie-ai"` and
   `capability_name: "image.edit"`
5. `GET /api/v1/jobs/:jobId` until `succeeded` or `failed`

The kie.ai Flux Kontext callback arrives at
`POST /api/webhooks/kie/flux-kontext`. That webhook persists temporary provider
result URLs to R2 before the job is exposed as succeeded.

## Response Envelope Rules

Successful responses use:

```ts
return successResponse(value, requestId);
```

Handled failures use:

```ts
return errorResponse(
  new ApiError({
    code: 'AUTH_UNAUTHORIZED',
    message: 'Authentication is required.',
    status: 401,
  }),
  requestId,
);
```

Route code may use the exact helper signature already present in the repository.
The rule is the contract: clients receive a stable response envelope and a
`request_id`, not framework-specific error output.

## Auth And Workspace Rules

- All `/api/v1/*` routes require a signed-in Clerk user.
- Do not read Clerk state directly in feature services; pass the normalized
  actor returned by `requireClerkActor()`.
- Workspace authorization belongs in auth, workspace, or service boundaries.
- Providers receive normalized job input and should not decide whether a user
  can access a workspace.
- API key actors can be added later, but they must preserve the same
  `PlatformActor` shape.

## Symphony Checklist

Before editing an API issue, Symphony should classify the ticket:

- API route: read `docs/pestgg-api-design-manual.md` and this file first.
- Capability: also read `docs/tool-authoring-playbook.md`.
- Provider: also read `docs/provider-authoring-playbook.md`.
- Deployment or env: also read `docs/environment-runbook.md` and
  `docs/deployment-runbook.md`.

For API tickets, Symphony should report in the PR handoff:

- Endpoint or capability changed.
- Auth behavior.
- Request and response shape.
- Tests added or updated.
- `npm run smoke:local` result, or why local smoke was not available.
