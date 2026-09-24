import { readFile } from "node:fs/promises";

const template = await readFile(
  new URL("../../infra/aws/data-admin.yaml", import.meta.url),
  "utf8",
);
const workflow = await readFile(
  new URL("../../.github/workflows/deploy-data-admin.yml", import.meta.url),
  "utf8",
);
const required = [
  "AWS::DynamoDB::Table",
  "AWS::ApiGatewayV2::Api",
  "AWS::Cognito::UserPool",
  "AWS::Cognito::UserPoolClient",
  "AWS::Cognito::UserPoolGroup",
  "DataApiAuthorizer:",
  "productId-index",
  "BillingMode: PAY_PER_REQUEST",
  "CognitoCallbackUrl:",
  "CognitoLogoutUrl:",
];
const missing = required.filter((value) => !template.includes(value));
if (missing.length) throw new Error(`data-admin infrastructure is missing: ${missing.join(", ")}`);
if (template.includes("GenerateSecret: true"))
  throw new Error("Cognito SPA client must not have a secret");
const workflowRequired = [
  "workflow_dispatch:",
  "environment: production",
  "actions/checkout@v5",
  "npm ci",
  "npm run validate",
  "npm run package:data-platform",
  "configure-aws-credentials@v6",
  "aws s3 cp backend/data-platform/dist/data-platform.zip",
  "create-change-set",
  "check-cloudformation-change-set.mjs",
  "execute-change-set",
  "CAPABILITY_NAMED_IAM",
  "DataApiEndpoint",
  "CognitoUserPoolId",
  "ProductEvidenceTableName",
];
const missingWorkflow = workflowRequired.filter((value) => !workflow.includes(value));
if (missingWorkflow.length)
  throw new Error(`data-admin workflow is missing: ${missingWorkflow.join(", ")}`);
if (/^\s+push:/m.test(workflow) || /deploy-production/.test(workflow))
  throw new Error("data-admin deployment must remain a separate manual workflow");
if (workflow.includes("migrate:sake-data -- --apply"))
  throw new Error("data-admin deployment must not apply migration data");
if (/AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AKIA[0-9A-Z]{16}/.test(workflow))
  throw new Error("data-admin workflow must not contain hardcoded AWS credentials");
console.log("Data-admin infrastructure validation passed.");
