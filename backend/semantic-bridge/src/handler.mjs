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
        JSON.stringify({
          category: isRequestValidationFailure
            ? "request_validation_failure"
            : isProviderValidationFailure
              ? "provider_validation_failure"
              : "provider_failure",
        }),
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
