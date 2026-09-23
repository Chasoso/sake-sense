import { describe, expect, it, vi } from "vitest";
import {
  BEDROCK_MAX_TOKENS,
  buildConverseInput,
  invokeBedrock,
  summarizeConverseRequest,
  summarizeConverseResponse,
} from "./bedrock.mjs";
import { BEDROCK_PROVIDER_TIMEOUT_MS } from "./diagnostics.mjs";
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

const gestureInput = {
  durationMs: 1200,
  pointCount: 12,
  pathLength: 18.25,
  averageSpeed: 0.015,
  spread: 4.5,
  horizontalDirectionChanges: 2,
  endingSpeedRatio: 0.4,
  abruptEnding: false,
};

const gestureRequest = JSON.stringify({
  modality: "gesture",
  input: gestureInput,
  allowedTermIds: ["kire", "nameraka"],
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
  it("keeps the provider deadline below the 30-second Lambda budget", () => {
    expect(BEDROCK_PROVIDER_TIMEOUT_MS).toBe(25_000);
    expect(BEDROCK_PROVIDER_TIMEOUT_MS).toBeLessThan(30_000);
  });

  it("accepts body, voice, and gesture structured payloads", async () => {
    const invoke = vi.fn(async () => emptyResponse);
    const handler = testHandler(invoke);
    expect((await handler({ body: bodyRequest })).statusCode).toBe(200);
    expect((await handler({ body: voiceRequest })).statusCode).toBe(200);
    expect((await handler({ body: gestureRequest })).statusCode).toBe(200);
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("keeps Gesture requests compact and reports gesture diagnostics safely", async () => {
    const invoke = vi.fn(async () => emptyResponse);
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({ env, invoke, logger });
    const response = await handler({
      body: gestureRequest,
      requestContext: { requestId: "gesture-request" },
    });

    expect(response.statusCode).toBe(200);
    const request = invoke.mock.calls[0][0];
    expect(request).toMatchObject({
      modality: "gesture",
      input: gestureInput,
      allowedTermIds: ["kire", "nameraka"],
    });
    expect(JSON.stringify(request)).not.toContain('"x":');
    expect(JSON.stringify(request)).not.toContain('"y":');
    expect(JSON.stringify(request)).not.toContain('"t":');
    const evaluation = logger.info.mock.calls
      .map(([message]) => JSON.parse(message))
      .find((entry) => entry.category === "semantic_evaluation");
    expect(evaluation).toMatchObject({
      category: "semantic_evaluation",
      eventRequestId: "gesture-request",
      modality: "gesture",
      inputSummary: {
        durationMsBucket: "medium",
        pointCountBucket: "medium",
        pathLengthBucket: "large",
        abruptEnding: false,
      },
    });
  });

  it("emits ordered lifecycle events before and after the provider call", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const invoke = vi.fn(async () => {
      const categories = logger.info.mock.calls.map(([message]) => JSON.parse(message).category);
      expect(categories).toEqual([
        "semantic_bridge_request_received",
        "semantic_bridge_request_validated",
        "bedrock_request_prepared",
        "bedrock_invoke_started",
      ]);
      return emptyResponse;
    });
    const handler = createHandler({ env, invoke, logger });

    const response = await handler({
      body: bodyRequest,
      requestContext: { requestId: "event-lifecycle" },
    });

    expect(response.statusCode).toBe(200);
    expect(logger.info.mock.calls.map(([message]) => JSON.parse(message).category)).toEqual([
      "semantic_bridge_request_received",
      "semantic_bridge_request_validated",
      "bedrock_request_prepared",
      "bedrock_invoke_started",
      "bedrock_invoke_succeeded",
      "provider_validation_started",
      "provider_validation_succeeded",
      "grounding_completed",
      "semantic_evaluation",
      "shadow_interpretation",
      "semantic_bridge_response_completed",
    ]);
    const lifecycleLog = JSON.parse(logger.info.mock.calls[2][0]);
    expect(lifecycleLog).toMatchObject({
      category: "bedrock_request_prepared",
      eventRequestId: "event-lifecycle",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
      requestSummary: {
        messageCount: 1,
        contentBlockTypes: ["text"],
        textFormatType: "json_schema",
      },
    });
    const evaluationLog = JSON.parse(
      logger.info.mock.calls.find(
        ([message]) => JSON.parse(message).category === "semantic_evaluation",
      )[0],
    );
    expect(evaluationLog.inputSummary.duration).toBe("short");
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
    expect(BEDROCK_MAX_TOKENS).toBe(1024);
    expect(input.inferenceConfig).toEqual({ maxTokens: BEDROCK_MAX_TOKENS, temperature: 0.2 });
    expect(input.outputConfig.textFormat.type).toBe("json_schema");
    expect(input.system[0].text).toContain("not a taste measurement");
  });

  it("attaches only a structural request summary to Bedrock failures", async () => {
    const providerError = new Error("ValidationException");
    providerError.name = "ValidationException";
    providerError.$metadata = { httpStatusCode: 400, requestId: "request-structure" };
    class FakeConverseCommand {
      constructor(input) {
        this.input = input;
      }
    }
    const clientFactory = vi.fn(async () => ({
      client: {
        send: vi.fn(async () => {
          throw providerError;
        }),
      },
      ConverseCommand: FakeConverseCommand,
    }));

    await expect(
      invokeBedrock({ modality: "body", input: bodyInput }, env, clientFactory),
    ).rejects.toBe(providerError);
    expect(providerError.converseRequestSummary).toEqual({
      modelId: env.BEDROCK_MODEL_ID,
      hasSystem: true,
      messageCount: 1,
      contentBlockTypes: ["text"],
      hasInferenceConfig: true,
      hasOutputConfig: true,
      textFormatType: "json_schema",
      schemaTopLevelKeys: ["additionalProperties", "properties", "required", "type"],
    });
  });

  it("captures safe Converse response metadata when provider JSON is malformed", async () => {
    class FakeConverseCommand {
      constructor(input) {
        this.input = input;
      }
    }
    const clientFactory = vi.fn(async () => ({
      client: {
        send: vi.fn(async () => ({
          stopReason: "max_tokens",
          usage: { inputTokens: 321, outputTokens: 256, totalTokens: 577 },
          metrics: { latencyMs: 4205 },
          output: {
            message: {
              content: [
                { text: '{"sensoryInterpretation":' },
                { image: { format: "png", source: {} } },
              ],
            },
          },
        })),
      },
      ConverseCommand: FakeConverseCommand,
    }));

    await expect(
      invokeBedrock({ modality: "body", input: bodyInput }, env, clientFactory),
    ).rejects.toMatchObject({
      providerOutputKind: "string",
      providerResponseSummary: {
        kind: "object",
        stopReason: "max_tokens",
        inputTokens: 321,
        outputTokens: 256,
        totalTokens: 577,
        latencyMs: 4205,
        contentBlockCount: 2,
        textBlockCount: 1,
      },
    });
  });

  it("includes safe provider response metadata in the success lifecycle event", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const response = { ...emptyResponse };
    Object.defineProperty(response, "providerResponseSummary", {
      enumerable: false,
      value: {
        kind: "object",
        stopReason: "end_turn",
        inputTokens: 100,
        outputTokens: 80,
        totalTokens: 180,
        latencyMs: 900,
        contentBlockCount: 1,
        textBlockCount: 1,
      },
    });
    const handler = createHandler({ env, logger, invoke: vi.fn(async () => response) });

    expect((await handler({ body: bodyRequest })).statusCode).toBe(200);
    const successLog = logger.info.mock.calls
      .map(([message]) => JSON.parse(message))
      .find((entry) => entry.category === "bedrock_invoke_succeeded");
    expect(successLog).toMatchObject({
      providerResponseSummary: {
        stopReason: "end_turn",
        inputTokens: 100,
        outputTokens: 80,
        totalTokens: 180,
        latencyMs: 900,
        contentBlockCount: 1,
        textBlockCount: 1,
      },
    });
  });

  it("summarizes only whitelisted Converse response primitives", () => {
    expect(
      summarizeConverseResponse({
        stopReason: "max_tokens",
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3, secret: "DO_NOT_LOG" },
        metrics: { latencyMs: 4, nested: { secret: "DO_NOT_LOG" } },
        output: { message: { content: [{ text: "RAW_PROVIDER_TEXT" }, { toolUse: {} }] } },
        raw: "RAW_PROVIDER_JSON",
      }),
    ).toEqual({
      kind: "object",
      contentBlockCount: 2,
      textBlockCount: 1,
      stopReason: "max_tokens",
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      latencyMs: 4,
    });
  });

  it("aborts a stuck Bedrock call before the Lambda hard timeout", async () => {
    const providerError = new Error("The operation was aborted");
    providerError.name = "AbortError";
    class FakeConverseCommand {
      constructor(input) {
        this.input = input;
      }
    }
    const clientFactory = vi.fn(async () => ({
      client: {
        send: vi.fn(
          (_command, { abortSignal }) =>
            new Promise((_, reject) => {
              const abort = () => reject(providerError);
              if (abortSignal.aborted) abort();
              else abortSignal.addEventListener("abort", abort, { once: true });
            }),
        ),
      },
      ConverseCommand: FakeConverseCommand,
    }));

    let caught;
    try {
      await invokeBedrock({ modality: "body", input: bodyInput }, env, clientFactory, {
        providerTimeoutMs: 10,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(providerError);
    expect(caught.failureKind).toBe("timeout");
    expect(caught.providerTimeoutMs).toBe(10);
    expect(caught.converseRequestSummary).toMatchObject({
      messageCount: 1,
      textFormatType: "json_schema",
    });
  });

  it("logs a sanitized timeout failure and keeps the safe 502 response", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const timeoutError = new Error("The operation was aborted");
    timeoutError.name = "AbortError";
    timeoutError.failureKind = "timeout";
    timeoutError.providerTimeoutMs = 25_000;
    timeoutError.$metadata = { requestId: "request-timeout", httpStatusCode: 504 };
    timeoutError.converseRequestSummary = {
      modelId: env.BEDROCK_MODEL_ID,
      hasSystem: true,
      messageCount: 1,
      contentBlockTypes: ["text"],
      hasInferenceConfig: true,
      hasOutputConfig: true,
      textFormatType: "json_schema",
      schemaTopLevelKeys: ["properties", "type"],
    };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async () => {
        throw timeoutError;
      }),
    });

    const response = await handler({
      body: bodyRequest,
      requestContext: { requestId: "event-timeout" },
    });

    expect(response.statusCode).toBe(502);
    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log).toMatchObject({
      category: "provider_failure",
      failureKind: "timeout",
      providerTimeoutMs: 25_000,
      eventRequestId: "event-timeout",
      requestId: "request-timeout",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
    });
    expect(typeof log.elapsedMs).toBe("number");
    expect(log.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(log)).not.toContain("bodyInput");
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
    expect(JSON.parse(logger.error.mock.calls[0][0])).toMatchObject({
      category: "provider_validation_failure",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
      validation: { code: "malformed_output", path: "$" },
      providerOutputSummary: { kind: "undefined" },
    });
  });

  it("carries provider response metadata into malformed-output diagnostics", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const error = new SemanticBridgeProviderValidationError("malformed model JSON", {
      providerOutputKind: "string",
    });
    error.providerResponseSummary = {
      kind: "object",
      stopReason: "max_tokens",
      inputTokens: 321,
      outputTokens: 256,
      totalTokens: 577,
      latencyMs: 4205,
      contentBlockCount: 1,
      textBlockCount: 1,
    };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async () => {
        throw error;
      }),
    });

    expect((await handler({ body: bodyRequest })).statusCode).toBe(502);
    expect(JSON.parse(logger.error.mock.calls[0][0])).toMatchObject({
      category: "provider_validation_failure",
      validation: { code: "malformed_output", path: "$" },
      providerResponseSummary: {
        stopReason: "max_tokens",
        inputTokens: 321,
        outputTokens: 256,
        latencyMs: 4205,
        contentBlockCount: 1,
        textBlockCount: 1,
      },
    });
  });

  it("logs structured validation diagnostics without provider text", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async () => ({
        sensoryInterpretation: {
          outcome: "interpreted",
          sensoryExpression: "理由",
          semanticProfile: { timeQuality: "sustained" },
        },
        sensoryExpressions: ["理由"],
        candidateTermIds: [],
        reason: "理由",
        extraPayload: "DO_NOT_LOG_PROVIDER_VALUE",
      })),
    });

    const response = await handler({
      body: bodyRequest,
      requestContext: { requestId: "req-95" },
    });
    expect(response.statusCode).toBe(502);
    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log).toMatchObject({
      category: "provider_validation_failure",
      requestId: "req-95",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
      validation: {
        code: "unexpected_key",
        path: "$.extraPayload",
      },
      providerOutputSummary: {
        kind: "object",
        topLevelKeys: [
          "candidateTermIds",
          "extraPayload",
          "reason",
          "sensoryExpressions",
          "sensoryInterpretation",
        ],
        outcome: "interpreted",
        semanticProfileKeys: ["timeQuality"],
        sensoryExpressionPresent: true,
      },
    });
    expect(logger.error.mock.calls[0][0]).not.toContain("SENSORY_TEXT_SHOULD_NOT_APPEAR");
    expect(logger.error.mock.calls[0][0]).not.toContain("DO_NOT_LOG_PROVIDER_VALUE");
  });

  it("classifies enum, key, type, and malformed provider failures", async () => {
    const cases = [
      {
        response: {
          sensoryExpressions: [],
          candidateTermIds: [],
          reason: "理由",
          sensoryInterpretation: { outcome: "invalid" },
        },
        code: "invalid_enum",
        path: "sensoryInterpretation.outcome",
      },
      {
        response: {
          sensoryExpressions: [],
          candidateTermIds: [],
          reason: "理由",
          sensoryInterpretation: { outcome: "interpreted", unexpected: true },
        },
        code: "unexpected_key",
        path: "sensoryInterpretation.unexpected",
      },
      {
        response: {
          sensoryExpressions: [],
          candidateTermIds: [],
          reason: "理由",
          sensoryInterpretation: "bad",
        },
        code: "invalid_type",
        path: "sensoryInterpretation.outcome",
      },
      { response: ["bad"], code: "invalid_type", path: "$" },
    ];

    for (const case_ of cases) {
      const logger = { info: vi.fn(), error: vi.fn() };
      const handler = createHandler({
        env,
        logger,
        invoke: vi.fn(async () => case_.response),
      });
      expect((await handler({ body: bodyRequest })).statusCode).toBe(502);
      expect(JSON.parse(logger.error.mock.calls[0][0]).validation).toEqual({
        code: case_.code,
        path: case_.path,
      });
    }
  });

  it("does not log an invalid semantic profile value", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async () => ({
        sensoryExpressions: ["理由"],
        candidateTermIds: [],
        reason: "理由",
        sensoryInterpretation: {
          outcome: "interpreted",
          sensoryExpression: "理由",
          semanticProfile: {
            timeQuality: "SENSORY_PROFILE_VALUE_SHOULD_NOT_APPEAR",
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
          },
        },
      })),
    });

    expect((await handler({ body: bodyRequest })).statusCode).toBe(502);
    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log.validation).toEqual({
      code: "invalid_enum",
      path: "sensoryInterpretation.semanticProfile.timeQuality",
    });
    expect(log.providerOutputSummary.semanticProfileKeys).toContain("timeQuality");
    expect(log.providerOutputSummary).not.toHaveProperty("semanticProfileValues");
    expect(logger.error.mock.calls[0][0]).not.toContain("SENSORY_PROFILE_VALUE_SHOULD_NOT_APPEAR");
  });

  it("summarizes voice input without logging raw numeric detail or text", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const handler = createHandler({
      env,
      logger,
      invoke: vi.fn(async () => ({
        sensoryExpressions: [],
        candidateTermIds: [],
        reason: "理由",
        sensoryInterpretation: null,
      })),
    });
    await handler({
      body: voiceRequest,
      requestContext: { requestId: "voice-95" },
    });
    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log.inputSummary).toEqual({
      durationMsBucket: "medium",
      intensityBucket: "medium",
      pauseCount: 1,
      endingBehavior: "fading",
    });
    expect(logger.error.mock.calls[0][0]).not.toContain("SENSORY_TEXT_SHOULD_NOT_APPEAR");
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
    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log).toMatchObject({
      category: "provider_failure",
      errorName: "Error",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
    });
    expect(log.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(logger.error.mock.calls[0][0]).not.toContain("secret provider detail");
    expect(logger.error.mock.calls[0][0]).not.toContain("stack");
  });

  it("logs sanitized AWS provider diagnostics without exposing payloads", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const awsError = new Error(`Invalid schema\nkeyword\tfoo ${"x".repeat(700)}`);
    awsError.name = "ValidationException";
    awsError.$fault = "client";
    awsError.$metadata = {
      httpStatusCode: 400,
      requestId: "request-123",
      retryable: false,
    };
    const requestShape = buildConverseInput(
      { modality: "body", input: { ...bodyInput }, allowedTermIds: [] },
      env,
    );
    requestShape.system = [{ text: "SYSTEM_PROMPT_SHOULD_NOT_APPEAR" }];
    requestShape.messages = [{ role: "user", content: [{ text: "USER_TEXT_SHOULD_NOT_APPEAR" }] }];
    requestShape.outputConfig.textFormat.structure.jsonSchema.schema = JSON.stringify({
      type: "object",
      enum: ["SCHEMA_ENUM_SHOULD_NOT_APPEAR"],
    });
    awsError.converseRequestSummary = summarizeConverseRequest(requestShape);
    const handler = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw awsError;
      }),
      logger,
    });
    const response = await handler({
      body: bodyRequest,
      requestContext: { requestId: "correlation-123" },
    });
    expect(response.statusCode).toBe(502);
    expect(response.body).toBe('{"error":"semantic bridge unavailable"}');
    const log = logger.error.mock.calls[0][0];
    const parsedLog = JSON.parse(log);
    expect(parsedLog).toMatchObject({
      category: "provider_failure",
      errorName: "ValidationException",
      httpStatusCode: 400,
      requestId: "request-123",
      eventRequestId: "correlation-123",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
      fault: "client",
      retryable: false,
      requestSummary: {
        modelId: env.BEDROCK_MODEL_ID,
        hasSystem: true,
        messageCount: 1,
        contentBlockTypes: ["text"],
        hasInferenceConfig: true,
        hasOutputConfig: true,
        textFormatType: "json_schema",
        schemaTopLevelKeys: ["enum", "type"],
      },
    });
    expect(parsedLog.errorMessage).not.toContain("\n");
    expect(parsedLog.errorMessage.length).toBeLessThanOrEqual(600);
    expect(log).not.toContain("SYSTEM_PROMPT_SHOULD_NOT_APPEAR");
    expect(log).not.toContain("USER_TEXT_SHOULD_NOT_APPEAR");
    expect(log).not.toContain("SCHEMA_ENUM_SHOULD_NOT_APPEAR");
  });

  it("logs AWS SDK v3 $retryable metadata safely", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const awsError = new Error("Throttled by provider");
    awsError.name = "ThrottlingException";
    awsError.$fault = "server";
    awsError.$retryable = { throttling: true, hidden: { secret: "DO_NOT_LOG" } };
    awsError.$metadata = { httpStatusCode: 429, requestId: "request-retryable" };
    const handler = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw awsError;
      }),
      logger,
    });

    await handler({ body: bodyRequest, requestContext: { requestId: "event-retryable" } });

    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log).toMatchObject({
      category: "provider_failure",
      requestId: "request-retryable",
      eventRequestId: "event-retryable",
      retryable: true,
      throttling: true,
    });
    expect(log).not.toHaveProperty("awsRequestId");
    expect(JSON.stringify(log)).not.toContain("DO_NOT_LOG");
  });

  it("omits secret-like provider messages", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const awsError = new Error("Bearer SUPER_SECRET_TOKEN password=DO_NOT_LOG");
    awsError.name = "ValidationException";
    awsError.$metadata = { httpStatusCode: 400, requestId: "request-secret" };
    const handler = createHandler({
      env,
      invoke: vi.fn(async () => {
        throw awsError;
      }),
      logger,
    });
    await handler({ body: bodyRequest });
    const log = logger.error.mock.calls[0][0];
    expect(log).not.toContain("SUPER_SECRET_TOKEN");
    expect(log).not.toContain("DO_NOT_LOG");
    expect(log).not.toContain("errorMessage");
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
    const log = JSON.parse(logger.error.mock.calls[0][0]);
    expect(log).toMatchObject({
      category: "provider_failure",
      errorName: "UnknownError",
      modality: "body",
      model: env.BEDROCK_MODEL_ID,
    });
    expect(log.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(logger.error.mock.calls[0][0]).not.toContain("secret provider detail");
  });
});
