# Release Playbook

Release only after the code, environment contract, and hosted smoke all agree
about the target environment. This starter expects feature work to promote to
`staging` for test, then to `main` for prod.

## Current Starter Limits

The starter intentionally ships with demo actor resolution. API routes call
`requireDemoActor()`, so Clerk packages and env variables are present but real
Clerk-backed actor lookup is not implemented yet. Wiring Clerk session/API-key
resolution into the platform actor model is a pre-production adoption task.

Jobs also run inline today. `POST /api/v1/jobs` calls `runJobInline()` and does
not emit `job.created` through `lib/queue`. `lib/queue/adapter.ts` and
`lib/queue/inngest.ts` mark the boundary for future async execution; queue smoke
is required only after background execution is wired.

## Test Promotion

1. Merge the feature branch to `staging`.
2. Deploy the hosted test app for `NEXT_PUBLIC_APP_URL=https://test.example.com`.
3. Run `npm run check:env-contract -- .env.test.example` or the real test env
   file with `--expect-env test`.
4. Run `npm test`.
5. Run `npm run typecheck`.
6. Run `npm run lint`.
7. Run `npm run build`.
8. Smoke the hosted test API:
   - `GET /api/v1/me`
   - `GET /api/v1/capabilities`
   - `POST /api/v1/files/create-upload`
   - `POST /api/v1/jobs` with `example.echo` and provider `echo`
   - `POST /api/v1/jobs` with `example.file_transform` and provider
     `example-transform`
9. Confirm writes land only in staging database and storage resources.
10. If real auth has been adopted, confirm Clerk uses the staging application.
11. If background jobs have been adopted, confirm queue events use staging
    resources.

## Production Promotion

1. Merge the approved `staging` commit to `main`.
2. Deploy production for `NEXT_PUBLIC_APP_URL=https://example.com`.
3. Run `npm run check:env-contract -- .env.production.example` or the real prod
   env file with `--expect-env prod`.
4. Re-run `npm test`, `npm run typecheck`, `npm run lint`, and
   `npm run build` on the release commit.
5. Smoke production with low-risk data:
   - `GET /api/v1/me`
   - `GET /api/v1/capabilities`
   - `POST /api/v1/jobs` with `example.echo` and provider `echo`
   - `POST /api/v1/jobs` with `example.file_transform` and provider
     `example-transform`
6. Confirm production writes land only in production database and storage
   resources.
7. If real auth has been adopted, confirm Clerk uses the production
   application.
8. If background jobs have been adopted, confirm queue events use production
   resources.

## Release Stop Conditions

Stop the release when any stop condition is present:

- Environment contract check fails or reports the wrong `APP_ENV`.
- Test points at production resources, or prod points at staging/test/dev
  resources.
- Database migrations or schema checks fail.
- Demo actor smoke through `GET /api/v1/me` does not return the expected actor
  shape.
- Real Clerk-backed actor lookup is needed for adoption but has not been wired
  before production traffic.
- Background job execution is enabled but queue registration is stale or
  `job.created` cannot be emitted.
- R2 upload intent creation returns a bucket or public base URL for the wrong
  environment.
- `POST /api/v1/jobs` cannot run `example.echo` through provider `echo`.
- `POST /api/v1/jobs` cannot run `example.file_transform` through provider
  `example-transform`.
- Any required verification command exits non-zero.

Do not promote frontend clients, SDKs, or external automation before the
backend release target has passed smoke.
