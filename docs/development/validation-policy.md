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

Vitest V8 coverage is enforced at 80% lines, 70% branches, 85% functions, and 78%
statements. These thresholds are intentionally a small margin below the measured
baseline (83.61%, 73.91%, 88.70%, and 81.34% respectively), so meaningful coverage
regressions fail without making ordinary focused changes fragile.

## CI

Pull requests targeting `main` run `npm ci` and then `npm run validate` on the Node version pinned in `.nvmrc`. CI uses least-privilege read-only repository permissions, does not require AWS credentials, and does not call external product integrations. Coverage is uploaded as an artifact when available.

## Hooks

`npm ci` runs the `prepare` script, which configures the repository-local `.githooks` directory without administrator privileges. The pre-commit hook runs formatting, lint, and typecheck. The pre-push hook runs the complete `npm run validate` suite. Hooks never terminate unrelated processes and should not be bypassed with `--no-verify`.

## Secret scanning

`npm run secret-scan` checks Git-tracked text files for common credential formats and private-key markers. It is a lightweight repository-standard scanner designed for this small project; it is not a substitute for rotating a credential if one is exposed. Extend its documented patterns when a new credential format becomes relevant.

## Browser and production gates

The deterministic Playwright suites cover user flows with mocked APIs and no AWS,
Cognito, or production network access. `npm run test:e2e:admin` covers CRUD and
relation behavior; `npm run test:e2e:visual` covers a small fixed screenshot set.
Update visual baselines only intentionally with `npm run test:e2e:visual -- --update-snapshots`
and review the resulting PNGs.
The visual assertions use a 1% pixel-difference ceiling and a 0.1 per-pixel color threshold in the fixed Ubuntu Chromium CI environment. The three checked-in baselines were regenerated in that same CI environment during the Issue #207 audit; their SHA-256 values matched the committed PNGs, so no binary snapshot replacement was necessary. Keep the viewport and mocked data deterministic. Update baselines only intentionally with `npm run test:e2e:visual -- --update-snapshots` in the CI-equivalent Ubuntu/Chromium environment, and review the PNGs. Never update snapshots or relax thresholds just to hide a failed comparison.

Production deployment runs `npm run smoke:production` after successful relevant
deployments. It performs only read/preflight checks: frontend and public API reachability,
admin CORS preflight, and unauthenticated admin protection. It never obtains tokens or
writes production data. Mock E2E failures block a merge; production smoke failures block
the deployment and require investigation or rollback. The production environment supplies
`PRODUCTION_APP_URL`, `VITE_SAKE_DATA_API_BASE_URL`, and `DATA_ADMIN_ALLOWED_ORIGIN` to this
job; these are deployment configuration, not test credentials.

## Verify vs Experience

Automated validation demonstrates technical validity. It does not evaluate whether a product interaction is understandable, interesting, comfortable, or useful. UX-bearing Issues still require the separate Human Experience Gate documented in `AGENTS.md` and the development loop.

## Failing checks

Codex should fix failures within the requested Issue, rerun the failed check, and then rerun the complete suite before opening a PR. It must not weaken, skip, or bypass a check to make the PR pass. Stop and report when the fix requires an out-of-scope product, architecture, credential, or irreversible decision.
