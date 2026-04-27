#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROUND_FOCUS = {
    "round1": ["correctness", "regressions", "obvious bugs"],
    "round2": ["maintainability", "tests", "edge cases"],
}


def build_prompt(*, round_name: str, branch: str, base_ref: str, diff_text: str) -> str:
    focus_lines = "\n".join(f"- {item}" for item in ROUND_FOCUS[round_name])
    return f"""You are reviewing a small pull request in this repository.

Review focus for this round:
{focus_lines}

Return JSON only with this exact schema:
{{
  "outcome": "approve" | "changes_requested" | "needs_human_info",
  "summary": "one short paragraph",
  "findings": ["short finding 1", "short finding 2"]
}}

Rules:
- Choose exactly one outcome.
- Use "approve" only if you see no concrete bug or regression risk in the diff for this round's focus.
- Use "changes_requested" if the diff has a concrete bug/regression risk that should be fixed before human review.
- Use "needs_human_info" only if you cannot determine correctness from the provided context.
- Keep findings empty when approving.
- Do not suggest optional refactors.
- Prefer concise, actionable findings grounded in the diff.

PR context:
- Branch: {branch}
- Base: {base_ref}
- Goal: review the current branch diff against the integration branch for this round.

Diff:
```diff
{diff_text}
```
"""


def get_diff(base_ref: str, paths: list[str]) -> str:
    cmd = ["git", "diff", "--unified=3", f"{base_ref}...HEAD"]
    if paths:
        cmd.extend(["--", *paths])
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        sys.stderr.write(result.stderr or result.stdout)
        raise SystemExit(result.returncode)
    return result.stdout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("round_name", choices=sorted(ROUND_FOCUS))
    parser.add_argument("base_ref", nargs="?", default="origin/main")
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()

    branch = (
        subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        .stdout.strip()
    )
    diff_text = get_diff(args.base_ref, args.paths)
    prompt = build_prompt(
        round_name=args.round_name,
        branch=branch,
        base_ref=args.base_ref,
        diff_text=diff_text,
    )

    wrapper = Path(__file__).with_name("opencode_review_wrapper.py")
    proc = subprocess.run(
        [sys.executable, str(wrapper)],
        input=prompt,
        text=True,
        capture_output=True,
        check=False,
    )
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
