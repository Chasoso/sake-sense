import { readFile } from "node:fs/promises";

const template = await readFile(
  new URL("../../infra/aws/data-admin.yaml", import.meta.url),
  "utf8",
);
const bootstrap = await readFile(
  new URL("../../infra/aws/data-admin-bootstrap.yaml", import.meta.url),
  "utf8",
);
const workflow = await readFile(
  new URL("../../.github/workflows/deploy-data-admin.yml", import.meta.url),
  "utf8",
);
const semanticBridgeWorkflow = await readFile(
  new URL("../../.github/workflows/deploy-production.yml", import.meta.url),
  "utf8",
);
const frontendWorkflow = await readFile(
  new URL("../../.github/workflows/deploy-production.yml", import.meta.url),
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
  "RoleName: !Sub ${AWS::StackName}-lambda-runtime",
  "RoleName: !Sub ${AWS::StackName}-lambda-admin",
  "FunctionName: !Sub ${AWS::StackName}-public-read",
  "FunctionName: !Sub ${AWS::StackName}-admin-write",
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
const bootstrapRequired = [
  "AWS::IAM::Role",
  "cloudformation.amazonaws.com",
  "DataAdminCloudFormationExecutionRoleArn",
  "s3:GetObject",
  "s3:GetObjectVersion",
  "data-admin/*",
  "iam:PassRole",
  "iam:PassedToService",
  "GitHubActionsRoleName",
  "AWS::IAM::Policy",
  "!Ref GitHubActionsRoleName",
  "!GetAtt DataAdminCloudFormationExecutionRole.Arn",
  "cloudformation.amazonaws.com",
];
const missingBootstrap = bootstrapRequired.filter((value) => !bootstrap.includes(value));
if (missingBootstrap.length)
  throw new Error(`data-admin bootstrap is missing: ${missingBootstrap.join(", ")}`);
for (const forbidden of [
  "AdministratorAccess",
  "PowerUserAccess",
  "iam:*",
  "dynamodb:*",
  "lambda:*",
]) {
  if (bootstrap.includes(forbidden))
    throw new Error(`data-admin bootstrap contains forbidden broad permission: ${forbidden}`);
}
if (bootstrap.includes("Principal:\n              Service: lambda.amazonaws.com"))
  throw new Error("data-admin bootstrap role must trust CloudFormation only");
const githubPassRoleStart = bootstrap.indexOf("GitHubActionsDataAdminPassRolePolicy:");
const githubPassRolePolicy = bootstrap.slice(githubPassRoleStart);
if (githubPassRoleStart < 0)
  throw new Error("data-admin bootstrap is missing the GitHub Actions PassRole policy");
if (githubPassRolePolicy.includes('Resource: "*"'))
  throw new Error("GitHub Actions data-admin PassRole must not use Resource: *");
if (!githubPassRolePolicy.includes("Action: iam:PassRole"))
  throw new Error("GitHub Actions data-admin policy must grant only iam:PassRole");
for (const forbidden of ["iam:*", "iam:CreateRole", "iam:PutRolePolicy", "lambda.amazonaws.com"]) {
  if (githubPassRolePolicy.includes(forbidden))
    throw new Error(`GitHub Actions PassRole policy contains forbidden permission: ${forbidden}`);
}
if (!bootstrap.includes("iam:PassedToService: lambda.amazonaws.com"))
  throw new Error("data-admin Lambda-side PassRole condition must remain intact");
if (workflow.includes("vars.CLOUDFORMATION_EXECUTION_ROLE_ARN"))
  throw new Error("data-admin workflow must use its dedicated execution role variable");
if (semanticBridgeWorkflow.includes("vars.DATA_ADMIN_CLOUDFORMATION_EXECUTION_ROLE_ARN"))
  throw new Error("semantic-bridge deployment must not use the data-admin execution role variable");
const frontendPassThrough = [
  "VITE_SAKE_DATA_API_BASE_URL: ${{ vars.VITE_SAKE_DATA_API_BASE_URL }}",
  "VITE_COGNITO_DOMAIN: ${{ vars.VITE_COGNITO_DOMAIN }}",
  "VITE_COGNITO_CLIENT_ID: ${{ vars.VITE_COGNITO_CLIENT_ID }}",
  "VITE_COGNITO_REDIRECT_URI: ${{ vars.VITE_COGNITO_REDIRECT_URI }}",
  "VITE_COGNITO_LOGOUT_URI: ${{ vars.VITE_COGNITO_LOGOUT_URI }}",
];
const missingFrontendPassThrough = frontendPassThrough.filter(
  (value) => !frontendWorkflow.includes(value),
);
if (missingFrontendPassThrough.length)
  throw new Error(
    `frontend deploy is missing optional data-admin env pass-through: ${missingFrontendPassThrough.join(", ")}`,
  );
const requiredFrontendLine = frontendWorkflow.match(/for variable in ([^\n]+)/)?.[1] ?? "";
if (frontendPassThrough.some((value) => requiredFrontendLine.includes(value.split(":")[0])))
  throw new Error("data-admin frontend env pass-through must remain optional");
console.log("Data-admin infrastructure validation passed.");
