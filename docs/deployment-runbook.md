# Deployment Runbook

This template keeps deployment checks executable. Run preflight before pushing
to Vercel, then run hosted smoke after assigning the domain alias.

## Vercel Region

Hosted functions must run in Singapore for low-latency access to the app's
primary infrastructure. `vercel.json` pins the default function region:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

After deploy, confirm the region through either `vercel inspect` or response
headers. A healthy hosted response includes `x-vercel-id` with `sin1`.

## Preflight

Run preflight against the target env file before deploying:

```bash
npm run deploy:preflight -- --env-file .env.test.local --expect-env test
npm run deploy:preflight -- --env-file .env.production.local --expect-env prod
```

Preflight checks:

- the env file passes `lib/env/schema.ts`
- `APP_ENV` matches the expected target
- `INNGEST_ENV` is `test` for test and `Production` for prod
- `vercel.json` includes `regions: ["sin1"]`
- `.vercel/project.json` exists, meaning `vercel link` has been run
- test deploys from `main` print a warning about Vercel Preview env persistence

Vercel does not allow Preview environment variables to be permanently attached
to the production branch. Use a `staging` branch for persistent Preview env, or
pass one-off env values during manual test deploys.

## Hosted Smoke

Run hosted smoke after the alias points at the new deployment:

```bash
SMOKE_BASE_URL=https://test.app.pest.gg \
SMOKE_EXPECT_ENV=test \
SMOKE_EXPECT_REGION=sin1 \
npm run smoke:hosted

SMOKE_BASE_URL=https://app.pest.gg \
SMOKE_EXPECT_ENV=prod \
SMOKE_EXPECT_REGION=sin1 \
npm run smoke:hosted
```

Hosted smoke checks:

- unauthenticated `GET /api/v1/me` returns normalized `AUTH_UNAUTHORIZED`
- `/api/inngest` returns `function_count >= 1`
- `/api/inngest` reports the expected `x-inngest-env`
- hosted responses include the expected Vercel region in `x-vercel-id`

For a deeper auth smoke, set `SMOKE_CLERK_BEARER_TOKEN` to a Clerk session
token for the target environment:

```bash
SMOKE_BASE_URL=https://test.app.pest.gg \
SMOKE_EXPECT_ENV=test \
SMOKE_CLERK_BEARER_TOKEN=replace_with_session_token \
npm run smoke:hosted
```

When the token is present, hosted smoke also checks authenticated
`GET /api/v1/me` and `GET /api/v1/capabilities`.

## Inngest Sync

Sync each Inngest environment to the matching URL:

| Inngest environment | URL |
| --- | --- |
| `test` | `https://test.app.pest.gg/api/inngest` |
| `Production` | `https://app.pest.gg/api/inngest` |

Do not overwrite old project URLs when syncing another app. Inngest apps can
coexist when their app IDs differ, for example `gateway-app` and
`aifirst-template`.

## R2 And DNS

R2 public file domains are separate from Vercel app domains:

- `files-test.app.pest.gg` should point to the staging R2 bucket
- `files.app.pest.gg` should point to the production R2 bucket

Keep Vercel app DNS records as DNS-only when Vercel asks for direct validation.
Keep R2 custom domains managed by Cloudflare R2.
