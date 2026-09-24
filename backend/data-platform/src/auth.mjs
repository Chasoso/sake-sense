import { CognitoJwtVerifier } from "aws-jwt-verify";

export function createAdminAuthorizer({
  userPoolId = process.env.COGNITO_USER_POOL_ID,
  clientId = process.env.COGNITO_CLIENT_ID,
} = {}) {
  const verifier =
    userPoolId && clientId
      ? CognitoJwtVerifier.create({ userPoolId, tokenUse: "access", clientId })
      : null;
  return async function authorize(event) {
    const token = event?.headers?.authorization?.replace(/^Bearer\s+/i, "");
    if (!verifier || !token) return { ok: false, statusCode: 401, message: "Unauthorized" };
    try {
      const claims = await verifier.verify(token);
      const groups = Array.isArray(claims["cognito:groups"])
        ? claims["cognito:groups"]
        : String(claims["cognito:groups"] ?? "")
            .split(" ")
            .filter(Boolean);
      if (!groups.includes("admin")) return { ok: false, statusCode: 403, message: "Forbidden" };
      return { ok: true, claims };
    } catch {
      return { ok: false, statusCode: 401, message: "Unauthorized" };
    }
  };
}
