import { buildConverseInput, invokeBedrock, summarizeConverseRequest } from "./bedrock.mjs";
import { countRenderableProductMatches } from "./product-match-count.mjs";
import {
  parseAndValidateRequest,
  SemanticBridgeRequestValidationError,
  SemanticBridgeProviderValidationError,
  validateModelResponse,
} from "./validation.mjs";
import {
  emitLifecycleEvent,
  buildProviderFailureDiagnostics,
  buildProviderValidationDiagnostics,
  buildSemanticEvaluationDiagnostics,
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
    const startedAt = Date.now();
    let requestValue;
    let providerOutput;
    let requestSummary;
    emitLifecycleEvent(logger, {
      eventName: "semantic_bridge_request_received",
      event,
      startedAt,
      model: env.BEDROCK_MODEL_ID,
    });
    try {
      const raw = event?.body || "";
      const parsed = parseAndValidateRequest(raw);
      requestValue = parsed.value;
      emitLifecycleEvent(logger, {
        eventName: "semantic_bridge_request_validated",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
      });
      requestSummary = summarizeConverseRequest(buildConverseInput(requestValue, env));
      emitLifecycleEvent(logger, {
        eventName: "bedrock_request_prepared",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
        requestSummary,
      });
      emitLifecycleEvent(logger, {
        eventName: "bedrock_invoke_started",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
        requestSummary,
      });
      providerOutput = await invoke(requestValue, env);
      emitLifecycleEvent(logger, {
        eventName: "bedrock_invoke_succeeded",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
        requestSummary,
        providerResponseSummary: providerOutput?.providerResponseSummary,
      });
      emitLifecycleEvent(logger, {
        eventName: "provider_validation_started",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
      });
      const response = validateModelResponse(providerOutput, parsed.allowedIds, requestValue);
      emitLifecycleEvent(logger, {
        eventName: "provider_validation_succeeded",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
      });
      emitLifecycleEvent(logger, {
        eventName: "grounding_completed",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
      });
      logger.info?.(
        JSON.stringify(
          buildSemanticEvaluationDiagnostics({
            event,
            modality: requestValue.modality,
            input: requestValue.input,
            response,
            productMatchCount: countRenderableProductMatches(response.candidateTermIds),
          }),
        ),
      );
      logger.info?.(
        JSON.stringify(
          buildShadowDiagnostics(response, event, requestValue.modality, env.BEDROCK_MODEL_ID),
        ),
      );
      emitLifecycleEvent(logger, {
        eventName: "semantic_bridge_response_completed",
        event,
        startedAt,
        modality: requestValue.modality,
        model: env.BEDROCK_MODEL_ID,
      });
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
                  providerResponseSummary:
                    error?.providerResponseSummary ?? providerOutput?.providerResponseSummary,
                })
              : buildProviderFailureDiagnostics({
                  error,
                  event,
                  modality: requestValue?.modality,
                  model: env.BEDROCK_MODEL_ID,
                  elapsedMs: Date.now() - startedAt,
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
