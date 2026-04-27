# Environment Runbook

This starter treats dev, test, and prod as separate operating environments,
not as labels on the same resources. The contract is enforced by
`.env.example`, `.env.test.example`, `.env.production.example`,
`lib/env/schema.ts`, and `scripts/check-env-contract.ts`.

## Resource Separation

| Environment | Branch | URL Default | Required Resources |
| --- | --- | --- | --- |
| `dev` | `feature/*` or any non-release branch | `http://localhost:3024` | local or disposable services |
| `test` | `staging` | `https://test.app.pest.gg` | staging Clerk, database, R2 bucket, queue |
| `prod` | `main` | `https://app.pest.gg` | production Clerk, database, R2 bucket, queue |

The starter defaults are defined in `config/platform.ts` and
`config/project.ts`. `branchToEnvironment()` maps `staging` to `test`, `main`
to `prod`, and every other branch to `dev`.

## Required Variables

Every environment must provide:

- `APP_ENV`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_ENV`
- `KIE_API_KEY`
- `KIE_CALLBACK_BASE_URL`
- `KIE_WEBHOOK_HMAC_KEY`

`APP_ENV=test` must use `projectConfig.storageBuckets.test`
(`pest-gg-app-staging` in this project). `APP_ENV=prod` must use
`projectConfig.storageBuckets.prod` (`pest-gg-app-prod` in this project).
`INNGEST_ENV` must be `test` for test and `Production` for prod so Inngest app
syncs and events land in the intended environment.

For the `kie-ai` image provider, set `KIE_CALLBACK_BASE_URL` to the hosted app
origin for the same environment, for example `https://test.app.pest.gg` or
`https://app.pest.gg`. `KIE_API_KEY` and `KIE_WEBHOOK_HMAC_KEY` must come from
the matching kie.ai environment or account settings.

## Contract Checks

Run the environment contract before any hosted deploy or release promotion:

```bash
npm run check:env-contract -- .env.example
npm run check:env-contract -- .env.test.example
npm run check:env-contract -- .env.production.example
```

For copied or generated env files, pin the intended environment:

```bash
npm run check:env-contract -- --expect-env test .env.test.local
npm run check:env-contract -- --expect-env prod .env.production.local
```

The command must print JSON with `"status": "ok"` and the expected
`appEnv`, `appUrl`, and `bucket`.

Before hosted deployment, also run `npm run deploy:preflight` so Vercel region
and Inngest environment checks are covered.

## Stop Conditions

Stop the deploy or smoke if any of these are true:

- Test uses a bucket containing `prod` or `production`.
- Prod uses a bucket containing `staging`, `stage`, `test`, or `dev`.
- Test does not use `pest-gg-app-staging` after `config/project.ts` is applied.
- Prod does not use `pest-gg-app-prod` after `config/project.ts` is applied.
- Hosted smoke writes to the wrong database, bucket, queue, or Clerk app.
- Hosted smoke does not show Vercel `sin1` in `x-vercel-id`.

Fix the environment contract before debugging application behavior.
