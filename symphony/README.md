# Backend Starter Symphony Control

This directory contains the project-level Symphony configuration for using
Linear as the control plane for this backend starter.

It does not vendor the Symphony runtime. The runtime remains external and is
referenced through `SYMPHONY_ELIXIR_ROOT`.

## What It Adds

- Linear workflow template for backend starter work.
- Profile-based environment files.
- Workflow renderer for `.env.local` plus profile values.
- Launch script that starts the external Symphony Elixir runtime.
- Linear issue and state-machine documentation.

## External Runtime Setup

1. Clone or install the Symphony runtime outside this repository.
2. Build or prepare the Elixir implementation so `bin/symphony` exists.
3. Set `SYMPHONY_ELIXIR_ROOT` to the runtime's `elixir` directory.

Example:

```bash
git clone https://github.com/openai/symphony.git /absolute/path/to/symphony
cd /absolute/path/to/symphony/elixir
mise install
mise exec -- mix deps.get
mise exec -- mix escript.build
```

Then configure this template:

```bash
cd /path/to/aifirst-template/symphony
cp .env.example .env.local
cp profiles/aifirst-template.env.example profiles/aifirst-template.env.local
```

Set at least:

```bash
SYMPHONY_ELIXIR_ROOT=/absolute/path/to/symphony/elixir
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
- validates required Linear, GitHub, repository, and runtime settings
- renders `generated/WORKFLOW.generated.md`
- imports `GH_TOKEN` from `gh auth token` when `GH_TOKEN` is not already set
- executes the external runtime with the generated workflow

## Daily Flow

1. Create a Linear issue in `Todo`.
2. Symphony creates an isolated workspace under `WORKSPACE_ROOT`.
3. Symphony creates an issue branch and PR against `TARGET_REPO_BASE_BRANCH`.
4. Symphony records validation and moves the issue to `Code Review`.
5. Human review moves accepted work to `Merging`.
6. Symphony merges the PR and moves the issue to `Done`.

## Safety Notes

- The runner uses `danger-full-access` because it must edit files, run tests,
  use Git, and create PRs. Run it only in trusted repositories.
- Keep `LINEAR_API_KEY`, `GH_TOKEN`, and generated workflow files out of Git.
- Do not point `WORKSPACE_ROOT` at this repository root.
- Use separate Linear projects or labels for separate repositories.
