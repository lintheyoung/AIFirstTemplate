#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCK_FILE="${SYMPHONY_RUNTIME_LOCK_FILE:-$ROOT_DIR/runtime.lock}"

if [[ -f "$LOCK_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$LOCK_FILE"
  set +a
fi

if [[ -n "${SYMPHONY_ELIXIR_ROOT:-}" ]]; then
  if [[ -x "$SYMPHONY_ELIXIR_ROOT/bin/symphony" ]]; then
    printf '%s\n' "$SYMPHONY_ELIXIR_ROOT"
    exit 0
  fi

  echo "SYMPHONY_ELIXIR_ROOT is set but bin/symphony is missing or not executable: $SYMPHONY_ELIXIR_ROOT" >&2
  exit 1
fi

SYMPHONY_RUNTIME_REPO="${SYMPHONY_RUNTIME_REPO:-https://github.com/openai/symphony.git}"
SYMPHONY_RUNTIME_REF="${SYMPHONY_RUNTIME_REF:-main}"
SYMPHONY_RUNTIME_CACHE_DIR="${SYMPHONY_RUNTIME_CACHE_DIR:-${HOME}/.cache/aifirst-template/symphony-runtime}"
SYMPHONY_RUNTIME_CACHE_DIR="${SYMPHONY_RUNTIME_CACHE_DIR/#\$\{HOME\}/$HOME}"
SYMPHONY_RUNTIME_CACHE_DIR="${SYMPHONY_RUNTIME_CACHE_DIR/#~/$HOME}"

if [[ "${SYMPHONY_RUNTIME_DRY_RUN:-}" == "1" ]]; then
  echo "Would prepare Symphony runtime:"
  echo "  repo: $SYMPHONY_RUNTIME_REPO"
  echo "  ref: $SYMPHONY_RUNTIME_REF"
  echo "  cache: $SYMPHONY_RUNTIME_CACHE_DIR"
  echo "  elixir: $SYMPHONY_RUNTIME_CACHE_DIR/elixir"
  exit 0
fi

if [[ ! -d "$SYMPHONY_RUNTIME_CACHE_DIR/.git" ]]; then
  mkdir -p "$(dirname "$SYMPHONY_RUNTIME_CACHE_DIR")"
  git clone "$SYMPHONY_RUNTIME_REPO" "$SYMPHONY_RUNTIME_CACHE_DIR"
fi

git -C "$SYMPHONY_RUNTIME_CACHE_DIR" fetch --tags origin
git -C "$SYMPHONY_RUNTIME_CACHE_DIR" checkout "$SYMPHONY_RUNTIME_REF"

ELIXIR_ROOT="$SYMPHONY_RUNTIME_CACHE_DIR/elixir"
if [[ ! -d "$ELIXIR_ROOT" ]]; then
  echo "Symphony runtime does not contain an elixir directory: $ELIXIR_ROOT" >&2
  exit 1
fi

if [[ ! -x "$ELIXIR_ROOT/bin/symphony" ]]; then
  if ! command -v mise >/dev/null 2>&1; then
    echo "mise is required to build Symphony runtime, but it is not available." >&2
    exit 1
  fi

  (
    cd "$ELIXIR_ROOT"
    mise trust "$ELIXIR_ROOT/mise.toml"
    mise install
    mise exec -- mix deps.get
    mise exec -- mix escript.build
  )
fi

if [[ ! -x "$ELIXIR_ROOT/bin/symphony" ]]; then
  echo "Symphony runtime build did not produce an executable bin/symphony." >&2
  exit 1
fi

printf '%s\n' "$ELIXIR_ROOT"
