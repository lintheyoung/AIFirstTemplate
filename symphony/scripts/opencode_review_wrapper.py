#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
import sys


DEFAULT_TIMEOUT_SECONDS = 180


def strip_code_fences(text: str) -> str:
    match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()


def first_json_object(text: str) -> str:
    cleaned = strip_code_fences(text)
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        return cleaned[start : end + 1].strip()

    return cleaned


def normalize_opencode_stdout(stdout: str) -> str:
    if not stdout.strip():
        return ""

    cleaned_stdout = first_json_object(stdout)
    try:
        parsed_stdout = json.loads(cleaned_stdout)
    except json.JSONDecodeError:
        pass
    else:
        if isinstance(parsed_stdout, dict):
            result_value = parsed_stdout.get("result")
            if isinstance(result_value, str) and result_value.strip():
                cleaned_result = first_json_object(result_value)
                try:
                    parsed_result = json.loads(cleaned_result)
                except json.JSONDecodeError:
                    pass
                else:
                    return json.dumps(parsed_result, ensure_ascii=False)
        return json.dumps(parsed_stdout, ensure_ascii=False)

    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    final_text = ""

    for line in lines:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            final_text = line
            continue

        if isinstance(event, dict):
            for key in ("result", "text", "content", "message"):
                value = event.get(key)
                if isinstance(value, str) and value.strip():
                    final_text = value

    if not final_text:
        final_text = stdout

    cleaned = first_json_object(final_text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return cleaned

    return json.dumps(parsed, ensure_ascii=False)


def resolve_timeout_seconds(env: dict[str, str] | None = None) -> int:
    value = (env or os.environ).get("OPENCODE_REVIEW_TIMEOUT_SECONDS")
    if not value:
        return DEFAULT_TIMEOUT_SECONDS

    try:
        timeout = int(value)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS

    return timeout if timeout > 0 else DEFAULT_TIMEOUT_SECONDS


def build_opencode_command(env: dict[str, str] | None = None) -> list[str]:
    env = env or os.environ
    command = [env.get("OPENCODE_COMMAND", "opencode"), "run"]

    model = env.get("OPENCODE_REVIEW_MODEL")
    if model:
        command.extend(["--model", model])

    variant = env.get("OPENCODE_REVIEW_VARIANT")
    if variant:
        command.extend(["--variant", variant])

    if env.get("OPENCODE_REVIEW_PURE", "0") in {"1", "true", "TRUE", "yes"}:
        command.append("--pure")

    return command


def main() -> int:
    if any(arg in {"-h", "--help"} for arg in sys.argv[1:]):
        print("Usage: opencode_review_wrapper.py")
        print("Reads a review prompt from stdin and prints a normalized JSON result.")
        return 0

    prompt = sys.stdin.read()
    if not prompt.strip():
        raise SystemExit("opencode review wrapper expected a prompt on stdin")

    result = subprocess.run(
        [*build_opencode_command(), prompt],
        capture_output=True,
        text=True,
        timeout=resolve_timeout_seconds(),
        check=False,
    )

    if result.returncode != 0:
        sys.stderr.write(result.stderr or result.stdout)
        return result.returncode

    sys.stdout.write(normalize_opencode_stdout(result.stdout))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
