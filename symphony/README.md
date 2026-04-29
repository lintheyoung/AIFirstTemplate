# Backend Starter Symphony Control

This directory contains the project-level Symphony configuration for using
Linear as the control plane for this backend starter.

It does not vendor the Symphony runtime. The template pins the runtime in
`runtime.lock` and can bootstrap it into a local cache, while still allowing
advanced users to override `SYMPHONY_ELIXIR_ROOT`.

## What It Adds

- Linear workflow template for backend starter work.
- Profile-based environment files.
- Workflow renderer for `.env.local` plus profile values.
- Runtime bootstrap script and launch script for the Symphony Elixir runtime.
- Linear issue and state-machine documentation.

## Runtime Bootstrap

The easiest path is to let this template prepare the runtime from
`runtime.lock`:

```bash
cd /path/to/aifirst-template/symphony
./scripts/bootstrap_runtime.sh
```

The script:

- uses `SYMPHONY_ELIXIR_ROOT` when it points at an existing executable runtime
- otherwise clones `SYMPHONY_RUNTIME_REPO` at `SYMPHONY_RUNTIME_REF`
- stores the clone under `SYMPHONY_RUNTIME_CACHE_DIR`
- builds `elixir/bin/symphony` with `mise exec -- mix escript.build` when needed
- prints the resolved `elixir` directory

The default runtime pin lives in `runtime.lock`.

You can also bring your own runtime:

```bash
git clone https://github.com/openai/symphony.git /absolute/path/to/symphony
cd /absolute/path/to/symphony/elixir
mise install
mise exec -- mix deps.get
mise exec -- mix escript.build
export SYMPHONY_ELIXIR_ROOT=/absolute/path/to/symphony/elixir
```

Then configure this template:

```bash
cd /path/to/aifirst-template/symphony
cp .env.example .env.local
cp profiles/aifirst-template.env.example profiles/aifirst-template.env.local
```

Set at least:

```bash
LINEAR_API_KEY=lin_api_...
WORKSPACE_ROOT=/absolute/path/to/aifirst-template-symphony/workspaces
```

In `profiles/aifirst-template.env.local`, set:

```bash
LINEAR_PROJECT_SLUG=your-linear-project-slug
TARGET_REPO_URL=https://github.com/your-org/your-repo.git
TARGET_REPO_BASE_BRANCH=template
```

Use `TARGET_REPO_BASE_BRANCH=template` while evolving this starter template.
For a product cloned from the template, change it to that repository's normal
integration branch, such as `staging` or `main`.

## Linear Setup

Create one Linear project for this repository and add the states described in
[docs/linear-state-machine.md](docs/linear-state-machine.md).

Use [templates/LINEAR_ISSUE_TEMPLATE.md](templates/LINEAR_ISSUE_TEMPLATE.md)
when writing issues that should be executable by Symphony.

## API Design Gate

Symphony must treat [../docs/pestgg-api-design-manual.md](../docs/pestgg-api-design-manual.md)
as the product API contract for all PestGGApp backend work. Any issue that
touches `/api/v1`, a capability, provider adapter, Inngest job, or provider
webhook must read that manual before implementation.

API-related issues should include the API Contract block from
[templates/LINEAR_ISSUE_TEMPLATE.md](templates/LINEAR_ISSUE_TEMPLATE.md). If the
contract is missing or vague, Symphony should ask for the missing information in
Linear and move the issue to `Human Review` instead of guessing.

Pull requests that change API behavior must explain how they follow the manual:
method and path, auth behavior, workspace rule, request shape, response shape,
errors, async behavior, and tests. A PR that conflicts with the API manual
should go to `Rework`, not `Human Review` or `Merging`.

## Linear Intake Environment

Symphony polls Linear through the workflow rendered from `.env.local` and the
selected profile file. These variables decide which Linear tasks this runner can
see and claim:

| Variable | File | Purpose |
| --- | --- | --- |
| `LINEAR_API_KEY` | `symphony/.env.local` | Linear personal API key used to read issues, write comments, and move states. |
| `LINEAR_PROJECT_SLUG` | `symphony/profiles/<profile>.env.local` | Linear project slug that this Symphony instance polls. |
| `TRACKER_LABEL` | `symphony/profiles/<profile>.env.local` | Label filter for issues owned by this runner/profile. |
| `OPENCODE_REVIEW_REQUIRED` | `symphony/profiles/<profile>.env.local` | Set to `true` when PRs must pass local opencode review before human handoff. |
| `OPENCODE_COMMAND` | `symphony/.env.local` or profile env | Local opencode binary or absolute path. Defaults to `opencode`. |
| `OPENCODE_REVIEW_TIMEOUT_SECONDS` | `symphony/.env.local` or profile env | Timeout for each local opencode review round. Defaults to `180`. |
| `EXTERNAL_CODE_REVIEW_REQUIRED` | `symphony/profiles/<profile>.env.local` | Optional. Set to `true` only when PRs must also pass a GitHub review check/status. |
| `EXTERNAL_CODE_REVIEW_CHECKS` | `symphony/profiles/<profile>.env.local` | Optional comma-separated GitHub check/status names, such as `CodeRabbit`. |
| `HUMAN_APPROVAL_PHRASE` | `symphony/profiles/<profile>.env.local` | Exact Linear comment phrase a human must add before moving an issue from `Human Review` to `Merging`. |

The workflow only treats issues in the configured active states as eligible:
`Todo`, `In Progress`, `Code Review`, `Rework`, and `Merging`. New executable
work should start in `Todo` and carry the configured `TRACKER_LABEL`.

Use `CODEX_COMMAND="codex app-server"` for local runners. Plain `codex` starts
the interactive CLI and exits under Symphony instead of opening the app-server
JSON-RPC stream.

For multiple runners, give each profile a distinct `LINEAR_PROJECT_SLUG` or
`TRACKER_LABEL`. If two runners share both values, they may compete for the same
Linear issue stream.

## Render The Workflow

```bash
python3 ./scripts/bootstrap_workflow.py \
  --template ./templates/WORKFLOW.linear.template.md \
  --output ./generated/WORKFLOW.generated.md \
  --env-file ./.env.local \
  --env-file ./profiles/aifirst-template.env.local
```

The rendered file must not contain any `__PLACEHOLDER__` values.

## Start Symphony

```bash
./scripts/start_backend_symphony.sh
```

The script:

- loads `symphony/.env.local`
- loads `symphony/profiles/${SYMPHONY_PROFILE}.env.local`
- bootstraps or resolves the Symphony runtime from `runtime.lock`
- validates required Linear, GitHub, and repository settings
- renders a profile-and-port-specific generated workflow
- imports `GH_TOKEN` from `gh auth token` when `GH_TOKEN` is not already set
- executes the external runtime with the generated workflow

## Run Multiple Symphony Instances

Multiple Symphony instances can run on the same machine as long as each one has
its own profile, port, project name, tracker scope, and workspace root.

Create one profile file per instance:

```bash
cp profiles/aifirst-template.env.example profiles/pest-prod.env.local
cp profiles/aifirst-template.env.example profiles/pest-test.env.local
```

Example `profiles/pest-prod.env.local`:

```bash
PROJECT_NAME="PestGG Production Symphony"
LINEAR_PROJECT_SLUG=pest-prod
TARGET_REPO_NAME=pest-gg-app
TARGET_REPO_URL=https://github.com/your-org/pest-gg-app.git
TARGET_REPO_BASE_BRANCH=main
TRACKER_LABEL=pest-prod
SERVER_PORT=4013
WORKSPACE_ROOT=/absolute/path/to/symphony-workspaces/pest-prod
```

Example `profiles/pest-test.env.local`:

```bash
PROJECT_NAME="PestGG Test Symphony"
LINEAR_PROJECT_SLUG=pest-test
TARGET_REPO_NAME=pest-gg-app
TARGET_REPO_URL=https://github.com/your-org/pest-gg-app.git
TARGET_REPO_BASE_BRANCH=staging
TRACKER_LABEL=pest-test
SERVER_PORT=4014
WORKSPACE_ROOT=/absolute/path/to/symphony-workspaces/pest-test
```

Start each instance from a separate terminal window:

```bash
SYMPHONY_PROFILE=pest-prod ./scripts/start_backend_symphony.sh
SYMPHONY_PROFILE=pest-test ./scripts/start_backend_symphony.sh
```

`SERVER_PORT` controls the local Symphony server window, for example
`http://127.0.0.1:4013` and `http://127.0.0.1:4014`. `PROJECT_NAME` is the
human-readable name Symphony sees in the workflow prompt, so make it unique
enough to identify the window. `WORKSPACE_ROOT` must also be unique per
instance so two runners never clone or edit inside the same workspace tree.

The launch script renders a profile-and-port-specific workflow file under
`generated/`, such as `WORKFLOW.pest-prod.4013.generated.md`, to avoid multiple
instances overwriting the same generated workflow.

## Daily Flow

1. Create a Linear issue in `Todo`.
2. Symphony creates an isolated workspace under `WORKSPACE_ROOT`.
3. Symphony creates an issue branch and PR against `TARGET_REPO_BASE_BRANCH`.
4. Symphony records validation and moves the issue to `Code Review`.
5. In `Code Review`, Symphony runs two local opencode review rounds. Optional
   GitHub review checks, such as CodeRabbit, can be enforced after opencode if
   configured.
6. Symphony moves accepted work to `Human Review` and stops, or moves work with
   concrete review findings to `Rework`.
7. A human reviews the PR, adds the configured approval phrase as a Linear
   comment, then moves the issue to `Merging`.
8. Symphony merges the PR into the integration branch, runs or records required
   staging/test smoke evidence, and only marks `Done` when the configured
   release policy is satisfied.

`Human Review` is intentionally a hard waiting state. Moving a ticket to
`Merging` by script without the approval comment is not a valid human review.
Likewise, Symphony self-review is not the same thing as local opencode review.
The default automated review gate is local opencode, not a GitHub bot comment.
GitHub review bots can be added as an extra check by setting
`EXTERNAL_CODE_REVIEW_REQUIRED=true` and listing their stable check/status names
in `EXTERNAL_CODE_REVIEW_CHECKS`.

## Code Review

The template includes local review helpers:

```bash
python3 symphony/scripts/run_opencode_review.py round1 origin/<integration-branch>
python3 symphony/scripts/run_opencode_review.py round2 origin/<integration-branch>
```

When launched by `start_backend_symphony.sh`, the rendered workflow injects the
absolute `SYMPHONY_CONTROL_ROOT` path and calls the helper from this control
directory. That keeps review working even if the target repo branch does not yet
contain the latest helper scripts. Each round calls `opencode run` through
`symphony/scripts/opencode_review_wrapper.py` and normalizes the result to:

```json
{
  "outcome": "approve",
  "summary": "short summary",
  "findings": []
}
```

Valid outcomes are `approve`, `changes_requested`, and `needs_human_info`.
`changes_requested` sends the issue to `Rework`; `needs_human_info` sends it to
`Human Review` with a blocker or decision request; two approvals send it to
`Human Review` for the real human gate. Symphony should write the opencode
review result to Linear and to GitHub. It should prefer
`gh pr review --comment` so GitHub records a formal PR review event, and fall
back to `gh pr comment` only if the review command is rejected. Use a visible
`## Opencode Review` heading so the evidence is easy to inspect during Human
Review.

If opencode is not on `PATH`, set `OPENCODE_COMMAND` to the absolute binary
path in `symphony/.env.local` or the active profile env file.

## Release Boundary

The normal runner owns development through staging/test verification:

```text
Todo -> In Progress -> Code Review -> Human Review -> Merging -> staging/test evidence
```

Production promotion is intentionally human-operated unless a dedicated release
operator issue says otherwise. For a production release, the human operator
should promote the hosted app/API first, wait for production deploy and infra
checks, refresh async endpoints when needed, run production smoke, then promote
or publish dependent clients. Mark `Done` only after the production evidence is
recorded in Linear.

## Safety Notes

- The runner uses `danger-full-access` because it must edit files, run tests,
  use Git, and create PRs. Run it only in trusted repositories.
- Keep `LINEAR_API_KEY`, `GH_TOKEN`, and generated workflow files out of Git.
- Do not point `WORKSPACE_ROOT` at this repository root.
- Use separate Linear projects or labels for separate repositories.
