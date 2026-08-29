# Development loop

## Purpose

This project is a fast-moving hackathon project. We optimize for rapid hypothesis validation while preserving reviewability, safety, and a clear record of why product decisions changed.

The loop is:

`Hypothesize -> Specify -> Build -> Verify -> Experience -> Learn`

### Hypothesize

The human states the product question and the current hypothesis. A hypothesis is provisional: it may be kept, revised, or rejected after experience. Stable constraints (for example, an explicitly required platform behavior) must be labeled separately.

### Specify

The Issue defines purpose, scope, acceptance criteria, automated validation, and human experience checks. Codex reads the full Issue, inspects the repository, identifies prerequisites, and creates an implementation plan before editing.

### Build

Codex implements the requested scope on an Issue-specific branch. Low-risk decisions may follow existing patterns. Product meaning, UX direction, external services, AWS architecture, auth, credentials, and irreversible actions remain human decisions unless explicitly authorized by the Issue.

### Verify

Run the repository's relevant automated checks and record the exact commands and results in the PR. Fix failures that are within scope and rerun them. Verification establishes technical validity; it does not establish that a product hypothesis is useful.

### Experience

For UX-bearing work, a human tests the result locally using the checks in the Issue and PR. Evaluate whether the interaction is understandable, interesting, comfortable, and useful for the intended hypothesis. A PR can be technically complete while awaiting this gate.

### Learn

Record the experiment outcome as `keep`, `revise`, or `reject`. Preserve failed ideas and concise learnings in documentation or a follow-up Issue rather than deleting their history.

## Git lifecycle

The default is one Issue -> one branch -> one PR. The base branch is `main`, and direct pushes to it are prohibited. Use a branch containing the Issue number, such as `feat/issue-12-gesture-input`, and use Conventional Commits. Codex may create and push a PR but must not merge it; the human makes the final merge decision.

The PR body uses `Closes #<issue-number>` only when the Issue is fully complete. Otherwise, describe the remaining work without closing the Issue automatically.

## Local-first rule

Hypothesis validation should be possible without AWS or other external infrastructure unless the Issue explicitly requires it. External-network tests are opt-in. This keeps feedback fast and prevents infrastructure availability from being confused with product validation.

## Stop conditions

Codex stops and reports when completing the Issue would require a product decision, a material UX change, authoritative sake terminology, a new external or production dependency, AWS architecture, authentication or authorization, production credentials or secrets, a destructive operation, or scope expansion not authorized by the Issue.
