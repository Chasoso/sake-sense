import { describe, expect, it, vi } from "vitest";
import { buildConverseInput } from "./bedrock.mjs";
import { createHandler } from "./handler.mjs";

const env = {
  ALLOWED_ORIGIN: "https://example.cloudfront.net",
  ALLOWED_TERM_IDS: "kire,atoaji",
  BEDROCK_MODEL_ID: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
};
const context = [
  {
    id: "kire",
    displayTerm: "切れ",
    definitionSummary: "短い余韻",
    dimensions: [{ dimensionId: "duration", polarity: "short" }],
  },
  {
    id: "atoaji",
    displayTerm: "あと味",
    definitionSummary: "後に残る味わい",
    dimensions: [{ dimensionId: "duration", polarity: "lingering" }],
  },
];
const bodyRequest = JSON.stringify({
  modality: "body",
  input: {
    duration: "short",
    ending: "abrupt",
    expansion: "unknown",
    direction: "unknown",
    repetition: "single",
    participation: "localized",
    spread: "compact",
    speed: "unknown",
  },
  dictionaryContext: context,
});
const voiceRequest = JSON.stringify({
  modality: "voice",
  input: { durationMs: 1200, averageIntensity: 0.4, pauseCount: 1, endingBehavior: "fading" },
  dictionaryContext: context,
});

describe("production semantic bridge Lambda", () => {
  it("accepts body and voice structured payloads", async () => {
    const invoke = vi.fn(async () => ({
      sensoryExpressions: [],
      candidateTermIds: [],
      unmappedFeatures: [],
      reason: "ambiguous",
    }));
    const handler = createHandler({ env, invoke, logger: { info: vi.fn(), error: vi.fn() } });
    expect((await handler({ body: bodyRequest })).statusCode).toBe(200);
    expect((await handler({ body: voiceRequest })).statusCode).toBe(200);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed, oversized, unexpected, invalid, unknown, and duplicate data", async () => {
    const handler = createHandler({
      env,
      invoke: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });
    for (const body of [
      "{",
      "x".repeat(12_001),
      JSON.stringify({ ...JSON.parse(bodyRequest), rawAudio: "no" }),
      JSON.stringify({
        ...JSON.parse(bodyRequest),
        input: { ...JSON.parse(bodyRequest).input, direction: "diagonal" },
      }),
      JSON.stringify({
        ...JSON.parse(bodyRequest),
        dictionaryContext: [{ ...context[0] }, { ...context[0] }],
      }),
      JSON.stringify({
        ...JSON.parse(bodyRequest),
        dictionaryContext: [{ ...context[0], id: "unknown" }],
      }),
    ]) {
      expect((await handler({ body })).statusCode).toBe(400);
    }
  });

  it("bounds the Bedrock request and keeps model configuration server-side", () => {
    const input = buildConverseInput(JSON.parse(bodyRequest), env);
    expect(input.modelId).toBe(env.BEDROCK_MODEL_ID);
    expect(input.inferenceConfig).toEqual({ maxTokens: 256, temperature: 0.2 });
    expect(input.outputConfig.textFormat.type).toBe("json_schema");
    expect(input.system[0].text).toContain("not a taste measurement");
  });

  it("rejects invalid model output and sanitizes provider failures", async () => {
    const invalid = createHandler({
      env,
      invoke: vi.fn(async () => ({
        candidateTermIds: ["unknown"],
        sensoryExpressions: [],
        unmappedFeatures: [],
        reason: "x",
      })),
      logger: { info: vi.fn(), error: vi.fn() },
    });
    expect((await invalid({ body: bodyRequest })).statusCode).toBe(400);
    const failing = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw new Error("secret provider detail");
      }),
      logger: { info: vi.fn(), error: vi.fn() },
    });
    const response = await failing({ body: bodyRequest });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("secret provider detail");
  });
});
