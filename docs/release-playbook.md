# Release Playbook

Release only after the code, environment contract, and hosted smoke all agree
about the target environment. This starter expects feature work to promote to
`staging` for test, then to `main` for prod.

## Current Starter Auth And Jobs

All `/api/v1/*` routes require Clerk authentication. Route handlers call
`requireClerkActor()`, which maps the signed-in Clerk user into the template
`PlatformActor` shape. The starter keeps workspace membership simple with a
single workspace ID so projects can replace that resolver with database-backed
membership lookup when they adopt real teams, orgs, or API keys.

Jobs support both execution modes. `sync` calls `runJobInline()` for immediate
provider execution. `async` creates a queued job envelope, emits `job.created`
through `lib/queue/inngest.ts`, and exposes functions through
`app/api/inngest/route.ts` for Inngest sync.

## Test Promotion

1. Merge the feature branch to `staging`.
2. Deploy the hosted test app for `NEXT_PUBLIC_APP_URL=https://test.app.pest.gg`.
3. Run `npm run deploy:preflight -- --env-file .env.test.local --expect-env test`
   or the equivalent real test env file.
4. Run `npm test`.
5. Run `npm run typecheck`.
6. Run `npm run lint`.
7. Run `npm run build`.
8. Smoke the hosted test API:
   - Unauthenticated `GET /api/v1/me` returns `AUTH_UNAUTHORIZED`
   - Authenticated `GET /api/v1/me`
   - Authenticated `GET /api/v1/capabilities`
   - Authenticated `POST /api/v1/files/create-upload`
   - Authenticated `POST /api/v1/jobs` with `example.echo` and provider `echo`
   - `POST /api/v1/jobs` with `example.file_transform` and provider
     `example-transform`
9. Sync or refresh the Inngest test app against `/api/inngest`.
10. Run hosted smoke with `SMOKE_BASE_URL=https://test.app.pest.gg`,
    `SMOKE_EXPECT_ENV=test`, and `SMOKE_EXPECT_REGION=sin1`.
11. Confirm writes land only in staging database and storage resources.
12. Confirm Clerk uses the staging application and Inngest events use staging
    resources.

## Production Promotion

1. Merge the approved `staging` commit to `main`.
2. Deploy production for `NEXT_PUBLIC_APP_URL=https://app.pest.gg`.
3. Run `npm run deploy:preflight -- --env-file .env.production.local --expect-env prod`
   or the equivalent real prod env file.
4. Re-run `npm test`, `npm run typecheck`, `npm run lint`, and
   `npm run build` on the release commit.
5. Smoke production with low-risk data:
   - Unauthenticated `GET /api/v1/me` returns `AUTH_UNAUTHORIZED`
   - Authenticated `GET /api/v1/me`
   - Authenticated `GET /api/v1/capabilities`
   - Authenticated `POST /api/v1/jobs` with `example.echo` and provider `echo`
   - `POST /api/v1/jobs` with `example.file_transform` and provider
     `example-transform`
6. Sync or refresh the Inngest production app against `/api/inngest`.
7. Run hosted smoke with `SMOKE_BASE_URL=https://app.pest.gg`,
   `SMOKE_EXPECT_ENV=prod`, and `SMOKE_EXPECT_REGION=sin1`.
8. Confirm production writes land only in production database and storage
   resources.
9. Confirm Clerk uses the production application and Inngest events use
   production resources.

## Release Stop Conditions

Stop the release when any stop condition is present:

- Environment contract check fails or reports the wrong `APP_ENV`.
- Deploy preflight fails or `vercel.json` no longer pins `regions: ["sin1"]`.
- Hosted smoke does not show the expected `x-vercel-id` region.
- Test points at production resources, or prod points at staging/test/dev
  resources.
- Database migrations or schema checks fail.
- Clerk actor smoke through authenticated `GET /api/v1/me` does not return the
  expected actor shape.
- Unauthenticated `/api/v1/*` access does not return `AUTH_UNAUTHORIZED`.
- Inngest sync is stale or `job.created` cannot be emitted.
- R2 upload intent creation returns a bucket or public base URL for the wrong
  environment.
- `POST /api/v1/jobs` cannot run `example.echo` through provider `echo`.
- `POST /api/v1/jobs` cannot run `example.file_transform` through provider
  `example-transform`.
- Any required verification command exits non-zero.

Do not promote frontend clients, SDKs, or external automation before the
backend release target has passed smoke.
