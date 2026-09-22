import { responseSchema, systemInstruction } from "./schema.mjs";
import { SemanticBridgeProviderValidationError } from "./validation.mjs";
import { BEDROCK_PROVIDER_TIMEOUT_MS } from "./diagnostics.mjs";

export const BEDROCK_MAX_TOKENS = 1024;
export const PROVIDER_RESPONSE_SUMMARY_PROPERTY = "providerResponseSummary";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const CONVERSE_STOP_REASONS = new Set([
  "end_turn",
  "tool_use",
  "max_tokens",
  "stop_sequence",
  "guardrail_intervened",
  "content_filtered",
  "malformed_model_output",
  "malformed_tool_use",
  "model_context_window_exceeded",
]);

function safeNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function summarizeConverseResponse(response) {
  if (!isRecord(response)) {
    return {
      kind: Array.isArray(response) ? "array" : response === null ? "null" : typeof response,
    };
  }

  const content = response.output?.message?.content;
  const contentBlocks = Array.isArray(content) ? content : [];
  const textBlockCount = contentBlocks.filter(
    (block) => isRecord(block) && typeof block.text === "string",
  ).length;
  const summary = {
    kind: "object",
    contentBlockCount: contentBlocks.length,
    textBlockCount,
  };
  if (typeof response.stopReason === "string" && CONVERSE_STOP_REASONS.has(response.stopReason)) {
    summary.stopReason = response.stopReason;
  }
  if (isRecord(response.usage)) {
    for (const key of ["inputTokens", "outputTokens", "totalTokens"]) {
      const value = safeNonNegativeInteger(response.usage[key]);
      if (value !== undefined) summary[key] = value;
    }
  }
  const latencyMs = safeNonNegativeInteger(response.metrics?.latencyMs);
  if (latencyMs !== undefined) summary.latencyMs = latencyMs;
  return summary;
}

function attachProviderResponseSummary(value, summary) {
  if (value && typeof value === "object") {
    try {
      Object.defineProperty(value, PROVIDER_RESPONSE_SUMMARY_PROPERTY, {
        configurable: true,
        enumerable: false,
        value: summary,
      });
      return value;
    } catch {
      // Fall through for frozen or otherwise non-extensible values.
    }
  }
  return value;
}

export function summarizeConverseRequest(request) {
  if (!isRecord(request)) return { kind: Array.isArray(request) ? "array" : typeof request };
  const contentBlockTypes = [
    ...(Array.isArray(request.system) ? request.system : []),
    ...(Array.isArray(request.messages)
      ? request.messages.flatMap((message) =>
          Array.isArray(message?.content) ? message.content : [],
        )
      : []),
  ]
    .filter(isRecord)
    .flatMap((block) => Object.keys(block))
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .sort();

  let schemaTopLevelKeys;
  const schemaText = request.outputConfig?.textFormat?.structure?.jsonSchema?.schema;
  if (typeof schemaText === "string") {
    try {
      const schema = JSON.parse(schemaText);
      if (isRecord(schema)) schemaTopLevelKeys = Object.keys(schema).sort();
    } catch {
      // Keep the request diagnostic structural and omit an invalid schema summary.
    }
  }

  return {
    ...(typeof request.modelId === "string" && request.modelId.trim()
      ? { modelId: request.modelId }
      : {}),
    hasSystem: Array.isArray(request.system) && request.system.length > 0,
    messageCount: Array.isArray(request.messages) ? request.messages.length : 0,
    contentBlockTypes,
    hasInferenceConfig: isRecord(request.inferenceConfig),
    hasOutputConfig: isRecord(request.outputConfig),
    ...(typeof request.outputConfig?.textFormat?.type === "string"
      ? { textFormatType: request.outputConfig.textFormat.type }
      : {}),
    ...(schemaTopLevelKeys ? { schemaTopLevelKeys } : {}),
  };
}

function attachConverseRequestSummary(error, requestSummary, timeoutMs) {
  const failureMetadata = timeoutMs ? { failureKind: "timeout", providerTimeoutMs: timeoutMs } : {};
  if (error && typeof error === "object") {
    try {
      Object.defineProperty(error, "converseRequestSummary", {
        configurable: true,
        enumerable: false,
        value: requestSummary,
      });
      for (const [key, value] of Object.entries(failureMetadata)) {
        Object.defineProperty(error, key, {
          configurable: true,
          enumerable: false,
          value,
        });
      }
      return error;
    } catch {
      // Fall through for frozen or otherwise non-extensible SDK errors.
    }
  }

  const wrapped = new Error(
    typeof error?.message === "string" ? error.message : "Bedrock request failed",
  );
  if (typeof error?.name === "string") wrapped.name = error.name;
  if (isRecord(error?.$metadata)) wrapped.$metadata = error.$metadata;
  if (typeof error?.$fault === "string") wrapped.$fault = error.$fault;
  wrapped.converseRequestSummary = requestSummary;
  Object.assign(wrapped, failureMetadata);
  return wrapped;
}

export function buildConverseInput(request, env) {
  const interpretationInput = {
    modality: request.modality,
    input: request.input,
  };
  return {
    modelId: env.BEDROCK_MODEL_ID,
    system: [{ text: systemInstruction }],
    messages: [{ role: "user", content: [{ text: JSON.stringify(interpretationInput) }] }],
    inferenceConfig: { maxTokens: BEDROCK_MAX_TOKENS, temperature: 0.2 },
    outputConfig: {
      textFormat: {
        type: "json_schema",
        structure: {
          jsonSchema: {
            name: "sensory_bridge_response",
            description: "Validated semantic bridge response",
            schema: JSON.stringify(responseSchema),
          },
        },
      },
    },
  };
}

export async function invokeBedrock(
  request,
  env,
  clientFactory = defaultClientFactory,
  { providerTimeoutMs = BEDROCK_PROVIDER_TIMEOUT_MS } = {},
) {
  const { client, ConverseCommand } = await clientFactory(env);
  const converseInput = buildConverseInput(request, env);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), providerTimeoutMs);
  let result;
  try {
    result = await client.send(new ConverseCommand(converseInput), {
      abortSignal: abortController.signal,
    });
  } catch (error) {
    throw attachConverseRequestSummary(
      error,
      summarizeConverseRequest(converseInput),
      abortController.signal.aborted ? providerTimeoutMs : undefined,
    );
  } finally {
    clearTimeout(timeoutId);
  }
  const providerResponseSummary = summarizeConverseResponse(result);
  const text = result.output?.message?.content?.find(
    (item) => isRecord(item) && typeof item.text === "string",
  )?.text;
  if (!text) {
    const error = new SemanticBridgeProviderValidationError("empty model response", {
      providerOutputKind: "empty",
    });
    attachProviderResponseSummary(error, providerResponseSummary);
    throw error;
  }
  try {
    return attachProviderResponseSummary(JSON.parse(text), providerResponseSummary);
  } catch {
    const error = new SemanticBridgeProviderValidationError("malformed model JSON", {
      providerOutputKind: "string",
    });
    attachProviderResponseSummary(error, providerResponseSummary);
    throw error;
  }
}

async function defaultClientFactory(env) {
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
  return { client: new BedrockRuntimeClient({ region: env.AWS_REGION }), ConverseCommand };
}
