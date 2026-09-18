import { describe, expect, it, vi } from "vitest";
import { buildConverseInput } from "./bedrock.mjs";
import { createHandler } from "./handler.mjs";
import { SemanticBridgeProviderValidationError } from "./validation.mjs";

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
  reason: "観測だけでは候補を無理なく絞り込めませんでした。",
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
    const invoke = vi.fn();
    const handler = testHandler(invoke);
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
    expect(invoke).not.toHaveBeenCalled();
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
        sourceCategory: "aftertaste",
        parentTermId: "atoaji",
      });
      expect(typeof request.dictionaryContext[0].displayTerm).toBe("string");
      expect(typeof request.dictionaryContext[0].definitionSummary).toBe("string");
      return emptyResponse;
    });
    const handler = testHandler(invoke);
    const request = JSON.parse(bodyRequest);
    request.allowedTermIds = ["kire"];
    const response = await handler({ body: JSON.stringify(request) });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      candidateTermIds: ["kire"],
      observedFeatures: [
        "duration:short",
        "ending:abrupt",
        "expansion:unknown",
        "direction:unknown",
        "repetition:single",
        "participation:localized",
        "spread:compact",
        "speed:unknown",
      ],
      interpretationEvidence: ["duration:short", "ending:abrupt"],
      unmappedFeatures: [],
      groundingCaseIds: ["body-short-abrupt-clean-fade"],
      groundingExpressionIds: ["clean-fade"],
      interpretationStateId: null,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("returns cautious Japanese output for a grounded short abrupt case", async () => {
    const handler = testHandler(
      vi.fn(async () => ({
        sensoryExpressions: ["すっと切れるような印象"],
        candidateTermIds: ["kire"],
        reason: "短い動きと急な終わりが観測されたため、切れのよさへ実験的につないでいます。",
      })),
    );
    const response = await handler({ body: bodyRequest });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ candidateTermIds: ["kire"] });
    expect(JSON.parse(response.body).interpretationEvidence).toEqual([
      "duration:short",
      "ending:abrupt",
    ]);
  });

  it("keeps voice unmapped features deterministic", async () => {
    const handler = testHandler(vi.fn(async () => emptyResponse));
    const response = await handler({ body: voiceRequest });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      candidateTermIds: [],
      interpretationEvidence: ['durationMs:{"minimum":701}', "endingBehavior:fading"],
      unmappedFeatures: [],
      groundingCaseIds: ["voice-long-fading-soft-settle"],
      groundingExpressionIds: ["soft-settle"],
    });
  });

  it("derives normal candidates only through approved support and expression links", async () => {
    const handler = testHandler(
      vi.fn(async () => ({
        sensoryExpressions: ["モデルの表現"],
        candidateTermIds: ["atoaji"],
        reason: "モデルが候補を返しました。",
      })),
    );
    const response = await handler({ body: bodyRequest });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      candidateTermIds: ["kire"],
      groundingExpressionIds: ["clean-fade"],
    });
  });

  it("does not let unsupported, candidate, ambiguous, or insufficient cases promote model terms", async () => {
    const handler = testHandler(
      vi.fn(async () => ({
        sensoryExpressions: ["モデルの表現"],
        candidateTermIds: ["atoaji"],
        reason: "モデルが候補を返しました。",
      })),
    );
    const requests = [
      {
        input: {
          ...bodyInput,
          duration: "lingering",
          ending: "continued",
          direction: "lateral",
          repetition: "repeated",
          participation: "broad",
          spread: "broad",
        },
        state: null,
      },
      { input: { ...bodyInput, duration: "lingering", ending: "gradual" }, state: null },
      {
        input: { ...bodyInput, duration: "lingering", ending: "continued", expansion: "expanding" },
        state: null,
      },
      { input: { ...bodyInput, expansion: "expanding" }, state: "ambiguous-mixed" },
      {
        input: { ...bodyInput, duration: "unknown", ending: "unknown" },
        state: "insufficient-expression",
      },
    ];
    for (const case_ of requests) {
      const request = JSON.stringify({
        modality: "body",
        input: case_.input,
        allowedTermIds: ["kire", "atoaji"],
      });
      const result = JSON.parse((await handler({ body: request })).body);
      expect(result.candidateTermIds).toEqual([]);
      if (case_.state) expect(result.interpretationStateId).toBe(case_.state);
    }
  });

  it("keeps unmapped support neutral while reporting only its actual feature evidence", async () => {
    const handler = testHandler(vi.fn(async () => emptyResponse));
    const request = JSON.stringify({
      modality: "body",
      input: { ...bodyInput, speed: "sustained-fast" },
      allowedTermIds: ["kire", "atoaji"],
    });
    const result = JSON.parse((await handler({ body: request })).body);
    expect(result).toMatchObject({
      candidateTermIds: ["kire"],
      interpretationEvidence: ["duration:short", "ending:abrupt"],
      unmappedFeatures: ["speed:sustained-fast"],
    });
    expect(result.unmappedFeatures).not.toContain("direction:unknown");
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

  it("logs request validation failures separately", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      invoke: vi.fn(),
      logger,
    });
    const response = await handler({ body: JSON.stringify({ modality: "unknown" }) });
    expect(response.statusCode).toBe(400);
    expect(logger.error).toHaveBeenCalledWith(
      JSON.stringify({ category: "request_validation_failure" }),
    );
  });

  it("maps every invalid model response to HTTP 502", async () => {
    const invalidResponses = [
      "not-json",
      {},
      {
        sensoryExpressions: [],
        candidateTermIds: [],
        reason: "ok",
        extra: true,
      },
      {
        sensoryExpressions: [],
        candidateTermIds: ["kire", "kire"],
        reason: "invalid",
      },
      {
        sensoryExpressions: [],
        candidateTermIds: ["unknown"],
        reason: "invalid",
      },
      {
        sensoryExpressions: [],
        candidateTermIds: ["nojun"],
        reason: "invalid",
      },
      {
        sensoryExpressions: ["short duration"],
        candidateTermIds: [],
        reason: "The input has short duration.",
      },
    ];
    for (const modelResponse of invalidResponses) {
      const invalid = testHandler(vi.fn(async () => modelResponse));
      const response = await invalid({ body: bodyRequest });
      expect(response.statusCode).toBe(502);
      expect(response.body).toBe('{"error":"semantic bridge unavailable"}');
    }
  });

  it("maps empty provider output to HTTP 502 and logs provider validation", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw new SemanticBridgeProviderValidationError("empty model response");
      }),
      logger,
    });
    const response = await handler({ body: bodyRequest });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("empty model response");
    expect(logger.error).toHaveBeenCalledWith(
      JSON.stringify({ category: "provider_validation_failure" }),
    );
  });

  it("classifies provider invocation failures separately and sanitizes details", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };

    const failing = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw new Error("secret provider detail");
      }),
      logger,
    });
    const response = await failing({ body: bodyRequest });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain("secret provider detail");
    expect(logger.error).toHaveBeenCalledWith(
      JSON.stringify({ category: "provider_failure", errorName: "Error" }),
    );
    expect(logger.error.mock.calls[0][0]).not.toContain("secret provider detail");
    expect(logger.error.mock.calls[0][0]).not.toContain("stack");
  });

  it("logs safe AWS SDK provider metadata without exposing the error", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const awsError = new Error("secret provider detail");
    awsError.name = "ValidationException";
    awsError.$metadata = { httpStatusCode: 400, requestId: "request-123" };
    const handler = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw awsError;
      }),
      logger,
    });
    const response = await handler({ body: bodyRequest });
    expect(response.statusCode).toBe(502);
    expect(response.body).toBe('{"error":"semantic bridge unavailable"}');
    expect(logger.error).toHaveBeenCalledWith(
      JSON.stringify({
        category: "provider_failure",
        errorName: "ValidationException",
        httpStatusCode: 400,
        requestId: "request-123",
      }),
    );
    expect(logger.error.mock.calls[0][0]).not.toContain("secret provider detail");
  });

  it("uses a safe name for unknown thrown values", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw "secret provider detail";
      }),
      logger,
    });
    const response = await handler({ body: bodyRequest });
    expect(response.statusCode).toBe(502);
    expect(logger.error).toHaveBeenCalledWith(
      JSON.stringify({ category: "provider_failure", errorName: "UnknownError" }),
    );
    expect(logger.error.mock.calls[0][0]).not.toContain("secret provider detail");
  });
});
