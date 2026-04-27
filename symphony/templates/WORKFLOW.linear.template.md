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
- Symphony control root: __SYMPHONY_CONTROL_ROOT__
- Target repository: __TARGET_REPO_URL__
- Integration branch for PRs: __TARGET_REPO_BASE_BRANCH__
- Local opencode review required: __OPENCODE_REVIEW_REQUIRED__
- Local opencode command: __OPENCODE_COMMAND__
- Local opencode timeout seconds: __OPENCODE_REVIEW_TIMEOUT_SECONDS__
- Optional external GitHub review checks or statuses required: __EXTERNAL_CODE_REVIEW_REQUIRED__
- Optional external GitHub review check/status names: __EXTERNAL_CODE_REVIEW_CHECKS__
- Human approval phrase: __HUMAN_APPROVAL_PHRASE__

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
   - `Code Review` -> run local opencode review, optionally enforce external GitHub review checks, then route to `Human Review` or `Rework`.
   - `Rework` -> address review feedback on the PR branch, revalidate, update PR, then hand back to `Code Review`.
   - `Merging` -> after explicit human approval, merge the approved PR into `__TARGET_REPO_BASE_BRANCH__`, run required staging/test verification, record evidence, and only mark `Done` when the release policy below is satisfied.
5. `Human Review` is a waiting state and should not be actively worked.
6. `Done` is terminal and should not be worked.
7. If blocked by missing auth, permissions, credentials, or required external access:
   - create one concise blocker comment in Linear
   - move the issue to `Human Review`
   - stop after writing the blocker and moving the issue
8. Do not ask the user to manually continue work unless there is a real blocker or a required human release gate.

Delivery model:

- A Linear issue should normally target exactly one repository.
- If a feature spans multiple repositories, split it into separate Linear issues.
- For hosted API plus client/CLI work, deliver the hosted contract first, verify
  it in test/staging, then let the client issue consume that stable contract.
- Ordinary feature work targets the configured integration branch
  `__TARGET_REPO_BASE_BRANCH__`, which should usually be `staging` for product
  repositories and may be `main` or `template` only for simple starter-template
  maintenance.
- Production promotion is a separate human-operated release path. Do not let an
  ordinary runner push directly to `main`, publish packages, or mark production
  release work complete without explicit human release evidence.

Task classification:

- `simple` means the ticket is low-risk and narrow in scope, such as docs-only
  changes, `.env.example` updates, isolated scripts, single-route wiring, or
  changes that touch one or two tightly related files.
- `complex` means the ticket changes behavior or crosses multiple layers, such
  as API routes plus services, database schema, auth/session behavior,
  providers, queues, storage, or release verification.

Repository playbooks:

- For `/api/v1` route changes, read `docs/api-authoring-playbook.md` before
  editing.
- For capability changes, read `docs/tool-authoring-playbook.md` before editing.
- For provider changes, read `docs/provider-authoring-playbook.md` before
  editing.
- For environment or deployment changes, read `docs/environment-runbook.md` and
  `docs/deployment-runbook.md` before editing.

API work rules:

- All `/api/v1/*` routes must require Clerk authentication and call
  `requireClerkActor()` in the route handler before accessing workspace data.
- API handlers must return the normalized API response envelope and must not
  return raw framework errors for handled failures.
- Keep product-specific behavior out of `lib/auth`, `lib/request`,
  `lib/storage`, and `lib/workspaces` unless the issue explicitly changes that
  platform layer.
- Capability behavior belongs in `app/api/v1/capabilities/route.ts`,
  `app/api/v1/jobs/route.ts`, `lib/jobs/service.ts`, and provider adapters.
- Provider behavior belongs under `lib/providers` and must respect
  `lib/providers/types.ts`.
- Add or update `tests/integration/api-v1-routes.test.ts` for API route
  behavior, or create a focused integration test when the existing file would
  become unclear.
- Record the Endpoint or capability, auth behavior, request shape, response
  shape, tests, and smoke result in the handoff comment.

Simple-task path:

- Start with a quick repository scan.
- Do not create heavyweight planning artifacts unless the issue asks for them.
- Implement directly after the quick scan.
- Run the smallest validation that proves the task is complete.
- Still use a normal branch, commit, push, PR, opencode review, checks, and `Human Review`
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
- Hosted test smoke: command, result, job id, bucket, or not applicable

### Review
- Opencode round 1: approve / changes_requested / needs_human_info
- Opencode round 2: approve / changes_requested / needs_human_info

### Endpoint or capability
- ...

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
  `gh pr checks` is green when checks exist, local opencode review is satisfied,
  any optional external GitHub review checks are satisfied, and a brief
  self-review has been completed.

Local opencode review policy:

- Local opencode review is the default automated code review gate.
- In `Code Review`, do not implement feature work first. Review the PR branch
  exactly as it stands.
- If `Local opencode review required` is `true`, run two sequential local review
  rounds from the workspace checkout:
  - `python3 __SYMPHONY_CONTROL_ROOT__/scripts/run_opencode_review.py round1 origin/__TARGET_REPO_BASE_BRANCH__`
  - `python3 __SYMPHONY_CONTROL_ROOT__/scripts/run_opencode_review.py round2 origin/__TARGET_REPO_BASE_BRANCH__`
- Use the `Symphony control root` helper path above for review calls. Do not
  assume the target repository branch already contains the review helper files.
- Both rounds must return JSON with one of these outcomes:
  - `approve`
  - `changes_requested`
  - `needs_human_info`
- Round 1 focuses on correctness, regressions, and obvious bugs.
- Round 2 focuses on maintainability, tests, and edge cases.
- If either round returns `changes_requested`, create one Linear review comment
  and one GitHub PR review/comment summarizing the requested changes, move the
  issue to `Rework`, and stop.
- If either round returns `needs_human_info`, create one Linear review comment
  and one GitHub PR review/comment summarizing the missing decision or context,
  move the issue to `Human Review`, and stop.
- If both rounds return `approve`, create one Linear review summary comment and
  one GitHub PR review/comment with both opencode round summaries, move the
  issue to `Human Review`, and stop.
- Prefer `gh pr review <number> --comment --body-file <file>` so GitHub records
  a formal PR review event. If GitHub rejects that review command, fall back to
  `gh pr comment <number> --body-file <file>`.
- Use a clear heading such as `## Opencode Review` so the human reviewer can
  find the automated review evidence on GitHub.
- Use non-interactive review calls through `__OPENCODE_COMMAND__ run`.
- Default timeout per review round is `__OPENCODE_REVIEW_TIMEOUT_SECONDS__`
  seconds.
- Before starting a review round, terminate stale local review processes that
  match `__OPENCODE_COMMAND__ run`.
- If a round times out once, terminate the stale process and retry that same
  round exactly one time.
- If the retry still times out or returns no structured JSON, treat it as
  `needs_human_info` and move the issue to `Human Review`.
- Prefer passing the minimal relevant changed file paths to
  `run_opencode_review.py` after the base ref, instead of reviewing unrelated
  files.
- Keep the review local; do not mutate code during the review phase.

Optional external GitHub review policy:

- GitHub bot checks are optional and separate from local opencode review.
- If `Optional external GitHub review checks or statuses required` is `true`,
  `gh pr checks` must include
  successful checks or statuses matching every comma-separated name in
  `Optional external GitHub review check/status names`.
- Example values include `CodeRabbit` or a repository GitHub Actions job name,
  depending on the installed review integration.
- If a required optional external review check is missing, pending, failing, or cannot be
  found, do not move the issue to `Human Review`. Leave one blocker comment in
  Linear explaining the missing review gate, keep or move the issue to
  `Code Review`, and stop.
- A PR comment from a review bot is useful context, but it does not satisfy this
  gate unless the matching GitHub check or status is successful.

Merging rules:

- If the issue is in `Merging`, find the open PR for the issue branch.
- Merge only after checks are green, local opencode review is satisfied, any
  optional external GitHub review policy is still satisfied, and human approval
  is explicit.
- Human approval is explicit only when the Linear issue has a non-Symphony
  comment containing the exact configured human approval phrase:
  `__HUMAN_APPROVAL_PHRASE__`
- If the issue is moved to `Merging` without that phrase, do not merge. Leave
  one blocker comment, move the issue back to `Human Review`, and stop.
- After the merge to `__TARGET_REPO_BASE_BRANCH__` succeeds, run any required
  staging/test smoke for the issue and record:
  - PR URL
  - commit SHA
  - test commands
  - job id, when applicable
  - storage bucket or environment target, when applicable
- If staging/test smoke fails, leave a blocker comment and stop. Do not promote
  to production.
- Production promotion is manual unless the Linear issue explicitly says this
  runner is acting as a release operator. The production path is:
  - promote hosted app/API from staging to main
  - wait for production deploy and infra checks
  - refresh production async endpoints, when applicable
  - run production smoke and verify production storage/host targets
  - promote/publish dependent client packages only after hosted production smoke
    passes
  - run published production client smoke, when applicable
- Only move the issue to `Done` after the required merge and smoke evidence has
  been recorded. For issues that require a separate human production promotion,
  leave the release handoff in Linear and stop instead of marking `Done`.
