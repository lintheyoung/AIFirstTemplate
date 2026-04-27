# Linear State Machine

The starter Symphony workflow expects one Linear project per target repository.
Create these states before starting the runner:

| State | Meaning |
| --- | --- |
| `Todo` | Work is eligible for Symphony intake. |
| `In Progress` | Symphony is implementing the issue in an isolated workspace. |
| `Code Review` | Implementation is PR-ready and awaiting local opencode review. |
| `Rework` | Review requested changes; Symphony may continue from the PR branch. |
| `Human Review` | Waiting for a human decision, credential, approval, or merge instruction. |
| `Merging` | Human-approved PR is ready for Symphony to merge into the integration branch and verify staging/test evidence. |
| `Done` | Terminal success state after required merge, smoke, and release evidence is recorded. |

Optional terminal states such as `Canceled`, `Cancelled`, and `Duplicate` are
also treated as terminal by the workflow.

## Operating Rules

- New executable work should start in `Todo`.
- Symphony moves `Todo` to `In Progress` before editing files.
- Symphony moves implementation-complete work to `Code Review`.
- Symphony runs local opencode review in `Code Review`; findings move to
  `Rework`, unclear decisions move to `Human Review`, and approvals move to
  `Human Review`.
- Blocked work moves to `Human Review` with one Linear blocker comment.
- Symphony only merges from `Merging` after explicit human approval.
- Ordinary runners do not perform production promotion unless the issue is a
  dedicated release-operator issue with explicit release instructions.
- Symphony only moves work to `Done` after the required merge and smoke/release
  evidence is recorded.
- Do not ask Symphony to work issues that are already in `Human Review` or
  `Done`.
