# AI First Template

A reusable SaaS backend starter for products that need auth, workspaces, API
keys, files, jobs, provider dispatch, and a disciplined dev/test/prod release
model.

Use this repository as a template for AI-first products that want a backend
control plane and an optional Linear/Symphony automation loop from day one.

## Default Stack

- Next.js App Router
- Clerk
- Neon-compatible Postgres
- Drizzle
- Cloudflare R2-compatible storage
- Inngest-compatible queueing
- Vitest

## Environments

- `dev`: feature branch, local app, local or disposable resources.
- `test`: `staging` branch, hosted test domain, staging resources.
- `prod`: `main` branch, production domain, production resources.

## First Run

```bash
npm install
cp .env.example .env.local
npm run check:env-contract -- .env.example
npm run dev
```

Open `http://localhost:3024`.

For a full clone-to-deploy checklist, read
[Template Setup Guide](docs/template-setup-guide.md). For a product-level view
of what the backend already supports, read
[App Backend Capabilities](docs/app-backend-capabilities.md). For the
PestGGApp mobile backend API contract, read
[PestGGApp API Design Manual](docs/pestgg-api-design-manual.md).

## Required Credentials

Fill `.env.local` with one set of development credentials first. Use separate
projects, databases, buckets, and keys for `test` and `prod` before deploying.

| Variable | Get it from | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Your local or hosted app URL | Local default is `http://localhost:3024`. |
| `DATABASE_URL` | [Neon Console](https://console.neon.tech/app/projects) -> project -> **Connect** | Use a pooled connection string for hosted serverless deployments. Neon docs: [Connect from any application](https://neon.com/docs/get-started-with-neon/connect-neon). |
| `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com/) -> project -> **API keys** | Backend secret key. Keep it server-side only. Clerk docs: [Environment variables](https://clerk.com/docs/upgrade-guides/api-keys). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com/) -> project -> **API keys** | Frontend publishable key. It is expected to be public. |
| `R2_ACCOUNT_ID` | [Cloudflare Dashboard](https://dash.cloudflare.com/) -> account | Account ID for the R2 endpoint. |
| `R2_BUCKET_NAME` | [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/r2) -> **R2 Object Storage** -> bucket | Use different buckets for dev, test, and prod. |
| `R2_ACCESS_KEY_ID` | [Cloudflare R2 API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) -> **Create API token** | S3-compatible access key ID. Cloudflare docs: [R2 authentication](https://developers.cloudflare.com/r2/api/tokens/). |
| `R2_SECRET_ACCESS_KEY` | [Cloudflare R2 API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) -> **Create API token** | Copy when the token is created; store as a secret. |
| `R2_PUBLIC_BASE_URL` | Your R2 public bucket URL or custom domain | Only needed for public file URLs. Keep private file access on signed URLs. |
| `INNGEST_EVENT_KEY` | [Inngest Dashboard](https://app.inngest.com/) -> environment -> **Manage** -> **Event Keys** | Used to send events. Inngest docs: [Creating an Event Key](https://www.inngest.com/docs/events/creating-an-event-key). |
| `INNGEST_SIGNING_KEY` | [Inngest Dashboard](https://app.inngest.com/) -> environment -> **Signing Key** | Used to verify Inngest requests. Inngest docs: [Signing keys](https://www.inngest.com/docs/platform/signing-keys). |
| `INNGEST_ENV` | Your Inngest environment name | Keeps function sync and events grouped under the intended Inngest environment, for example `test` or `Production`. |
| `KIE_API_KEY` | kie.ai API key management | Required for the `kie-ai` image provider. |
| `KIE_CALLBACK_BASE_URL` | Hosted app URL for the target environment | Base URL used to build `/api/webhooks/kie/flux-kontext`. |
| `KIE_WEBHOOK_HMAC_KEY` | kie.ai webhook settings | Shared secret used to verify Flux Kontext callbacks. |

After filling an env file, run:

```bash
npm run check:env-contract -- .env.example
npm run check:env-contract -- .env.test.example
npm run check:env-contract -- .env.production.example
```

## Operating Checks

```bash
npm run check:env-contract -- .env.example
npm test
npm run typecheck
npm run lint
npm run build
```

Before hosted deploys, run `npm run deploy:preflight`. After assigning a
hosted alias, run `npm run smoke:hosted` with `SMOKE_BASE_URL`,
`SMOKE_EXPECT_ENV`, and `SMOKE_EXPECT_REGION`.

CI runs `npm run verify` and `npm run build` on pull requests.

## Database Migrations

SQL migrations live in [migrations/](migrations/). Apply them manually until the
repo adds a migration runner; migration files are written to be safe on existing
Postgres databases where possible.

## API Surface

- `GET /api/v1/me`
- `GET /api/v1/capabilities`
- `POST /api/v1/files/create-upload`
- `POST /api/v1/files/:fileId/complete`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/:jobId`
- `POST /api/webhooks/kie/flux-kontext`
- `GET|POST|PUT /api/inngest`

All `/api/v1/*` routes require a signed-in Clerk user. Starter capabilities are
`example.echo` on provider `echo` and `example.file_transform` on provider
`example-transform`; the file transform capability supports async dispatch
through Inngest.

The `image.edit` capability uses provider `kie-ai` and runs asynchronously. App
clients upload a source image, complete the upload, create an async job with
`source_file_id` and `prompt`, then poll `GET /api/v1/jobs/:jobId`.

## Linear/Symphony Control

The `template` branch includes a project-level Symphony control package under
[symphony/](symphony/). Use it when you want Linear issues to drive isolated
implementation runs against this starter or a product cloned from it.

The package does not vendor the Symphony Elixir runtime. Configure the external
runtime with `SYMPHONY_ELIXIR_ROOT`, then fill the Linear and GitHub settings in
`symphony/.env.local` and `symphony/profiles/aifirst-template.env.local`.

Start here:

- [Symphony Control README](symphony/README.md)
- [Linear State Machine](symphony/docs/linear-state-machine.md)
- [Linear Issue Template](symphony/templates/LINEAR_ISSUE_TEMPLATE.md)

## Read Next

- [Template Setup Guide](docs/template-setup-guide.md)
- [App Backend Capabilities](docs/app-backend-capabilities.md)
- [PestGGApp API Design Manual](docs/pestgg-api-design-manual.md)
- [New Project Guide](docs/new-project-guide.md)
- [Environment Runbook](docs/environment-runbook.md)
- [Deployment Runbook](docs/deployment-runbook.md)
- [Release Playbook](docs/release-playbook.md)
- [API Authoring Playbook](docs/api-authoring-playbook.md)
- [Capability Authoring Playbook](docs/tool-authoring-playbook.md)
- [Provider Authoring Playbook](docs/provider-authoring-playbook.md)

## Open Source

AI First Template is released under the [MIT License](LICENSE). Contributions
are welcome through normal GitHub pull requests; read [CONTRIBUTING.md](CONTRIBUTING.md)
and [SECURITY.md](SECURITY.md) before submitting changes.
