# Environment Runbook

This starter treats dev, test, and prod as separate operating environments,
not as labels on the same resources. The contract is enforced by
`.env.example`, `.env.test.example`, `.env.production.example`,
`lib/env/schema.ts`, and `scripts/check-env-contract.ts`.

## Resource Separation

| Environment | Branch | URL Default | Required Resources |
| --- | --- | --- | --- |
| `dev` | `feature/*` or any non-release branch | `http://localhost:3024` | local or disposable services |
| `test` | `staging` | `https://test.example.com` | staging Clerk, database, R2 bucket, queue |
| `prod` | `main` | `https://example.com` | production Clerk, database, R2 bucket, queue |

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

`APP_ENV=test` must use `projectConfig.storageBuckets.test`
(`aifirst-template-staging` in the template). `APP_ENV=prod` must use
`projectConfig.storageBuckets.prod` (`aifirst-template-prod` in the template).

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

## Stop Conditions

Stop the deploy or smoke if any of these are true:

- Test uses a bucket containing `prod` or `production`.
- Prod uses a bucket containing `staging`, `stage`, `test`, or `dev`.
- Test does not use `aifirst-template-staging` after `config/project.ts` is applied.
- Prod does not use `aifirst-template-prod` after `config/project.ts` is applied.
- Hosted smoke writes to the wrong database, bucket, queue, or Clerk app.

Fix the environment contract before debugging application behavior.
