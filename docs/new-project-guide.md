# New Project Guide

Use this starter for a SaaS backend that needs authenticated actors,
workspaces, API keys, file upload intents, job execution, provider dispatch,
and separate dev/test/prod operations from the first commit.

## First Setup

1. Clone the repository and rename the package in `package.json`.
2. Update `config/project.ts`: `name`, `slug`, `supportEmail`, public domains,
   and the `storageBuckets.test` / `storageBuckets.prod` names.
3. Copy `.env.example` to `.env.local` for dev and fill in Clerk, Postgres,
   R2-compatible storage, and Inngest-compatible queue credentials.
4. Run `npm install`.
5. Run `npm run check:env-contract -- .env.example`.
6. Run `npm test`, then `npm run dev`.

The local app listens on `http://localhost:3024` by default.

## Environment Model

The starter uses `APP_ENV=dev`, `APP_ENV=test`, and `APP_ENV=prod`.
Development can use local or disposable services. Test must use staging
services. Prod must use production services. The env parser in
`lib/env/schema.ts` rejects test environments that point at the production
bucket and rejects prod environments that point at staging, test, or dev
buckets.

Keep branch ownership simple:

| Environment | Branch | Resource Class |
| --- | --- | --- |
| `dev` | `feature/*` or any non-release branch | local or disposable |
| `test` | `staging` | staging database, bucket, queue, and Clerk app |
| `prod` | `main` | production database, bucket, queue, and Clerk app |

## Customize Safely

Start customization at the edges:

- Project identity lives in `config/project.ts`.
- Branch and environment defaults live in `config/platform.ts`.
- Required env names live in `lib/env/schema.ts` and the `.env*.example`
  files.
- Public API behavior lives under `app/api/v1`.
- Provider behavior lives under `lib/providers`.

Avoid adding product-specific behavior to platform core modules such as
`lib/auth`, `lib/files`, `lib/jobs`, `lib/storage`, and `lib/workspaces`.
Those modules should stay reusable across products.

## First Smoke

After the app starts, smoke the API surface that new clients will use:

- `GET /api/v1/me`
- `GET /api/v1/capabilities`
- `POST /api/v1/files/create-upload`
- `POST /api/v1/jobs`

Use `example.echo` with provider `echo` for JSON-only smoke and
`example.file_transform` with provider `example-transform` for file-derived
work.
