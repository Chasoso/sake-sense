import { responseSchema, systemInstruction } from "./schema.mjs";
import { SemanticBridgeProviderValidationError } from "./validation.mjs";

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

export async function invokeBedrock(request, env, clientFactory = defaultClientFactory) {
  const { client, ConverseCommand } = await clientFactory(env);
  const result = await client.send(new ConverseCommand(buildConverseInput(request, env)));
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
