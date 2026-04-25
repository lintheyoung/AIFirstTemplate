#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path


PLACEHOLDERS = {
    "__PROJECT_NAME__": "PROJECT_NAME",
    "__LINEAR_PROJECT_SLUG__": "LINEAR_PROJECT_SLUG",
    "__TRACKER_LABEL__": "TRACKER_LABEL",
    "__WORKSPACE_ROOT__": "WORKSPACE_ROOT",
    "__TARGET_REPO_NAME__": "TARGET_REPO_NAME",
    "__TARGET_REPO_URL__": "TARGET_REPO_URL",
    "__TARGET_REPO_BASE_BRANCH__": "TARGET_REPO_BASE_BRANCH",
    "__MAX_CONCURRENT_AGENTS__": "MAX_CONCURRENT_AGENTS",
    "__MAX_TURNS__": "MAX_TURNS",
    "__CODEX_COMMAND__": "CODEX_COMMAND",
    "__SERVER_PORT__": "SERVER_PORT",
}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render a project-specific Symphony workflow from the template.",
    )
    parser.add_argument("--template", required=True, help="Path to the workflow template file")
    parser.add_argument("--output", required=True, help="Path to write the rendered workflow file")
    parser.add_argument(
        "--env-file",
        action="append",
        default=[],
        help="Env file to preload before rendering. Can be passed multiple times.",
    )
    args = parser.parse_args()

    for env_file in args.env_file:
        load_env_file(Path(env_file))

    template = Path(args.template)
    output = Path(args.output)
    text = template.read_text()

    missing: list[str] = []
    for placeholder, env_name in PLACEHOLDERS.items():
        value = os.environ.get(env_name)
        if not value:
            missing.append(env_name)
            continue
        text = text.replace(placeholder, value)

    if missing:
        raise SystemExit(f"Missing required environment values: {', '.join(sorted(missing))}")

    if "__" in text:
        unresolved = sorted({part for part in text.split() if "__" in part})
        raise SystemExit(f"Workflow still has unresolved placeholders: {', '.join(unresolved)}")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text)
    print(f"Rendered workflow to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
