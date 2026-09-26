import { describe, expect, it, vi } from "vitest";
import { buildConverseInput } from "./bedrock.mjs";
import { createHandler } from "./handler.mjs";

const env = {
  ALLOWED_ORIGIN: "https://example.cloudfront.net",
  BEDROCK_MODEL_ID: "example-model",
};

const primaryProfile = {
  timeQuality: "unknown",
  weightQuality: "unknown",
  flowQuality: "unknown",
  directness: "unknown",
  persistence: "unknown",
  resolution: "unknown",
  continuity: "unknown",
  rhythmicity: "unknown",
  expansion: "unknown",
  spread: "unknown",
  smoothness: "unknown",
  roundness: "unknown",
};

const interpretation = {
  outcome: "interpreted",
  sensoryExpression: "ゆっくり広がる感じ",
  semanticProfile: primaryProfile,
  experimentalProfile: { softness: "soft" },
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

const baseModelResponse = {
  sensoryInterpretation: interpretation,
  sensoryExpressions: [],
  candidateTermIds: [],
  reason: "観測された特徴を慎重に解釈しました",
};

function request(modality, input) {
  return JSON.stringify({ modality, input, allowedTermIds: ["kire", "atoaji"] });
}

describe("shadow AI sensory interpretation", () => {
  it("asks Bedrock for the Phase B contract using only compact features", () => {
    const input = buildConverseInput(
      {
        modality: "body",
        input: bodyInput,
        allowedTermIds: ["kire"],
        dictionaryContext: [{ id: "kire", displayTerm: "hidden", definitionSummary: "hidden" }],
      },
      env,
    );
    const message = JSON.parse(input.messages[0].content[0].text);
    expect(message).toEqual({ modality: "body", input: bodyInput });
    expect(input.system[0].text).toContain(
      "semantic outcome interpreted, ambiguous, or insufficient",
    );
    expect(input.system[0].text).toContain("holistically");
    expect(input.system[0].text).not.toContain("short + abrupt");
  });

  it("generates and returns valid shadow interpretations for Body and Voice while preserving grounding", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async (request_) => ({
        ...baseModelResponse,
        sensoryInterpretation: {
          ...interpretation,
          sensoryExpression:
            request_.modality === "body" ? "ゆっくり広がる感じ" : "静かに消えていく感じ",
        },
      })),
    });

    const bodyResponse = JSON.parse((await handler({ body: request("body", bodyInput) })).body);
    const voiceResponse = JSON.parse(
      (
        await handler({
          body: request("voice", {
            durationMs: 1200,
            averageIntensity: 0.4,
            pauseCount: 1,
            endingBehavior: "fading",
          }),
        })
      ).body,
    );

    expect(bodyResponse.sensoryInterpretation.outcome).toBe("interpreted");
    expect(voiceResponse.sensoryInterpretation.outcome).toBe("interpreted");
    expect(bodyResponse.candidateTermIds).toEqual([]);
    expect(voiceResponse.candidateTermIds).toEqual([]);
  });

  it("keeps legacy user output stable when the shadow interpretation changes", async () => {
    async function runShadowVariant(shadowExpression, legacyExpression, legacyReason) {
      const handler = createHandler({
        env,
        logger: { info: vi.fn(), error: vi.fn() },
        invoke: vi.fn(async () => ({
          ...baseModelResponse,
          sensoryInterpretation: {
            ...interpretation,
            sensoryExpression: shadowExpression,
          },
          sensoryExpressions: [legacyExpression],
          reason: legacyReason,
        })),
      });
      return JSON.parse((await handler({ body: request("body", bodyInput) })).body);
    }

    const first = await runShadowVariant("ゆっくり広がる感じ", "AI表現A", "AI理由A");
    const second = await runShadowVariant("急に収束する感じ", "AI表現B", "AI理由B");

    expect(first.sensoryInterpretation.sensoryExpression).not.toBe(
      second.sensoryInterpretation.sensoryExpression,
    );
    expect(first.sensoryExpressions).not.toEqual(second.sensoryExpressions);
    expect(first.sensoryExpressions).toEqual([first.sensoryInterpretation.sensoryExpression]);
    expect(second.sensoryExpressions).toEqual([second.sensoryInterpretation.sensoryExpression]);
    expect(first.reason).not.toBe(second.reason);
    expect(first.candidateTermIds).toEqual(second.candidateTermIds);
    expect(first.candidateTermIds).toEqual([]);
  });

  it("logs only bounded interpretation diagnostics, never provider text or raw input", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async () => ({
        ...baseModelResponse,
        sensoryInterpretation: {
          ...interpretation,
          sensoryExpression: "秘密の表示文",
        },
      })),
    });

    await handler({ body: request("body", bodyInput), requestContext: { requestId: "req-123" } });
    const log = logger.info.mock.calls
      .map(([message]) => message)
      .find((message) => message.includes('"category":"shadow_interpretation"'));
    expect(log).toBeDefined();
    expect(log).toContain('"category":"shadow_interpretation"');
    expect(log).toContain('"requestId":"req-123"');
    expect(log).toContain('"semanticOutcome":"interpreted"');
    expect(log).toContain('"timeQuality":"unknown"');
    expect(log).toContain('"experimentalAxes":["softness"]');
    for (const forbidden of ["秘密の表示文", "raw provider", "duration", "allowedTermIds"]) {
      expect(log).not.toContain(forbidden);
    }
  });
});
