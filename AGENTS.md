# Repository development rules

These rules apply to all work in this repository. They are intentionally short so a hackathon contributor or coding agent can follow the complete lifecycle without additional prompting.

## Default lifecycle

The repository follows:

`Hypothesize -> Specify -> Build -> Verify -> Experience -> Learn`

- Humans own product hypotheses, UX judgment, hypothesis acceptance or rejection, and major product or architecture decisions.
- Codex owns implementation planning, implementation, automated validation, self-review, in-scope fixes, commit, push, and PR creation.
- The Human Experience Gate is mandatory for subjective UX or hypothesis-validation criteria; automated checks do not replace it.

Before implementation, Codex must read this file and the entire requested Issue, inspect the repository and relevant code or docs, identify dependencies and blockers, and make an implementation plan. It proceeds without waiting for confirmation unless a stop condition applies.

## Git and pull requests

- `main` is the base branch. Never push directly to `main`.
- Default to one Issue, one branch, and one PR.
- Include the Issue number in the branch name, for example `feat/issue-12-gesture-input`.
- Use Conventional Commits and never use `--no-verify`.
- Codex must not merge its own PR. A human makes the final merge decision.
- Include `Closes #<issue-number>` in the PR body only when the Issue is fully completed.
- Before creating a PR, review the complete diff and confirm that only in-scope files are included.

## Decision boundaries

Codex may make low-risk implementation decisions that follow the Issue and repository patterns. It must stop and report before:

- changing product vision or accepting or rejecting a hypothesis;
- materially changing the UX concept;
- defining sake terminology as authoritative truth;
- adding an external service or production dependency;
- changing AWS architecture or authentication/authorization;
- handling production credentials or secrets;
- performing destructive or irreversible operations; or
- expanding beyond the requested Issue.

## Hypotheses and experience

Keep stable product constraints, current hypotheses, and implementation details distinct. Do not turn an experimental hypothesis into a permanent requirement, and do not silently delete failed ideas from history.

For a UX-bearing Issue, the PR must list manual experience checks. `Verify` means automated checks show the implementation is technically valid. `Experience` means a human locally evaluates whether the interaction is understandable, interesting, comfortable, and useful for the intended hypothesis.

After reviewing an experiment, record one outcome: `keep` (validated enough to continue), `revise`, or `reject`, in documentation or a follow-up Issue when appropriate.

## Local-first and self-review

- Ordinary product-hypothesis validation must work locally unless the Issue explicitly requires external infrastructure.
- AWS is not a prerequisite for local UX experimentation.
- External-network tests are opt-in unless explicitly required.
- Fix in-scope validation failures and rerun the checks.
- Before a PR, search the diff and repository for secrets, debug code, accidental files, unfinished TODOs, and scope creep.
- Never weaken tests or rules just to obtain a passing result.

See [the development loop](docs/development/development-loop.md) for the expanded workflow and [the Issue authoring guide](docs/development/issue-authoring-guide.md) for Issue structure.
