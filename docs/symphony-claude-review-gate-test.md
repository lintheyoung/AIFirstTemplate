# Symphony Claude Review Gate Test

This document records a harmless docs-only test for the Linear to Symphony to GitHub flow with the Claude Code Review gate enabled.

## Test Scope

- Linear issue: DED-38
- Change type: docs only
- External review gate: Claude Code Review
- Human approval phrase: `Human Approval: merge approved`
- Runtime behavior changed: no
- Target branch: main

## Expected Flow

1. Move the Linear issue from Todo to In Progress.
2. Create a dedicated issue branch.
3. Add this documentation file.
4. Open a pull request against main.
5. Keep the issue in Code Review until the Claude Code Review check or status is successful.
6. Move the issue to Human Review only after the external review gate succeeds.
7. Merge only after the human approval phrase is present and the issue is moved to Merging.

## Notes

This file is intentionally limited to documentation so the Claude-review-gated flow can be verified without affecting application code, configuration, authentication, providers, storage, deployment, or package scripts.
