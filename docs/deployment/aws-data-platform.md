# Data platform deployment and cutover

This document describes a manual, staged rollout. Merging the code does not create or update AWS resources.

## Configuration

Deploy `infra/aws/data-admin.yaml` as an independent stack, passing:

- `AllowedOrigin`: the deployed HTTPS frontend origin
- `LambdaCodeS3Bucket` and immutable `LambdaCodeS3Key`: the packaged data-platform Lambda artifact
- `CognitoCallbackUrl`: normally `/admin/callback`; local default is `http://localhost:5173/admin/callback`
- `CognitoLogoutUrl`: normally `/admin/login`; local default is `http://localhost:5173/admin/login`
- `CognitoDomainPrefix`: a globally unique hosted-UI prefix

The stack creates four on-demand tables, an HTTP API, public/admin Lambda functions, a Cognito user pool, an app client without a secret, an `admin` group, and a JWT authorizer. The user pool keeps optional MFA enabled with software-token (`SOFTWARE_TOKEN_MFA`) support only; it does not configure SMS, SNS, or phone-number verification. No production credentials are stored in the repository.

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
7. Before the next `Deploy production` run, configure these GitHub `production` environment variables for the frontend:
   - `VITE_SAKE_DATA_API_BASE_URL`
   - `VITE_COGNITO_DOMAIN`
   - `VITE_COGNITO_CLIENT_ID`
   - `VITE_COGNITO_REDIRECT_URI`
   - `VITE_COGNITO_LOGOUT_URI`
8. Manually run `Deploy production`. API failures remain visible errors; there is no silent JSON fallback after the API variable is set.
9. Run the public Body, Voice, Gesture, Result, Sources, and Admin Human Experience checks.

The production frontend deployment requires these five variables once the frontend job runs. Set
them after the data-admin stack, migration, and API verification are complete; the local application
still retains its existing `window.location.origin` fallback for redirect/logout configuration when
those values are not supplied outside the production workflow.

## Phase 1 manual deployment

The repository includes `.github/workflows/deploy-data-admin.yml`. It supports both explicit
`workflow_dispatch` redeploys and `workflow_call` from `.github/workflows/deploy-production.yml`.
Relevant data-admin changes merged to `main` invoke it from the production flow. The data-admin
stack does not reuse the semantic-bridge CloudFormation execution role.

### Bootstrap the execution role once

Choose the private artifact bucket, then deploy `infra/aws/data-admin-bootstrap.yaml` manually
using an already authorized deployment identity. The bootstrap stack creates only the
CloudFormation service role for `data-admin.yaml`; it does not create the data tables, API, Lambda,
or Cognito resources. For example:

```bash
aws cloudformation deploy \
  --template-file infra/aws/data-admin-bootstrap.yaml \
  --stack-name sake-sense-data-admin-bootstrap \
  --parameter-overrides \
    DataAdminStackName=sake-sense-data-admin \
    ArtifactBucketName=YOUR_PRIVATE_ARTIFACT_BUCKET \
    GitHubActionsRoleName=YOUR_GITHUB_ACTIONS_OIDC_ROLE_NAME \
  --capabilities CAPABILITY_NAMED_IAM
```

Retrieve the `DataAdminCloudFormationExecutionRoleArn` output and set it as the GitHub
`production` environment variable `DATA_ADMIN_CLOUDFORMATION_EXECUTION_ROLE_ARN`. The bootstrap
stack also attaches two narrowly scoped policies to the existing role named by
`GitHubActionsRoleName`. Pass the role name used by the GitHub `production` environment variable
`AWS_ROLE_ARN`; do not create a replacement role or change its trust policy. The relationship is
`AWS_ROLE_ARN` → existing GitHub Actions OIDC role → `iam:PassRole` →
`DATA_ADMIN_CLOUDFORMATION_EXECUTION_ROLE_ARN` → CloudFormation.
The deployment policy only uploads `data-admin/*` artifacts, manages the named stack change set, and reads the
data-admin Lambda and DynamoDB verification targets. The PassRole policy is restricted to the one
data-admin execution role and `cloudformation.amazonaws.com`.

The bootstrap stack is a one-time, human-managed prerequisite and is not updated by the normal
data-admin deployment workflow.

The role is limited to resources managed by `data-admin.yaml`: the four tables, data-admin Lambda
functions and runtime roles, Cognito pool resources, the HTTP API, and read-only access to
`s3://<artifact-bucket>/data-admin/*`. `dynamodb:CreateTable`, Cognito create/domain operations,
and API Gateway v2 management operations use `Resource: "*"` in the execution role because AWS
does not expose a usable target ARN before creation (or does not provide a resource type for that
management action). These actions are isolated in separate statements. The GitHub Actions role
has two additional `Resource: "*"` statements: pre-create `cloudformation:DescribeStacks` detection
and `cloudformation:CreateChangeSet`, which must also support the first CREATE before the stack ARN
exists. All other GitHub Actions deployment reads/execution, artifact upload, Lambda verification,
and DynamoDB verification are scoped to the data-admin prefixes. The workflow surfaces the original
AWS CLI error when stack detection fails. The execution role's `iam:PassRole` remains restricted to roles named
`<data-admin-stack>-*` and to `lambda.amazonaws.com`.

Configure these production variables before the first data-admin workflow run:

- `AWS_REGION`, `AWS_ROLE_ARN`, `DATA_ADMIN_CLOUDFORMATION_EXECUTION_ROLE_ARN`
- `DATA_ADMIN_STACK_NAME`, `DATA_ADMIN_ARTIFACT_BUCKET`, `DATA_ADMIN_ALLOWED_ORIGIN`
- `DATA_ADMIN_COGNITO_CALLBACK_URL`, `DATA_ADMIN_COGNITO_LOGOUT_URL`,
  `DATA_ADMIN_COGNITO_DOMAIN_PREFIX`

The workflow validates the repository and migration input, builds the Lambda bundle, uploads
`data-admin/${GITHUB_SHA}.zip`, creates a `CREATE` or `UPDATE` change set, runs the existing safety
gate, executes only an allowed change set, waits for completion, and verifies Lambda/API/Cognito/
DynamoDB outputs. An empty DynamoDB table is a valid initial state. It never runs migration `--apply`,
creates an admin user, or changes the frontend API configuration.

Initial deploy steps are: configure variables, manually run `Deploy data admin` (or the relevant
`Deploy production` run), review outputs, bootstrap the Cognito admin, run migration dry-run and
apply manually, verify APIs, then configure the frontend variables. Subsequent data-admin changes
can deploy automatically through the main production flow or be redeployed with workflow dispatch;
migration is never rerun automatically. Bootstrap, migration apply, and Cognito admin-user setup
remain manual.

## Rollback

Before cutover, keep the previous frontend deployment available. If the API or data validation fails, remove the API base URL from the next frontend deployment and redeploy the previous static bundle. Do not delete the tables during rollback. Resolve data issues through draft records and an audited migration rerun.

The curated JSON remains in the repository as migration input and deterministic test fixtures. It is not the operational source after the API cutover.
