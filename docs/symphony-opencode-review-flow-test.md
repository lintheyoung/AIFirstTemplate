# Symphony Opencode Review Flow Test

This document records a harmless docs-only test for the Linear to Symphony Runner to GitHub PR to local opencode review flow.

## Test Scope

- Linear issue: DED-39
- Change type: docs only
- Runtime behavior changed: no
- Target branch: main
- Local review gate: opencode

## Expected Flow

1. Move the Linear issue from Todo to In Progress.
2. Create a dedicated issue branch.
3. Add this documentation file without changing runtime behavior.
4. Open a pull request against main.
5. Move the issue to Code Review after validation and PR handoff.
6. Run two local opencode review rounds against `origin/main`.
7. Add a GitHub PR review or comment with a visible `## Opencode Review` heading.
8. Add a Linear summary of the opencode review result.
9. If both opencode rounds approve, move the issue to Human Review and stop.

## Human Review Boundary

This demo verifies that the automated review flow stops at Human Review. The issue must not move to Merging or Done during this test unless a separate human approval and merge step is explicitly provided later.

## Notes

This file is intentionally limited to documentation so the opencode review path can be verified without affecting application code, environment files, authentication, API routes, providers, database, storage, deployment configuration, or package scripts.
