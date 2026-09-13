import { invokeBedrock } from "./bedrock.mjs";
import {
  parseAndValidateRequest,
  SemanticBridgeRequestValidationError,
  SemanticBridgeProviderValidationError,
  validateModelResponse,
} from "./validation.mjs";

function apiResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "access-control-allow-origin": origin },
    body: JSON.stringify(body),
  };
}

function safeProviderErrorMetadata(error) {
  const metadata = { category: "provider_failure", errorName: "UnknownError" };
  try {
    if (error && typeof error === "object") {
      if (typeof error.name === "string" && error.name.trim()) {
        metadata.errorName = error.name;
      }
      const sdkMetadata = error.$metadata;
      if (
        sdkMetadata &&
        typeof sdkMetadata === "object" &&
        Number.isInteger(sdkMetadata.httpStatusCode)
      ) {
        metadata.httpStatusCode = sdkMetadata.httpStatusCode;
      }
      if (
        sdkMetadata &&
        typeof sdkMetadata === "object" &&
        typeof sdkMetadata.requestId === "string" &&
        sdkMetadata.requestId.trim()
      ) {
        metadata.requestId = sdkMetadata.requestId;
      }
    }
  } catch {
    return metadata;
  }
  return metadata;
}

export function createHandler({
  env = process.env,
  invoke = invokeBedrock,
  logger = console,
} = {}) {
  return async (event) => {
    const origin = env.ALLOWED_ORIGIN;
    try {
      const raw = event?.body || "";
      const { value, allowedIds } = parseAndValidateRequest(raw);
      const modelResponse = await invoke(value, env);
      const response = validateModelResponse(modelResponse, allowedIds, value.input);
      logger.info?.(
        JSON.stringify({
          category: "success",
          modality: value.modality,
          model: env.BEDROCK_MODEL_ID,
        }),
      );
      return apiResponse(200, response, origin);
    } catch (error) {
      const isRequestValidationFailure = error instanceof SemanticBridgeRequestValidationError;
      const isProviderValidationFailure = error instanceof SemanticBridgeProviderValidationError;
      const statusCode = isRequestValidationFailure ? 400 : 502;
      logger.error?.(
        JSON.stringify(
          isRequestValidationFailure
            ? { category: "request_validation_failure" }
            : isProviderValidationFailure
              ? { category: "provider_validation_failure" }
              : safeProviderErrorMetadata(error),
        ),
      );
      return apiResponse(
        statusCode,
        { error: statusCode === 400 ? "invalid request" : "semantic bridge unavailable" },
        origin,
      );
    }
  };
}

export const handler = createHandler();
