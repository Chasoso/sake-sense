# Validation policy

## Standard local suite

Run `npm run validate` before creating a PR. It runs the same no-network gates as CI:

1. `npm run format:check` — Prettier formatting.
2. `npm run lint` — ESLint rules for JavaScript and TypeScript.
3. `npm run typecheck` — strict TypeScript project checks.
4. `npm run test:coverage` — deterministic Vitest unit tests with V8 coverage output.
5. `npm run build` — production build.
6. `npm run secret-scan` — the repository's tracked-file secret scanner.

The individual commands are available for focused iteration. `npm run test` runs unit tests without coverage when a faster feedback loop is useful.

## CI

Pull requests targeting `main` run `npm ci` and then `npm run validate` on the Node version pinned in `.nvmrc`. CI uses least-privilege read-only repository permissions, does not require AWS credentials, and does not call external product integrations. Coverage is uploaded as an artifact when available.

## Hooks

`npm ci` runs the `prepare` script, which configures the repository-local `.githooks` directory without administrator privileges. The pre-commit hook runs formatting, lint, and typecheck. The pre-push hook runs the complete `npm run validate` suite. Hooks never terminate unrelated processes and should not be bypassed with `--no-verify`.

## Secret scanning

`npm run secret-scan` checks Git-tracked text files for common credential formats and private-key markers. It is a lightweight repository-standard scanner designed for this small project; it is not a substitute for rotating a credential if one is exposed. Extend its documented patterns when a new credential format becomes relevant.

## Deferred gates

Playwright E2E and browser visual regression are deferred until the first meaningful user-facing interaction exists. The current shell has no interaction whose behavior would justify an E2E gate. External integration tests remain opt-in.

## Verify vs Experience

Automated validation demonstrates technical validity. It does not evaluate whether a product interaction is understandable, interesting, comfortable, or useful. UX-bearing Issues still require the separate Human Experience Gate documented in `AGENTS.md` and the development loop.

## Failing checks

Codex should fix failures within the requested Issue, rerun the failed check, and then rerun the complete suite before opening a PR. It must not weaken, skip, or bypass a check to make the PR pass. Stop and report when the fix requires an out-of-scope product, architecture, credential, or irreversible decision.
