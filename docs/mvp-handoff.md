# AI First Template MVP Handoff

## Built

- Clean starter repository.
- dev/test/prod environment model.
- Typed env validation and env contract check.
- Request envelopes and API errors.
- Core database schema.
- Actor and API key foundations.
- File storage adapter boundary.
- Job state machine.
- Provider adapter boundary.
- Example capabilities.
- Machine-facing `/api/v1` routes.
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

- Replace demo actor with real Clerk/API-key auth in route integration.
- Add database-backed repositories for files and jobs.
- Add migrations and seed command.
- Connect the queue adapter to real Inngest functions.
