# AI First Template MVP Handoff

## Built

- Clean starter repository.
- dev/test/prod environment model.
- Typed env validation and env contract check.
- Request envelopes and API errors.
- Core database schema.
- Clerk-backed actor foundation.
- API key foundations.
- File storage adapter boundary.
- Job state machine.
- Provider adapter boundary.
- Inngest queue adapter and `/api/inngest` sync endpoint.
- Example capabilities.
- Clerk-protected machine-facing `/api/v1` routes.
- Minimal dashboard shell.
- Operating docs.
- Local smoke script.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run check:env-contract -- .env.test.example`
- `npm run check:env-contract -- .env.production.example`
- `npm run build`
- `npm run smoke:local`

## Next

- Replace the starter single-workspace Clerk resolver with database-backed
  workspace membership and optional API-key actors.
- Add database-backed repositories for files and jobs.
- Add migrations and seed command.
- Persist async job status transitions from Inngest runs.
