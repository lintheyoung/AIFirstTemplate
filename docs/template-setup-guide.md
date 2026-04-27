# Template Setup Guide

Use this guide when cloning AI First Template into a new app backend. It is the
operator entry point before reading the deeper runbooks.

## What This Template Provides

- Clerk-authenticated `/api/v1/*` routes.
- Workspace-safe API actors through `requireClerkActor()`.
- Postgres persistence through Drizzle-ready schema files and migrations.
- Cloudflare R2 file upload, download, and generated-result persistence.
- Inngest background workers for async jobs and provider callbacks.
- Kie.ai image editing through the `kie-ai` provider.
- Vercel deployment checks pinned to the `sin1` region.
- Symphony automation scaffolding for Linear-driven development.

## Required Local Files

Copy the example files and fill the matching local files:

| Purpose | Example file | Local secret file |
| --- | --- | --- |
| Local development | `.env.example` | `.env.local` |
| Hosted test/staging | `.env.test.example` | `.env.test.local` |
| Hosted production | `.env.production.example` | `.env.production.local` |

The current project keeps these files at the repository root:

- `/Users/dede/Downloads/PestGGAppCat/AIFirstTemplate/.env.local`
- `/Users/dede/Downloads/PestGGAppCat/AIFirstTemplate/.env.test.local`
- `/Users/dede/Downloads/PestGGAppCat/AIFirstTemplate/.env.production.local`

Do not commit `.env.local`, `.env.test.local`, or `.env.production.local`.

## Environment Variables

Every environment must provide the same contract:

```env
APP_ENV=
NEXT_PUBLIC_APP_URL=
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_ENV=
KIE_API_KEY=
KIE_CALLBACK_BASE_URL=
KIE_WEBHOOK_HMAC_KEY=
```

Recommended values by environment:

| Variable | Local | Test | Prod |
| --- | --- | --- | --- |
| `APP_ENV` | `dev` | `test` | `prod` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3024` | `https://test.app.pest.gg` | `https://app.pest.gg` |
| `KIE_CALLBACK_BASE_URL` | `http://localhost:3024` | `https://test.app.pest.gg` | `https://app.pest.gg` |
| `INNGEST_ENV` | `dev` | `test` | `Production` |
| `R2_BUCKET_NAME` | disposable dev bucket | `pest-gg-app-staging` | `pest-gg-app-prod` |

For a new project, replace the domains and bucket names with that project's
values, then update `config/project.ts` so contract checks know the expected
test and prod buckets.

## Where Credentials Come From

| Variable | Source |
| --- | --- |
| `DATABASE_URL` | Neon or another Postgres provider. Use pooled URLs for Vercel. |
| `CLERK_SECRET_KEY` | Clerk Dashboard -> API keys. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard -> API keys. |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard account details. |
| `R2_BUCKET_NAME` | Cloudflare R2 Object Storage. |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API token, S3-compatible credentials. |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token secret, copied at creation time. |
| `R2_PUBLIC_BASE_URL` | R2 custom domain or public bucket base URL. |
| `INNGEST_EVENT_KEY` | Inngest environment -> Event Keys. |
| `INNGEST_SIGNING_KEY` | Inngest environment -> Signing Key. |
| `KIE_API_KEY` | Kie.ai Dashboard -> API Keys. |
| `KIE_WEBHOOK_HMAC_KEY` | Kie.ai Dashboard -> Settings -> Webhook HMAC Key. |

Kie.ai webhook verification uses `taskId`, `X-Webhook-Timestamp`,
`X-Webhook-Signature`, and `KIE_WEBHOOK_HMAC_KEY`. Keep one HMAC key per app
account unless the provider account is intentionally shared.

## First Local Run

```bash
npm install
cp .env.example .env.local
npm run check:env-contract -- .env.example
npm run dev
```

Open `http://localhost:3024`. The Clerk pages live at `/sign-in` and
`/sign-up`.

## Vercel Setup

1. Run `vercel link` from the repository root.
2. Add all `.env.test.local` values to Vercel Preview.
3. Add all `.env.production.local` values to Vercel Production.
4. Confirm `vercel.json` keeps `"regions": ["sin1"]`.
5. Deploy Preview and assign the test domain.
6. Deploy Production only after test smoke passes.

Vercel environment variable changes apply only to new deployments. If a secret
changes, redeploy before testing runtime behavior.

## Inngest Setup

Sync each environment to its matching endpoint:

| Inngest environment | Endpoint |
| --- | --- |
| `test` | `https://test.app.pest.gg/api/inngest` |
| `Production` | `https://app.pest.gg/api/inngest` |

The template currently exposes two functions when the Kie image workflow is
deployed:

- `run-job-created`
- `handle-kie-flux-callback`

`GET /api/inngest` should report `has_event_key: true`,
`has_signing_key: true`, and `function_count >= 2` after the image workflow is
deployed.

## Smoke Checklist

Run local checks first:

```bash
npm run typecheck
npm run lint
npm test
npm run check:env-contract -- .env.test.example
npm run deploy:preflight -- --env-file .env.test.local --expect-env test
npm run deploy:preflight -- --env-file .env.production.local --expect-env prod
```

Run hosted smoke after aliases are assigned:

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

For authenticated smoke, add a Clerk session token:

```bash
SMOKE_CLERK_BEARER_TOKEN=replace_with_session_token
```

## Read Next

- API work: `docs/api-authoring-playbook.md`
- Capability work: `docs/tool-authoring-playbook.md`
- Provider work: `docs/provider-authoring-playbook.md`
- Env and deploy work: `docs/environment-runbook.md` and
  `docs/deployment-runbook.md`
- Release promotion: `docs/release-playbook.md`
- Symphony automation: `symphony/README.md`
