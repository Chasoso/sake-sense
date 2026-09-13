import { describe, expect, it, vi } from "vitest";
import { buildConverseInput } from "./bedrock.mjs";
import { createHandler } from "./handler.mjs";

const env = {
  ALLOWED_ORIGIN: "https://example.cloudfront.net",
  BEDROCK_MODEL_ID: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
};

const bodyInput = {
  duration: "short",
  ending: "abrupt",
  expansion: "unknown",
  direction: "unknown",
  repetition: "single",
  participation: "localized",
  spread: "compact",
  speed: "unknown",
};

const bodyRequest = JSON.stringify({
  modality: "body",
  input: bodyInput,
  allowedTermIds: ["kire", "atoaji"],
});

const voiceRequest = JSON.stringify({
  modality: "voice",
  input: { durationMs: 1200, averageIntensity: 0.4, pauseCount: 1, endingBehavior: "fading" },
  allowedTermIds: ["kire", "atoaji"],
});

const emptyResponse = {
  sensoryExpressions: [],
  candidateTermIds: [],
  unmappedFeatures: [],
  reason: "ambiguous",
};

function testHandler(invoke = vi.fn(async () => emptyResponse)) {
  return createHandler({ env, invoke, logger: { info: vi.fn(), error: vi.fn() } });
}

describe("production semantic bridge Lambda", () => {
  it("accepts body and voice structured payloads", async () => {
    const invoke = vi.fn(async () => emptyResponse);
    const handler = testHandler(invoke);
    expect((await handler({ body: bodyRequest })).statusCode).toBe(200);
    expect((await handler({ body: voiceRequest })).statusCode).toBe(200);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed, oversized, unexpected, invalid, unknown, duplicate, and unmapped data", async () => {
    const handler = testHandler(vi.fn());
    const requests = [
      "{",
      "x".repeat(12_001),
      JSON.stringify({ ...JSON.parse(bodyRequest), rawAudio: "no" }),
      JSON.stringify({
        ...JSON.parse(bodyRequest),
        input: { ...bodyInput, direction: "diagonal" },
      }),
      JSON.stringify({ ...JSON.parse(bodyRequest), allowedTermIds: ["kire", "kire"] }),
      JSON.stringify({ ...JSON.parse(bodyRequest), allowedTermIds: ["unknown"] }),
      JSON.stringify({ ...JSON.parse(bodyRequest), allowedTermIds: ["umami"] }),
    ];
    for (const body of requests) {
      expect((await handler({ body })).statusCode).toBe(400);
    }
  });

  it("bounds the Bedrock request and keeps model configuration server-side", () => {
    const input = buildConverseInput(
      {
        modality: "body",
        input: bodyInput,
        allowedTermIds: ["kire"],
        dictionaryContext: [],
      },
      env,
    );
    expect(input.modelId).toBe(env.BEDROCK_MODEL_ID);
    expect(input.inferenceConfig).toEqual({ maxTokens: 256, temperature: 0.2 });
    expect(input.outputConfig.textFormat.type).toBe("json_schema");
    expect(input.system[0].text).toContain("not a taste measurement");
  });

  it("rebuilds canonical dictionary grounding on the backend", async () => {
    const invoke = vi.fn(async (request) => {
      expect(request.dictionaryContext).toHaveLength(1);
      expect(request.dictionaryContext[0]).toMatchObject({
        id: "kire",
        dimensions: [{ dimensionId: "duration", polarity: "short" }],
      });
      expect(typeof request.dictionaryContext[0].displayTerm).toBe("string");
      expect(typeof request.dictionaryContext[0].definitionSummary).toBe("string");
      return emptyResponse;
    });
    const handler = testHandler(invoke);
    const request = JSON.parse(bodyRequest);
    request.allowedTermIds = ["kire"];
    expect((await handler({ body: JSON.stringify(request) })).statusCode).toBe(200);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("rejects browser-supplied dictionary metadata", async () => {
    const request = JSON.parse(bodyRequest);
    request.dictionaryContext = [
      {
        id: "kire",
        displayTerm: "attacker-controlled term",
        definitionSummary: "attacker-controlled definition",
        dimensions: [],
      },
    ];
    const invoke = vi.fn();
    const handler = testHandler(invoke);
    expect((await handler({ body: JSON.stringify(request) })).statusCode).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid model output and sanitizes provider failures", async () => {
    const invalid = testHandler(
      vi.fn(async () => ({
        candidateTermIds: ["unknown"],
        sensoryExpressions: [],
        unmappedFeatures: [],
        reason: "invalid",
      })),
    );
    expect((await invalid({ body: bodyRequest })).statusCode).toBe(400);

    const failing = testHandler(
      vi.fn(async () => {
        throw new Error("secret provider detail");
      }),
    );
    const response = await failing({ body: bodyRequest });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("secret provider detail");
  });
});
