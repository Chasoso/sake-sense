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

## Human deployment

Codex does not deploy this stack or request model access. An AWS operator must first confirm that the selected global inference profile is available and enabled for the account in Bedrock. If AWS presents a model-access, quota, Marketplace, or first-use action, complete that action in the AWS account before continuing; do not silently select another model.

Build the Lambda bundle locally. The bundle leaves `@aws-sdk/client-bedrock-runtime` external because the Node.js 24 Lambda runtime supplies AWS SDK v3:

```bash
npm ci
npm run build:semantic-bridge
cd backend/semantic-bridge/dist
zip -q index.js.zip index.js
```

Upload the bundle to a human-managed private artifact bucket using a commit-specific key:

```bash
aws s3 cp index.js.zip \
  s3://<LAMBDA_ARTIFACT_BUCKET>/semantic-bridge/<GIT_SHA>.zip \
  --region ap-northeast-1
```

Deploy the dedicated stack after the static hosting stack has produced the CloudFront domain:

```bash
aws cloudformation deploy \
  --template-file infra/aws/ai-semantic-bridge.yaml \
  --stack-name sake-sense-ai-production \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AllowedOrigin=https://<CLOUDFRONT_DOMAIN> \
    BedrockModelId=global.anthropic.claude-haiku-4-5-20251001-v1:0 \
    LambdaCodeS3Bucket=<LAMBDA_ARTIFACT_BUCKET> \
    LambdaCodeS3Key=semantic-bridge/<GIT_SHA>.zip \
  --region ap-northeast-1
```

`LambdaCodeS3Bucket` and `LambdaCodeS3Key` are required because the Lambda source is packaged outside CloudFormation. Do not use the website bucket unless its artifact retention and access policy are intentionally approved.

Set the following GitHub `production` Environment variable from the stack output:

- `VITE_SENSORY_BRIDGE_API_URL`: `SemanticBridgeApiEndpoint`

The existing AWS deployment variables remain unchanged. The frontend explicitly selects the AI provider only when this Vite variable is present; local development, tests, and CI remain deterministic and no-network by default. The Voice path sends only locally derived `durationMs`, `averageIntensity`, `pauseCount`, and `endingBehavior`; microphone samples and audio buffers never leave the browser. The Lambda bundle is a single `index.js` file containing the pinned `@aws-sdk/client-bedrock-runtime` dependency; the Lambda runtime's bundled SDK is not relied upon.

## Safeguards and boundaries

- API Gateway route: `POST /semantic-bridge`
- CORS: one configured CloudFront origin; no wildcard
- Throttling target: 1 request/second, burst 5
- Lambda timeout: 10 seconds; reserved concurrency defaults to 2
- Request size limit: 12,000 bytes
- Bedrock output limit: 256 tokens; low temperature
- Candidate IDs are restricted to mapped dictionary IDs from the canonical repository JSON. The browser supplies IDs only; Lambda reconstructs `displayTerm`, `definitionSummary`, and `dimensions` before building the Bedrock prompt, and the browser validates the response again.
- Provider errors, timeouts, malformed JSON, and unknown IDs return a safe non-candidate response through the existing fallback path.
- HTTP 400 denotes an invalid browser semantic-bridge request; HTTP 502 denotes provider invocation failure or invalid provider/model output. Both remain sanitized and use the frontend fallback path.
- The endpoint is unauthenticated in this MVP. Throttling and conservative limits bound, but do not eliminate, public traffic cost risk.

The Lambda role uses the three resources required by the documented Global Cross-Region Inference policy: the `ap-northeast-1` inference-profile ARN, the `ap-northeast-1` source-region foundation-model ARN, and the region/account-independent global foundation-model ARN. The policy grants only `bedrock:InvokeModel`. It does not use a broad `bedrock:*` action or an unconstrained resource.

Bedrock costs are driven by input/output tokens and cross-region inference. Additional cost drivers are API Gateway requests, Lambda duration/requests, and CloudWatch logs. Idle serverless cost is minimal, but public traffic remains the principal uncontrolled risk.

The Lambda logs only a sanitized success/failure category. It does not log request payloads, prompts, model responses, landmarks, audio, or user text.

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
