# Summary

Describe the backend template change in one or two sentences.

## Scope

- Change type: API route / Capability / Provider / Auth / Storage / Queue / UI / Docs
- Target area:
- Endpoint or capability name:
- Auth requirement:
- Expected behavior:
- Request shape:
- Response shape:
- Files or modules likely involved:
- Files expected to touch:
- Non-goals:

## API Contract

Fill this section when the issue touches `/api/v1`, a capability, provider,
Inngest job, or webhook. Use `n/a` only for clearly docs-only or non-API work.

- API manual reviewed: `docs/pestgg-api-design-manual.md`
- API category: App API / Provider webhook / Inngest / Admin / Public / n/a
- Method and path:
- Auth requirement:
- Workspace rule:
- Request body or query:
- Success status and response fields:
- Failure responses:
- Async behavior: none / creates job / emits Inngest event / waits for webhook
- Mobile client impact:
- Docs to update:

## Acceptance Criteria

- [ ] Implementation is committed on an issue branch.
- [ ] A PR is opened against the configured base branch.
- [ ] Relevant tests pass.
- [ ] `npm run verify` passes when the change touches runtime code.
- [ ] `npm run build` passes when the change touches Next.js app/routes.
- [ ] `npm run smoke:local` passes when the change touches `/api/v1` routes.
- [ ] API-affecting changes follow `docs/pestgg-api-design-manual.md`.
- [ ] API route changes follow `docs/api-authoring-playbook.md`.
- [ ] Capability changes follow `docs/tool-authoring-playbook.md`.
- [ ] Provider changes follow `docs/provider-authoring-playbook.md`.

## Notes

Mention environment, auth, storage, queue, or provider constraints here. If the
ticket needs credentials or external access, say so explicitly.
