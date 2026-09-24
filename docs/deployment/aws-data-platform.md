# Data platform deployment and cutover

This document describes a manual, staged rollout. Merging the code does not create or update AWS resources.

## Configuration

Deploy `infra/aws/data-admin.yaml` as an independent stack, passing:

- `AllowedOrigin`: the deployed HTTPS frontend origin
- `LambdaCodeS3Bucket` and immutable `LambdaCodeS3Key`: the packaged data-platform Lambda artifact
- `CognitoCallbackUrl`: normally `/admin/callback`; local default is `http://localhost:5173/admin/callback`
- `CognitoLogoutUrl`: normally `/admin/login`; local default is `http://localhost:5173/admin/login`
- `CognitoDomainPrefix`: a globally unique hosted-UI prefix

The stack creates four on-demand tables, an HTTP API, public/admin Lambda functions, a Cognito user pool, an app client without a secret, an `admin` group, and a JWT authorizer. No production credentials are stored in the repository.

For local frontend development, set `VITE_SAKE_DATA_API_BASE_URL` only when a local or deployed
data API is available. The app otherwise uses the checked-in JSON fixtures for local/test use. The
production cutover must set this variable explicitly; an API failure is shown to the user and does
not silently fall back to bundled data. Configure the admin SPA with
`VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REDIRECT_URI`, and
`VITE_COGNITO_LOGOUT_URI`. The client uses Authorization Code + PKCE and never contains a client
secret. Directly reachable admin routes are `/admin/login`, `/admin`, `/admin/products`,
`/admin/breweries`, `/admin/sources`, and `/admin/evidence`.

## Order

1. Deploy the independent infrastructure stack.
2. Create an administrator user manually with Cognito, complete the password setup, and add the user to the `admin` group. Verify `/admin/login` and logout; never commit the credentials.
3. Run `node scripts/migrate-sake-data.mjs --validate` and then the default dry-run. Review counts and invalid/skipped records.
4. After review, set the four table names and AWS region and run the same command with `--apply`. The script is idempotent by stable IDs and uses `PutItem`; Codex does not run this step.
5. Verify public published counts, representative product/brewery/source records, and product evidence.
6. Verify admin authentication and create/edit/publish/archive workflows.
7. Set `VITE_SAKE_DATA_API_BASE_URL` in the frontend deployment environment and deploy the frontend. API failures must remain visible errors; there is no silent JSON fallback in production.
8. Run the public Body, Voice, Gesture, Result, and Sources Human Experience checks.

## Phase 1 manual deployment

The repository includes `.github/workflows/deploy-data-admin.yml`. It is intentionally triggered
only by `workflow_dispatch` in the GitHub `production` environment; merging to `main` does not
deploy this stack. Configure these production variables before the first run:

- `AWS_REGION`, `AWS_ROLE_ARN`, `CLOUDFORMATION_EXECUTION_ROLE_ARN`
- `DATA_ADMIN_STACK_NAME`, `DATA_ADMIN_ARTIFACT_BUCKET`, `DATA_ADMIN_ALLOWED_ORIGIN`
- `DATA_ADMIN_COGNITO_CALLBACK_URL`, `DATA_ADMIN_COGNITO_LOGOUT_URL`,
  `DATA_ADMIN_COGNITO_DOMAIN_PREFIX`

The workflow validates the repository and migration input, builds the Lambda bundle, uploads
`data-admin/${GITHUB_SHA}.zip`, creates a `CREATE` or `UPDATE` change set, runs the existing safety
gate, executes only an allowed change set, waits for completion, and verifies Lambda/API/Cognito/
DynamoDB outputs. An empty DynamoDB table is a valid initial state. It never runs migration `--apply`,
creates an admin user, or changes the frontend API configuration.

Initial deploy steps are: configure variables, manually run `Deploy data admin`, review outputs,
bootstrap the Cognito admin, run migration dry-run and apply manually, verify APIs, then perform the
frontend cutover. Subsequent updates are also manual workflow dispatches; migration is never rerun
automatically. Phase 2 main-merge-triggered data-admin deployment is explicitly not implemented.

## Rollback

Before cutover, keep the previous frontend deployment available. If the API or data validation fails, remove the API base URL from the next frontend deployment and redeploy the previous static bundle. Do not delete the tables during rollback. Resolve data issues through draft records and an audited migration rerun.

The curated JSON remains in the repository as migration input and deterministic test fixtures. It is not the operational source after the API cutover.
