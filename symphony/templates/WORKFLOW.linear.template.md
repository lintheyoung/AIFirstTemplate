---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "__LINEAR_PROJECT_SLUG__"
  label: "__TRACKER_LABEL__"
  active_states:
    - Todo
    - In Progress
    - Code Review
    - Rework
    - Merging
  terminal_states:
    - Done
    - Canceled
    - Cancelled
    - Duplicate
polling:
  interval_ms: 5000
workspace:
  root: __WORKSPACE_ROOT__
hooks:
  after_create: |
    git clone --depth 1 --branch __TARGET_REPO_BASE_BRANCH__ __TARGET_REPO_URL__ .
agent:
  max_concurrent_agents: __MAX_CONCURRENT_AGENTS__
  max_turns: __MAX_TURNS__
codex:
  command: __CODEX_COMMAND__
  approval_policy: never
  thread_sandbox: danger-full-access
  read_timeout_ms: 30000
  turn_timeout_ms: 600000
  turn_sandbox_policy:
    type: dangerFullAccess
    networkAccess: true
server:
  port: __SERVER_PORT__
  host: 127.0.0.1
---

You are working on a Linear ticket for the __TARGET_REPO_NAME__ repository.

Project runtime:
- Symphony project name: __PROJECT_NAME__
- Target repository: __TARGET_REPO_URL__
- Base branch for PRs: __TARGET_REPO_BASE_BRANCH__

Issue context:
- Issue ID: {{ issue.id }}
- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- State: {{ issue.state }}
- URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Core behavior:

1. Work only inside the provided repository workspace.
2. Use the injected `linear_graphql` tool for Linear writes.
3. Use `git` and `gh` for branch, PR, checks, and merge actions.
4. Route behavior by current Linear state:
   - `Todo` -> move to `In Progress`, then start execution.
   - `In Progress` -> implement, validate, create or update a PR against `__TARGET_REPO_BASE_BRANCH__`, then move to `Code Review`.
   - `Code Review` -> inspect the PR/diff, confirm validation evidence, leave a concise review summary, then move to `Human Review` or `Rework`.
   - `Rework` -> address review feedback on the PR branch, revalidate, update PR, then hand back to `Code Review`.
   - `Merging` -> merge the approved PR into `__TARGET_REPO_BASE_BRANCH__`, then move the issue to `Done`.
5. `Human Review` is a waiting state and should not be actively worked.
6. `Done` is terminal and should not be worked.
7. If blocked by missing auth, permissions, credentials, or required external access:
   - create one concise blocker comment in Linear
   - move the issue to `Human Review`
   - stop after writing the blocker and moving the issue
8. Do not ask the user to manually continue work unless there is a real blocker.

Task classification:

- `simple` means the ticket is low-risk and narrow in scope, such as docs-only
  changes, `.env.example` updates, isolated scripts, single-route wiring, or
  changes that touch one or two tightly related files.
- `complex` means the ticket changes behavior or crosses multiple layers, such
  as API routes plus services, database schema, auth/session behavior,
  providers, queues, storage, or release verification.

Simple-task path:

- Start with a quick repository scan.
- Do not create heavyweight planning artifacts unless the issue asks for them.
- Implement directly after the quick scan.
- Run the smallest validation that proves the task is complete.
- Still use a normal branch, commit, push, PR, checks, and `Human Review`
  handoff.

Complex-task path:

- Do a deeper repository scan before editing.
- Keep a local markdown note at `docs/workpad/{{ issue.identifier }}.md`.
- Update it with intended change, commands run, validation results, and blocker
  notes if any.
- Use broader verification before completion.
- Open or update a draft PR once the branch contains meaningful work.

Required completion behavior for all implementation tasks:

- Always transition `Todo` to `In Progress` before editing.
- Always create or update a dedicated branch named from the issue identifier,
  for example `symphony/{{ issue.identifier }}-short-title`.
- Always push changes and create or update a PR before handoff.
- Always target the PR at `__TARGET_REPO_BASE_BRANCH__`.
- Always run self-review and relevant validation before handoff.
- For runtime changes, prefer `npm run verify`.
- For Next.js app, route, or dashboard changes, also run `npm run build`.
- For `/api/v1` changes, also run `npm run smoke:local` when a local server is
  available; otherwise record that smoke is required before merge.
- For env or deployment changes, run the relevant `npm run check:env-contract`
  command.
- Always leave one implementation handoff comment when the PR is ready for code
  review.
- Always move the issue to `Code Review` when implementation is complete and
  PR-ready.
- Always stop after moving the issue to `Code Review`.
- Only move the issue to `Done` after the PR has been merged in the `Merging`
  state.

Implementation handoff comment format:

```md
## Symphony Update

### PR
- <PR URL>

### Changed
- ...

### Validation
- `...`

### Smoke
- Local smoke: passed / required before merge / not applicable

### Caveats
- None.
```

GitHub delivery rules:

- Create commits with concise messages.
- Push the branch before creating the PR.
- Create or update a PR with the issue identifier in the title.
- Prefer a draft PR while work is still underway.
- Before moving from `In Progress` to `Code Review`, make sure the branch is
  pushed, the PR exists, validation has been rerun after the latest changes, and
  the latest validation output is recorded.
- Before moving to `Human Review`, make sure relevant validation has passed,
  `gh pr checks` is green when checks exist, and a brief self-review has been
  completed.

Merging rules:

- If the issue is in `Merging`, find the open PR for the issue branch.
- Merge only after checks are green and the PR is approved, or the repository
  workflow explicitly allows owner-reviewed single-person merges.
- After merge succeeds, move the issue to `Done` and stop.
