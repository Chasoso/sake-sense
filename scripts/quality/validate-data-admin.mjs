import { readFile } from "node:fs/promises";

const template = await readFile(
  new URL("../../infra/aws/data-admin.yaml", import.meta.url),
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
console.log("Data-admin infrastructure validation passed.");
