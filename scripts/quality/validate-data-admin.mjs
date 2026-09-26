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
  'RouteKey: "GET /admin/{proxy+}"',
  'RouteKey: "POST /admin/{proxy+}"',
  'RouteKey: "PATCH /admin/{proxy+}"',
  "productId-index",
  "BillingMode: PAY_PER_REQUEST",
  "CognitoCallbackUrl:",
  "CognitoLogoutUrl:",
  "MfaConfiguration: OPTIONAL",
  "EnabledMfas:",
  "SOFTWARE_TOKEN_MFA",
  "RoleName: !Sub ${AWS::StackName}-lambda-runtime",
  "RoleName: !Sub ${AWS::StackName}-lambda-admin",
  "FunctionName: !Sub ${AWS::StackName}-public-read",
  "FunctionName: !Sub ${AWS::StackName}-admin-write",
];
const missing = required.filter((value) => !template.includes(value));
if (missing.length) throw new Error(`data-admin infrastructure is missing: ${missing.join(", ")}`);
if (template.includes('RouteKey: "ANY /admin/{proxy+}"'))
  throw new Error("authenticated admin ANY route must not expose unsupported methods or OPTIONS");
if (
  template.includes("AdminOptionsRoute:") ||
  template.includes('RouteKey: "OPTIONS /admin/{proxy+}"')
)
  throw new Error(
    "data-admin must rely on HTTP API CORS instead of an explicit admin OPTIONS route",
  );
const dataApiStageStart = template.indexOf("DataApiStage:");
const adminRoutes = ["AdminGetRoute:", "AdminPostRoute:", "AdminPatchRoute:"];
for (const routeName of adminRoutes) {
  const routeStart = template.indexOf(routeName);
  const nextRouteStart = adminRoutes
    .filter((candidate) => candidate !== routeName)
    .map((candidate) => template.indexOf(candidate, routeStart + routeName.length))
    .filter((index) => index >= 0)
    .concat(dataApiStageStart)
    .sort((a, b) => a - b)[0];
  const route = template.slice(routeStart, nextRouteStart);
  if (
    !route.includes("AuthorizationType: JWT") ||
    !route.includes("AuthorizerId: !Ref DataApiAuthorizer") ||
    !route.includes("Target: !Sub integrations/${AdminIntegration}")
  )
    throw new Error(`${routeName} must retain the JWT authorizer and AdminIntegration`);
}
for (const forbidden of [
  "SmsConfiguration:",
  "AWS::SNS",
  "phone_number",
  "AutoVerifiedAttributes:",
]) {
  if (template.includes(forbidden))
    throw new Error(
      `data-admin Cognito configuration must not introduce SMS/phone MFA: ${forbidden}`,
    );
}
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
for (const required of [
  'describe_output="$(\n',
  "2>&1\n",
  "printf '%s\\n' \"${describe_output}\"",
  'grep -qi "does not exist"',
  'echo "Unable to determine whether the data-admin stack exists." >&2',
]) {
  if (!workflow.includes(required))
    throw new Error(
      `data-admin workflow must preserve visible stack detection diagnostics: ${required}`,
    );
}
if (
  workflow.includes(
    'describe-stacks --stack-name "${DATA_ADMIN_STACK_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1',
  )
)
  throw new Error("data-admin stack detection must not discard the AWS CLI error");
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
  "GitHubActionsDataAdminDeploymentPolicy",
  "s3:PutObject",
  "DetectDataAdminStackBeforeCreate",
  "cloudformation:CreateChangeSet",
  "cloudformation:DescribeChangeSet",
  "cloudformation:ExecuteChangeSet",
  "cloudformation:DescribeStacks",
  "cloudformation:DescribeStackEvents",
  "cloudformation:DescribeStackResources",
  "lambda:GetFunctionConfiguration",
  "dynamodb:DescribeTable",
  "cognito-idp:SetUserPoolMfaConfig",
  "apigateway:TagResource",
  "apigateway:UntagResource",
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
const githubDeploymentStart = bootstrap.indexOf("GitHubActionsDataAdminDeploymentPolicy:");
const githubPassRolePolicy = bootstrap.slice(
  githubPassRoleStart,
  githubDeploymentStart < 0 ? undefined : githubDeploymentStart,
);
if (githubPassRoleStart < 0)
  throw new Error("data-admin bootstrap is missing the GitHub Actions PassRole policy");
if (githubDeploymentStart < 0)
  throw new Error("data-admin bootstrap is missing the GitHub Actions deployment policy");
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
const githubDeploymentPolicy = bootstrap.slice(githubDeploymentStart);
const detectionStart = githubDeploymentPolicy.indexOf("Sid: DetectDataAdminStackBeforeCreate");
const createChangeSetStart = githubDeploymentPolicy.indexOf("Sid: CreateDataAdminChangeSet");
const manageStackStart = githubDeploymentPolicy.indexOf("Sid: InspectAndExecuteDataAdminChangeSet");
if (
  detectionStart < 0 ||
  createChangeSetStart < 0 ||
  manageStackStart < 0 ||
  !githubDeploymentPolicy
    .slice(detectionStart, createChangeSetStart)
    .includes("Action: cloudformation:DescribeStacks") ||
  !githubDeploymentPolicy.slice(detectionStart, createChangeSetStart).includes('Resource: "*"') ||
  !githubDeploymentPolicy
    .slice(createChangeSetStart, manageStackStart)
    .includes("Action: cloudformation:CreateChangeSet") ||
  !githubDeploymentPolicy.slice(createChangeSetStart, manageStackStart).includes('Resource: "*"') ||
  githubDeploymentPolicy.slice(manageStackStart).includes('Resource: "*"')
)
  throw new Error(
    "GitHub Actions CloudFormation pre-create and stack-scoped statements are invalid",
  );
for (const required of [
  "!Ref GitHubActionsRoleName",
  "arn:${AWS::Partition}:s3:::${ArtifactBucketName}/data-admin/*",
  "arn:${AWS::Partition}:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/${DataAdminStackName}/*",
  "arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${DataAdminStackName}-*",
  "arn:${AWS::Partition}:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${DataAdminStackName}-*",
]) {
  if (!githubDeploymentPolicy.includes(required))
    throw new Error(`GitHub Actions deployment policy is missing scope: ${required}`);
}
if (!githubDeploymentPolicy.includes("Action: s3:PutObject"))
  throw new Error("GitHub Actions deployment policy must grant s3:PutObject");
if (!githubDeploymentPolicy.includes("Action: lambda:GetFunctionConfiguration"))
  throw new Error("GitHub Actions deployment policy must grant Lambda verification read access");
if (!githubDeploymentPolicy.includes("Action: dynamodb:DescribeTable"))
  throw new Error("GitHub Actions deployment policy must grant DynamoDB verification read access");
if (
  (githubDeploymentPolicy.match(/^\s+Resource: "\*"/gm) ?? []).length !== 2 ||
  !githubDeploymentPolicy.includes("Sid: DetectDataAdminStackBeforeCreate") ||
  !githubDeploymentPolicy.includes("Sid: CreateDataAdminChangeSet")
)
  throw new Error(
    "GitHub Actions deployment policy must isolate only stack detection and CREATE change-set wildcard access",
  );
if (githubDeploymentPolicy.includes("cloudformation:DeleteChangeSet"))
  throw new Error("GitHub Actions deployment policy must not grant unused DeleteChangeSet");
for (const forbidden of [
  "cloudformation:*",
  "s3:*",
  "lambda:*",
  "dynamodb:*",
  "iam:CreateRole",
  "iam:PutRolePolicy",
  "cognito-idp:",
  "apigateway:",
]) {
  if (githubDeploymentPolicy.includes(forbidden))
    throw new Error(`GitHub Actions deployment policy contains forbidden permission: ${forbidden}`);
}
if (workflow.includes("vars.CLOUDFORMATION_EXECUTION_ROLE_ARN"))
  throw new Error("data-admin workflow must use its dedicated execution role variable");
for (const requiredTrigger of ["workflow_dispatch:", "workflow_call:"]) {
  if (!workflow.includes(requiredTrigger))
    throw new Error(`data-admin workflow must support ${requiredTrigger}`);
}
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
const missingRequiredFrontendVariables = frontendPassThrough.filter(
  (value) => !requiredFrontendLine.includes(value.split(":")[0]),
);
if (missingRequiredFrontendVariables.length)
  throw new Error(
    `frontend deploy is missing required data-admin variables: ${missingRequiredFrontendVariables.join(", ")}`,
  );
for (const requiredProductionWorkflowText of [
  "data_admin: ${{ steps.paths.outputs.data_admin }}",
  "data_admin=true",
  "uses: ./.github/workflows/deploy-data-admin.yml",
  "needs.deploy-data-admin.result == 'success'",
  "backend/data-platform/",
  "infra/aws/data-admin\\.yaml",
  "scripts/package-data-platform\\.mjs",
  "scripts/check-cloudformation-change-set\\.mjs",
  "scripts/quality/validate-data-admin\\.mjs",
]) {
  if (!frontendWorkflow.includes(requiredProductionWorkflowText))
    throw new Error(
      `Deploy production workflow is missing data-admin integration: ${requiredProductionWorkflowText}`,
    );
}
const deployDataAdminJobStart = frontendWorkflow.indexOf("  deploy-data-admin:");
const deployFrontendJobStart = frontendWorkflow.indexOf("  deploy-frontend:");
const deployDataAdminJob = frontendWorkflow.slice(deployDataAdminJobStart, deployFrontendJobStart);
if (
  deployDataAdminJobStart < 0 ||
  deployFrontendJobStart < deployDataAdminJobStart ||
  !deployDataAdminJob.includes("permissions:") ||
  !deployDataAdminJob.includes("contents: read") ||
  !deployDataAdminJob.includes("id-token: write")
)
  throw new Error(
    "data-admin reusable workflow caller must grant contents: read and id-token: write",
  );
if (frontendWorkflow.includes("infra/aws/data-admin\\.yaml$|infra/aws/data-admin-bootstrap"))
  throw new Error("data-admin bootstrap changes must not trigger automatic stack deployment");
if (frontendWorkflow.includes("migrate:sake-data -- --apply"))
  throw new Error("Deploy production workflow must not apply migration data");
console.log("Data-admin infrastructure validation passed.");
