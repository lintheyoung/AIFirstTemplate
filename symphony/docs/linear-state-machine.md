# Linear State Machine

The starter Symphony workflow expects one Linear project per target repository.
Create these states before starting the runner:

| State | Meaning |
| --- | --- |
| `Todo` | Work is eligible for Symphony intake. |
| `In Progress` | Symphony is implementing the issue in an isolated workspace. |
| `Code Review` | Implementation is PR-ready and awaiting automated or human review routing. |
| `Rework` | Review requested changes; Symphony may continue from the PR branch. |
| `Human Review` | Waiting for a human decision, credential, approval, or merge instruction. |
| `Merging` | Human-approved PR is ready for Symphony to merge. |
| `Done` | Terminal success state. |

Optional terminal states such as `Canceled`, `Cancelled`, and `Duplicate` are
also treated as terminal by the workflow.

## Operating Rules

- New executable work should start in `Todo`.
- Symphony moves `Todo` to `In Progress` before editing files.
- Symphony moves implementation-complete work to `Code Review`.
- Blocked work moves to `Human Review` with one Linear blocker comment.
- Symphony only moves work to `Done` after the PR has merged from `Merging`.
- Do not ask Symphony to work issues that are already in `Human Review` or
  `Done`.
