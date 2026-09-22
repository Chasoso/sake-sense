# Production AI semantic bridge

Issue #33 adds an opt-in, provider-neutral production path:

```text
Browser-derived feature summary
  -> API Gateway HTTP API
  -> Lambda (request validation)
  -> Amazon Bedrock Converse
  -> Lambda (structured-response validation)
  -> browser's existing semantic bridge validator
  -> curated dictionary and provenance-backed sake matching
```

Raw camera frames, images, MediaPipe landmarks, pose history, microphone audio, and speech transcription are never sent to AWS. The browser sends only derived structured observations and mapped dictionary term IDs. The Lambda resolves those IDs against the repository-owned canonical dictionary before constructing Bedrock context; browser-supplied dictionary text is not trusted.

## Selected model

- Model/inference profile: `global.anthropic.claude-haiku-4-5-20251001-v1:0`
- Primary stack region: `ap-northeast-1`
- Global cross-region inference is intentional for this MVP.
- The model ID is a CloudFormation parameter and Lambda environment configuration, not a frontend-controlled value.
- Claude Haiku 4.5 is used for low-latency, concise structured interpretation. It can be replaced later by changing the backend parameter after reviewing structured-output support and IAM scope.

The Lambda uses the Bedrock Runtime Converse API with `outputConfig.textFormat` JSON Schema structured output. The application validator remains authoritative even when Bedrock returns a schema-constrained response.

The provider schema intentionally uses the Bedrock structured-output JSON Schema subset. In particular, legacy array fields are not constrained with `maxItems`; the reviewed grounding layer still deterministically replaces their user-facing and candidate values, and application validation remains the final contract check.

## Deployment architecture

The production source of truth is `infra/aws/ai-semantic-bridge.yaml`. After the one-time bootstrap below, the normal path is:

```text
merge to main
  -> production Environment + GitHub OIDC
  -> build and validate Lambda bundle
  -> upload semantic-bridge/<GITHUB_SHA>.zip to the private artifact bucket
  -> create and inspect a CloudFormation change set
  -> execute only a change set that passes the safety gate
  -> update sake-sense-ai-production
  -> stack and Lambda verification
```

The workflow no longer calls `lambda update-function-code` directly. Lambda code, timeout, environment, API Gateway, permissions, and IAM resources are updated together by CloudFormation. The commit-specific S3 key is immutable and the artifact bucket is separate from the frontend website bucket.

The `@aws-sdk/client-bedrock-runtime` dependency is included in the single esbuild bundle, so deployment does not depend on the SDK version bundled with the Node.js 24 Lambda runtime. The package contains only `index.js`.

## One-time human bootstrap

Codex does not deploy AWS resources or request model access. An AWS operator must first confirm that the selected global inference profile is available and enabled for the account in Bedrock. If AWS presents a model-access, quota, Marketplace, or first-use action, complete that action before continuing; do not silently select another model.

The existing `sake-sense-production` static-hosting stack owns the private versioned semantic bridge artifact bucket, the GitHub OIDC deployment role, and the dedicated CloudFormation execution role. An account owner must update that stack once after this workflow/template change, using the existing OIDC provider parameters from [the static-hosting deployment guide](aws-static-hosting.md). This update is the intentional bootstrap boundary: it changes the GitHub role from direct Lambda code updates to scoped CloudFormation change-set access and `iam:PassRole` for one execution role, and grants the execution role the confirmed `iam:GetRolePolicy` read permission required by CloudFormation.

Record these stack outputs in the GitHub `production` Environment; do not commit them:

- `DeploymentRoleArn` -> `AWS_ROLE_ARN`
- `SemanticBridgeArtifactBucketName` -> `SEMANTIC_BRIDGE_ARTIFACT_BUCKET`
- `SemanticBridgeCloudFormationExecutionRoleArn` -> `CLOUDFORMATION_EXECUTION_ROLE_ARN`
- `CloudFrontDomainName` -> use the exact `https://<domain>` value for `SEMANTIC_BRIDGE_ALLOWED_ORIGIN` (no trailing slash)
- `SemanticBridgeApiEndpoint` -> `VITE_SENSORY_BRIDGE_API_URL`

The production Environment must contain these non-secret variables:

- `AWS_REGION` = `ap-northeast-1`
- `AWS_ROLE_ARN`
- `S3_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `VITE_SENSORY_BRIDGE_API_URL`
- `SEMANTIC_BRIDGE_STACK_NAME` = `sake-sense-ai-production`
- `SEMANTIC_BRIDGE_ARTIFACT_BUCKET`
- `SEMANTIC_BRIDGE_ALLOWED_ORIGIN` = exact CloudFront origin
- `SEMANTIC_BRIDGE_MODEL_ID` = `global.anthropic.claude-haiku-4-5-20251001-v1:0`
- `CLOUDFORMATION_EXECUTION_ROLE_ARN`

Keep production required reviewers and other Environment protection enabled. No static AWS access keys are used.

## Safeguards and boundaries

- API Gateway route: `POST /semantic-bridge`
- CORS: one configured CloudFront origin; no wildcard
- Throttling target: 1 request/second, burst 5
- Lambda timeout: 30 seconds
- Bedrock provider timeout: 25 seconds, leaving a five-second application cleanup and diagnostics margin before the Lambda hard timeout.
- Request size limit: 12,000 bytes
- Bedrock output limit: 256 tokens; low temperature
- Candidate IDs are restricted to mapped dictionary IDs from the canonical repository JSON. The browser supplies IDs only; Lambda reconstructs `displayTerm`, `definitionSummary`, and `dimensions` before building the Bedrock prompt, and the browser validates the response again.
- User-facing `sensoryExpressions` and `reason` are required to be cautious, beginner-friendly Japanese. `unmappedFeatures` is replaced by Lambda with deterministic `feature:value` identifiers derived from the validated structured input.
- Provider errors, timeouts, malformed JSON, and unknown IDs return a safe non-candidate response through the existing fallback path.
- HTTP 400 denotes an invalid browser semantic-bridge request; HTTP 502 denotes provider invocation failure or invalid provider/model output. Both remain sanitized and use the frontend fallback path.
- The endpoint is unauthenticated in this MVP. Throttling and conservative limits bound, but do not eliminate, public traffic cost risk.

The Lambda role uses the three resources required by the documented Global Cross-Region Inference policy: the `ap-northeast-1` inference-profile ARN, the `ap-northeast-1` source-region foundation-model ARN, and the region/account-independent global foundation-model ARN. The policy grants only `bedrock:InvokeModel`. It does not use a broad `bedrock:*` action or an unconstrained resource.

Bedrock costs are driven by input/output tokens and cross-region inference. Additional cost drivers are API Gateway requests, Lambda duration/requests, and CloudWatch logs. Idle serverless cost is minimal, but public traffic remains the principal uncontrolled risk.

The Lambda logs only sanitized success/failure diagnostics. It does not log request payloads, prompts, model responses, landmarks, audio, or user text.

## Automatic deployment and fallback

`.github/workflows/deploy-production.yml` runs on pushes to `main` and manual `workflow_dispatch`. Frontend and semantic bridge jobs remain independently path-triggered; a workflow dispatch runs both. Semantic bridge changes include `backend/semantic-bridge/**`, `infra/aws/ai-semantic-bridge.yaml`, the package helper, and shared runtime/package files.

The semantic bridge job runs `npm ci`, `npm run validate`, `npm run build:semantic-bridge`, and `npm run package:semantic-bridge`, uploads `semantic-bridge/${GITHUB_SHA}.zip`, and creates a uniquely named CloudFormation change set with `--role-arn` set to the dedicated execution role and the exact `AllowedOrigin`, model, bucket, and immutable key parameters. A deterministic safety gate permits only safe `Add` changes and `Modify` changes with `Replacement=False`/`Never`. `Remove`, replacement, unknown action/replacement values, and malformed change metadata fail closed; the change set is not executed and human review is required. A CloudFormation no-change result is a successful no-op and the temporary change set is cleaned up. Safe change sets are executed, then the workflow verifies `CREATE_COMPLETE`/`UPDATE_COMPLETE`, the stack Lambda resource, `LastUpdateStatus`, runtime, memory, and timeout.

The dedicated CloudFormation execution role is the stack service role. After the one-time bootstrap associates it with `sake-sense-ai-production`, CloudFormation continues to use that role for later stack operations; the GitHub OIDC role only controls the named stack/change set and can pass that one role. The workflow does not bypass the gate for destructive changes.

There is no routine CloudShell `aws cloudformation deploy` step after the bootstrap. `workflow_dispatch` is the manual GitHub fallback. Rollback is performed by deploying a reviewed earlier commit through `main`; the versioned artifact bucket retains prior packages. If a change set contains `Remove` or resource replacement, GitHub Actions stops before execution and reports that human action is required; the operator must review the listed logical resource/action/replacement values before using an approved manual process.

When the stack waiter fails, the workflow prints up to ten recent failed resource events (`UPDATE_FAILED`, `CREATE_FAILED`, `DELETE_FAILED`, `UPDATE_ROLLBACK_FAILED`, or `ROLLBACK_FAILED`) with only safe primitive fields, then exits non-zero. This makes the failed logical resource and status reason visible in GitHub Actions without exposing credentials, templates, or full AWS responses.

## Local validation

Normal CI never calls AWS or Bedrock. Use the fixture provider when `VITE_SENSORY_BRIDGE_API_URL` is absent. The backend contract and provider failure paths are covered by deterministic tests with mocked `fetch`/provider responses.

## Human Experience Gate

All items below remain pending until a human deploys the stack and tests the HTTPS production flow:

- [ ] Body flow reaches the production AI semantic bridge
- [ ] Repeated lateral sway does not automatically become a sake term
- [ ] Short abrupt motion produces cautious understandable wording
- [ ] Slow expanding motion does not force an authoritative sake term
- [ ] Ambiguous motion permits zero or multiple candidates
- [ ] AI failure produces usable fallback without raw provider errors
- [ ] Voice structured features work where supported; no raw audio upload occurs
- [ ] Browser DevTools confirms only structured feature JSON is sent
- [ ] Mobile HTTPS Body and Voice flows work
- [ ] CloudFront frontend reaches the API without CORS errors
- [ ] Logs contain no raw sensor data
