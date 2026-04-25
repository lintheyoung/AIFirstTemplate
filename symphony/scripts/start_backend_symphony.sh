#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${SYMPHONY_PROFILE:-aifirst-template}"
PROFILE_FILE="$ROOT_DIR/profiles/${PROFILE}.env.local"
PROFILE_EXAMPLE="$ROOT_DIR/profiles/${PROFILE}.env.example"

if [[ -f "$ROOT_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

if [[ -f "$PROFILE_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROFILE_FILE"
  set +a
elif [[ -f "$PROFILE_EXAMPLE" ]]; then
  echo "Profile env file is missing: $PROFILE_FILE" >&2
  echo "Copy $PROFILE_EXAMPLE to $PROFILE_FILE and fill in the project values." >&2
  exit 1
fi

required_vars=(
  SYMPHONY_ELIXIR_ROOT
  LINEAR_API_KEY
  LINEAR_PROJECT_SLUG
  PROJECT_NAME
  TARGET_REPO_NAME
  TARGET_REPO_URL
  TARGET_REPO_BASE_BRANCH
  WORKSPACE_ROOT
  SERVER_PORT
  MAX_CONCURRENT_AGENTS
  MAX_TURNS
  CODEX_COMMAND
)

for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

if [[ ! -d "$SYMPHONY_ELIXIR_ROOT" ]]; then
  echo "SYMPHONY_ELIXIR_ROOT does not exist: $SYMPHONY_ELIXIR_ROOT" >&2
  echo "Clone or install the external Symphony Elixir runtime, then set SYMPHONY_ELIXIR_ROOT to its elixir directory." >&2
  exit 1
fi

WORKFLOW_OUTPUT="${WORKFLOW_OUTPUT:-$ROOT_DIR/generated/WORKFLOW.generated.md}"

python3 "$ROOT_DIR/scripts/bootstrap_workflow.py" \
  --template "$ROOT_DIR/templates/WORKFLOW.linear.template.md" \
  --output "$WORKFLOW_OUTPUT" \
  --env-file "$ROOT_DIR/.env.local" \
  --env-file "$PROFILE_FILE"

if [[ -z "${GH_TOKEN:-}" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "GH_TOKEN is not set and GitHub CLI is not available." >&2
    echo "Install gh and run gh auth login, or export GH_TOKEN manually." >&2
    exit 1
  fi

  GH_TOKEN="$(gh auth token)"
  export GH_TOKEN
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  export GITHUB_TOKEN="$GH_TOKEN"
fi

cd "$SYMPHONY_ELIXIR_ROOT"

exec mise exec -- ./bin/symphony \
  --i-understand-that-this-will-be-running-without-the-usual-guardrails \
  "$WORKFLOW_OUTPUT"
