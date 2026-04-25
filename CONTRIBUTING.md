# Contributing

AI First Template is intended to stay small, reusable, and safe to clone into
new products.

## Development

```bash
npm install
npm run verify
npm run build
```

Use focused commits and keep product-specific behavior out of the platform
core. New product capabilities should live behind provider adapters and should
be documented in `docs/tool-authoring-playbook.md`.

## Pull Requests

Before opening a PR:

- Run `npm run verify`.
- Run `npm run build` when changing app routes, dashboard pages, or Next.js
  configuration.
- Run `npm run smoke:local` when changing `/api/v1` behavior.
- Update `.env*.example` and `docs/environment-runbook.md` when adding
  environment variables.
- Update `symphony/README.md` when changing Linear/Symphony control behavior.

## Template Boundaries

- Do not commit real API keys, Linear tokens, GitHub tokens, database URLs, or
  storage credentials.
- Do not vendor the external Symphony Elixir runtime under `symphony/`.
- Keep `symphony/generated/` out of Git.
- Keep dev/test/prod resources separate in examples and docs.
