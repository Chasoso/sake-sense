# AWS static hosting

Issue #32 adds a production static-hosting foundation. The application remains a local-first Vite frontend; no AWS account, backend, AI provider, API key, or network service is required for local development.

## Architecture

```text
GitHub main
  -> GitHub Actions
  -> GitHub OIDC
  -> restricted IAM deployment role
  -> private S3 bucket
  -> CloudFront Origin Access Control
  -> HTTPS CloudFront distribution
  -> browser
```

The infrastructure is defined in [infra/aws/static-hosting.yaml](../../infra/aws/static-hosting.yaml). The selected approach is CloudFormation because this repository has no existing IaC framework and the required resources are a small, AWS-native static-hosting stack. The initial stack creation is a human bootstrap; routine frontend deployments are performed by GitHub Actions.

## AWS resources

The stack creates:

- a private, encrypted, versioned S3 bucket with public access blocked;
- a CloudFront distribution with an S3 Origin Access Control, HTTPS redirect, and the CloudFront default domain;
- `/index.html` with a short/no-cache policy and hashed assets with the managed long-cache policy;
- 403/404 responses mapped to `index.html` for the Vite SPA fallback without adding a routing library;
- a GitHub Actions OIDC provider;
- a deployment role scoped to this repository/environment, the generated bucket, and the generated distribution.

The stack outputs the bucket name, distribution ID, distribution domain name, and deployment role ARN. No fixed AWS account ID, region, bucket name, or role ARN is stored in the repository.

## Human bootstrap

These steps require an AWS account owner or administrator and are intentionally not performed by Codex:

1. Choose the AWS account and region, and confirm the production deployment policy.
2. From a trusted machine with AWS CLI credentials, deploy the stack:

   ```bash
   aws cloudformation deploy \
     --template-file infra/aws/static-hosting.yaml \
     --stack-name sake-sense-production \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       GitHubRepository=Chasoso/sake-sense \
       GitHubEnvironmentName=production \
     --region <AWS_REGION>
   ```

3. Record the stack outputs. Do not commit them.
4. Create the GitHub Environment named `production`.
5. Add these non-secret GitHub Environment variables from the stack outputs:
   - `AWS_REGION`
   - `AWS_ROLE_ARN`
   - `S3_BUCKET_NAME`
   - `CLOUDFRONT_DISTRIBUTION_ID`

6. Configure required reviewers or other environment protection appropriate for production.
7. Verify that the workflow can only assume the role from the `production` environment for `Chasoso/sake-sense`.

The OIDC provider and deployment role are created by the stack. This one-time bootstrap cannot be performed by the deployment workflow before the role exists.

## Deployment

`.github/workflows/deploy-production.yml` runs on pushes to `main` and manual `workflow_dispatch`. It:

1. checks out the repository;
2. installs dependencies;
3. runs the full repository validation and production build;
4. assumes the deployment role through GitHub OIDC;
5. syncs hashed build assets to S3 with long-lived cache headers;
6. uploads `index.html` with no-cache headers;
7. creates a CloudFront invalidation.

The workflow never uses static AWS access keys or AWS secrets. Pull requests do not trigger production deployment.

## Security boundary

The OIDC trust policy requires both:

- audience `sts.amazonaws.com`;
- subject `repo:Chasoso/sake-sense:environment:production`.

The role can list and manage objects only in the generated website bucket and create invalidations only for the generated distribution. It has no `AdministratorAccess`, account-wide wildcard permissions, or infrastructure-update permission. Infrastructure updates remain a human bootstrap/maintenance action unless a separately reviewed workflow is introduced.

## Runtime configuration boundary

This issue does not add API Gateway, Lambda, Bedrock, an AI provider, a backend, or any secret to the frontend bundle. Future public client configuration belongs in a separate issue; secrets must never be placed in Vite client environment variables.

## Rollback and redeploy

- To redeploy the current commit, use the workflow's `workflow_dispatch`.
- To roll back application code, deploy a reviewed earlier commit through `main`, then invalidate CloudFront again.
- S3 versioning provides object history for operator-led recovery, but it is not an automatic application rollback mechanism.
- Stack changes must be reviewed and applied by a human through the chosen AWS account/region.

## Validation

Automated repository validation remains local and network-independent:

```bash
npm ci
npm run validate
npm run build
git diff --check
```

Infrastructure validation should be run by the human bootstrap operator in the selected account/region, for example with CloudFormation change sets or `aws cloudformation validate-template`. No AWS deployment or production URL check is performed by CI in this issue.

## Human Experience Gate

Status: **pending human review**.

After the stack and workflow are configured, review the CloudFront production URL on desktop and mobile:

- Start page, approved raster assets, and mobile layout;
- camera permission, MediaPipe loading, body capture, replay, and result flow;
- microphone permission, voice capture, optional gesture, and result flow;
- no horizontal overflow, broken assets, or HTTPS warning.

Codex does not mark this gate passed.
