import { responseSchema, systemInstruction } from "./schema.mjs";
import { SemanticBridgeProviderValidationError } from "./validation.mjs";
import { BEDROCK_PROVIDER_TIMEOUT_MS } from "./diagnostics.mjs";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    inferenceConfig: { maxTokens: 256, temperature: 0.2 },
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
  const text = result.output?.message?.content?.find((item) => item.text)?.text;
  if (!text) {
    throw new SemanticBridgeProviderValidationError("empty model response", {
      providerOutputKind: "empty",
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new SemanticBridgeProviderValidationError("malformed model JSON", {
      providerOutputKind: "string",
    });
  }
}

async function defaultClientFactory(env) {
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
  return { client: new BedrockRuntimeClient({ region: env.AWS_REGION }), ConverseCommand };
}
