import { invokeBedrock } from "./bedrock.mjs";
import {
  parseAndValidateRequest,
  SemanticBridgeRequestValidationError,
  SemanticBridgeProviderValidationError,
  validateModelResponse,
} from "./validation.mjs";
import {
  buildProviderFailureDiagnostics,
  buildProviderValidationDiagnostics,
} from "./diagnostics.mjs";

function apiResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "access-control-allow-origin": origin },
    body: JSON.stringify(body),
  };
}

function buildShadowDiagnostics(response, event, modality, model) {
  const interpretation = response.sensoryInterpretation;
  const requestId = event?.requestContext?.requestId;
  return {
    category: "shadow_interpretation",
    ...(typeof requestId === "string" && requestId.trim() ? { requestId } : {}),
    modality,
    model,
    providerValidation: "passed",
    semanticOutcome: interpretation?.outcome ?? "missing",
    ...(interpretation?.outcome === "interpreted"
      ? { primaryProfile: interpretation.semanticProfile }
      : {}),
    experimentalAxes:
      interpretation?.outcome === "interpreted" && interpretation.experimentalProfile
        ? Object.keys(interpretation.experimentalProfile).sort()
        : [],
  };
}

export function createHandler({
  env = process.env,
  invoke = invokeBedrock,
  logger = console,
} = {}) {
  return async (event) => {
    const origin = env.ALLOWED_ORIGIN;
    let requestValue;
    let providerOutput;
    try {
      const raw = event?.body || "";
      const parsed = parseAndValidateRequest(raw);
      requestValue = parsed.value;
      providerOutput = await invoke(requestValue, env);
      const response = validateModelResponse(providerOutput, parsed.allowedIds, requestValue);
      logger.info?.(
        JSON.stringify(
          buildShadowDiagnostics(response, event, requestValue.modality, env.BEDROCK_MODEL_ID),
        ),
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
              ? buildProviderValidationDiagnostics({
                  error,
                  event,
                  modality: requestValue?.modality,
                  input: requestValue?.input,
                  model: env.BEDROCK_MODEL_ID,
                  providerOutput,
                  providerOutputKind: error?.providerOutputKind,
                })
              : buildProviderFailureDiagnostics({
                  error,
                  event,
                  modality: requestValue?.modality,
                  model: env.BEDROCK_MODEL_ID,
                }),
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
