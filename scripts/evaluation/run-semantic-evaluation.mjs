import fs from "node:fs/promises";
import path from "node:path";
import dictionaryData from "../../src/domain/data/sensory-dictionary.v0.1.json" with { type: "json" };
import fixtureData from "../../backend/semantic-bridge/eval/body-voice-evaluation.v0.1.json" with { type: "json" };
import { applyReviewedGrounding } from "../../backend/semantic-bridge/src/grounding.mjs";
import { invokeBedrock } from "../../backend/semantic-bridge/src/bedrock.mjs";
import { countRenderableProductMatches } from "../../backend/semantic-bridge/src/product-match-count.mjs";
import {
  parseAndValidateRequest,
  validateModelResponse,
} from "../../backend/semantic-bridge/src/validation.mjs";
import {
  buildEvaluatorPrompt,
  evaluatorDimensions,
  normalizeEvaluatorResult,
  parseEvaluatorResponse,
  summarizeEvaluatorResults,
} from "./semantic-evaluator.mjs";

const repositoryRoot = process.cwd();
const offlineBaselinePath = path.join(
  repositoryRoot,
  "docs/evaluation/semantic-offline-baseline.json",
);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function selectableTermIds() {
  return dictionaryData.entries
    .filter((entry) => entry.vocabularyStatus === "selectable")
    .map((entry) => entry.id);
}

export function validateEvaluationFixtures(fixtures = fixtureData.fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length < 20 || fixtures.length > 50) {
    throw new Error("semantic evaluation fixture count must be between 20 and 50");
  }
  const ids = new Set();
  const allowedTermIds = selectableTermIds();
  for (const fixture of fixtures) {
    if (!isRecord(fixture)) throw new Error("semantic evaluation fixture must be an object");
    const keys = Object.keys(fixture).sort().join(",");
    if (keys !== "id,input,intent,modality,reviewPriority") {
      throw new Error(`unexpected fixture fields: ${fixture.id ?? "<missing>"}`);
    }
    if (typeof fixture.id !== "string" || !fixture.id || ids.has(fixture.id)) {
      throw new Error(`invalid or duplicate fixture id: ${fixture.id ?? "<missing>"}`);
    }
    ids.add(fixture.id);
    if (!["body", "voice"].includes(fixture.modality)) {
      throw new Error(`invalid fixture modality: ${fixture.id}`);
    }
    if (typeof fixture.intent !== "string" || !fixture.intent) {
      throw new Error(`missing fixture intent: ${fixture.id}`);
    }
    if (!["control", "representative"].includes(fixture.reviewPriority)) {
      throw new Error(`invalid fixture review priority: ${fixture.id}`);
    }
    parseAndValidateRequest(
      JSON.stringify({ modality: fixture.modality, input: fixture.input, allowedTermIds }),
    );
  }
  return { count: fixtures.length, allowedTermIds };
}

function outcomeFor(result) {
  if (result.interpretationStateId === "ambiguous-mixed") return "ambiguous";
  if (result.interpretationStateId) return "insufficient";
  return result.groundingExpressionIds?.length ? "interpreted" : "insufficient";
}

function resultCategory(outcome, termIds, productMatchCount) {
  if (outcome === "ambiguous") return "ambiguous";
  if (outcome === "insufficient") return "insufficient";
  if (productMatchCount > 0) return "product-match";
  if (termIds.length > 0) return "term-no-product";
  return "unmapped";
}

function fallbackReason(result, termIds) {
  if (result.interpretationStateId) return result.interpretationStateId;
  if (!termIds.length) return "no-reviewed-term-path";
  return null;
}

function semanticOutcomeFor(entry) {
  return entry.semanticInterpretationOutcome ?? null;
}

function hasSeparatedOutcomeSchema(report) {
  return (report?.cases ?? []).every(
    (entry) =>
      Object.prototype.hasOwnProperty.call(entry, "semanticInterpretationOutcome") &&
      Object.prototype.hasOwnProperty.call(entry, "groundingOutcome"),
  );
}

function changedCaseReasons(current, previous) {
  const reasons = [];
  if (semanticOutcomeFor(current) !== semanticOutcomeFor(previous)) {
    reasons.push("semantic-outcome");
  }
  if (current.groundingOutcome !== previous.groundingOutcome) reasons.push("grounding-outcome");
  if (JSON.stringify(current.semanticProfile) !== JSON.stringify(previous.semanticProfile)) {
    reasons.push("semantic-profile");
  }
  if (JSON.stringify(current.authorizedTermIds) !== JSON.stringify(previous.authorizedTermIds)) {
    reasons.push("authorized-terms");
  }
  if (current.productMatchCount !== previous.productMatchCount) reasons.push("product-reach");
  return reasons;
}

export function compareEvaluationReports(current, baseline) {
  const baselineAvailable = Boolean(baseline);
  const baselineCompatible =
    !baseline ||
    ((!current.baselineKind ||
      !baseline.baselineKind ||
      current.baselineKind === baseline.baselineKind) &&
      hasSeparatedOutcomeSchema(current) &&
      hasSeparatedOutcomeSchema(baseline));
  const contractFailures = (current.cases ?? [])
    .filter((entry) => entry.deterministicContract?.status === "failed")
    .map((entry) => entry.fixtureId);
  if (!baselineCompatible) {
    return {
      baselineAvailable,
      baselineCompatible: false,
      changedCases: [],
      contractFailures,
      reason:
        current.baselineKind !== baseline?.baselineKind
          ? "baseline-kind-mismatch"
          : "baseline-schema-mismatch",
    };
  }
  const previousById = new Map((baseline?.cases ?? []).map((entry) => [entry.fixtureId, entry]));
  const changedCases = [];
  for (const entry of current.cases ?? []) {
    if (entry.deterministicContract?.status === "failed") {
      continue;
    }
    const previous = previousById.get(entry.fixtureId);
    if (!previous) {
      changedCases.push({ fixtureId: entry.fixtureId, reasons: ["new-fixture"] });
      continue;
    }
    const reasons = changedCaseReasons(entry, previous);
    if (reasons.length) changedCases.push({ fixtureId: entry.fixtureId, reasons });
  }
  return {
    baselineAvailable,
    baselineCompatible: true,
    changedCases,
    contractFailures,
  };
}

export function integrateComparisonReviewQueue(report, comparison) {
  const changedById = new Map(
    (comparison.changedCases ?? []).map((change) => [change.fixtureId, change.reasons]),
  );
  const cases = report.cases.map((entry) => {
    const baselineReasons = (changedById.get(entry.fixtureId) ?? []).map(
      (reason) => `baseline-${reason}-changed`,
    );
    return {
      ...entry,
      humanReviewReasons: [...new Set([...entry.humanReviewReasons, ...baselineReasons])],
    };
  });
  return {
    ...report,
    cases,
    summary: {
      ...report.summary,
      baselineChangedCaseCount: comparison.changedCases?.length ?? 0,
      humanReviewQueueCount: cases.filter((entry) => entry.humanReviewReasons.length > 0).length,
    },
    comparison,
  };
}

function reviewReasons(fixture, entry) {
  const reasons = fixture.reviewPriority === "control" ? ["stable-control"] : [];
  if (entry.deterministicContract.status === "failed") reasons.push("contract-failure");
  if (entry.evaluator?.status === "malformed") reasons.push("evaluator-malformed");
  for (const dimension of evaluatorDimensions) {
    if (["review", "fail"].includes(entry.evaluator?.dimensions?.[dimension]?.status)) {
      reasons.push(`evaluator-${entry.evaluator.dimensions[dimension].status}`);
    }
  }
  return [...new Set(reasons)];
}

function evaluatorCaseStatus(entry) {
  const statuses = Object.values(entry.evaluator?.dimensions ?? {}).map(
    (dimension) => dimension.status,
  );
  return {
    hasFail: statuses.includes("fail"),
    hasReview: statuses.includes("review"),
  };
}

function contractFailureCounts(cases) {
  const counts = {};
  for (const entry of cases) {
    if (entry.deterministicContract.status !== "failed") continue;
    const key = `${entry.deterministicContract.failureKind}:${entry.deterministicContract.code}:${entry.deterministicContract.path}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sanitizeConverseRequestSummary(summary) {
  if (!isRecord(summary)) return undefined;
  const safe = {};
  for (const key of [
    "modelId",
    "hasSystem",
    "messageCount",
    "contentBlockTypes",
    "hasInferenceConfig",
    "hasOutputConfig",
    "textFormatType",
    "schemaTopLevelKeys",
  ]) {
    if (summary[key] !== undefined) safe[key] = summary[key];
  }
  return Object.keys(safe).length ? safe : undefined;
}

function providerRequestFailure(error) {
  return Boolean(
    error?.converseRequestSummary ||
      error?.$metadata ||
      error?.name === "ValidationException" ||
      error?.name === "ThrottlingException",
  );
}

export function classifyTermAuthorization(result, authorizedTermIds, allowedIdSet) {
  const semanticAuthorizedTermIds = Array.isArray(result.authorization)
    ? result.authorization
        .map((authorization) => authorization.termId)
        .filter((id) => allowedIdSet.has(id))
    : [];
  const legacyGroundingTermIds = result.sensoryInterpretation ? [] : authorizedTermIds;
  return {
    semanticAuthorizedTermIds,
    legacyGroundingTermIds,
    termAuthorizationSource: semanticAuthorizedTermIds.length
      ? "semantic-authorization"
      : legacyGroundingTermIds.length
        ? "reviewed-support-grounding"
        : "none",
  };
}

export function summarizeReachMetrics(cases) {
  return {
    authorizedTermReachCount: cases.filter((entry) => entry.authorizedTermIds.length > 0).length,
    productReachCount: cases.filter((entry) => entry.productMatchCount > 0).length,
    interpretedAuthorizedTermReachCount: cases.filter(
      (entry) =>
        entry.semanticInterpretationOutcome === "interpreted" && entry.authorizedTermIds.length > 0,
    ).length,
    interpretedProductReachCount: cases.filter(
      (entry) =>
        entry.semanticInterpretationOutcome === "interpreted" && entry.productMatchCount > 0,
    ).length,
    ambiguousWithAuthorizedTermsCount: cases.filter(
      (entry) =>
        entry.semanticInterpretationOutcome === "ambiguous" && entry.authorizedTermIds.length > 0,
    ).length,
    insufficientWithAuthorizedTermsCount: cases.filter(
      (entry) =>
        entry.semanticInterpretationOutcome === "insufficient" &&
        entry.authorizedTermIds.length > 0,
    ).length,
  };
}

export async function runSemanticEvaluation({
  fixtures = fixtureData.fixtures,
  provider,
  judge,
  mode = "offline-deterministic-grounding",
} = {}) {
  const { allowedTermIds } = validateEvaluationFixtures(fixtures);
  const allowedIdSet = new Set(allowedTermIds);
  const cases = [];
  for (const fixture of fixtures) {
    const request = parseAndValidateRequest(
      JSON.stringify({ modality: fixture.modality, input: fixture.input, allowedTermIds }),
    ).value;
    let result;
    let contractFailure = null;
    try {
      if (provider) {
        const providerOutput = await provider(request, fixture);
        result = validateModelResponse(providerOutput, allowedIdSet, request);
      } else {
        result = applyReviewedGrounding(
          { sensoryExpressions: [], candidateTermIds: [], reason: "offline baseline" },
          request,
          allowedIdSet,
        );
      }
    } catch (error) {
      const isProviderFailure = providerRequestFailure(error);
      contractFailure = {
        failureKind: isProviderFailure ? "provider-request" : "semantic-contract",
        code: isProviderFailure
          ? "provider_request_failure"
          : (error?.code ?? "semantic_contract_failure"),
        path: error?.path ?? "$",
        reason: error instanceof Error ? error.message : "semantic contract failure",
        ...(typeof error?.name === "string" ? { providerErrorName: error.name } : {}),
        ...(Number.isInteger(error?.$metadata?.httpStatusCode)
          ? { httpStatusCode: error.$metadata.httpStatusCode }
          : {}),
        ...(typeof error?.providerOutputKind === "string"
          ? { providerOutputKind: error.providerOutputKind }
          : {}),
        ...(sanitizeConverseRequestSummary(error?.converseRequestSummary)
          ? { converseRequestSummary: sanitizeConverseRequestSummary(error.converseRequestSummary) }
          : {}),
      };
      result = {
        sensoryExpressions: [],
        candidateTermIds: [],
        groundingCaseIds: [],
        groundingExpressionIds: [],
        interpretationStateId: null,
      };
    }

    const authorizedTermIds = Array.isArray(result.candidateTermIds)
      ? result.candidateTermIds.filter((id) => allowedIdSet.has(id))
      : [];
    const { semanticAuthorizedTermIds, legacyGroundingTermIds, termAuthorizationSource } =
      classifyTermAuthorization(result, authorizedTermIds, allowedIdSet);
    const productMatchCount = countRenderableProductMatches(authorizedTermIds);
    const semanticInterpretationOutcome = result.sensoryInterpretation?.outcome ?? null;
    const groundingOutcome = outcomeFor(result);
    const interpretationOutcome = semanticInterpretationOutcome;
    const entry = {
      fixtureId: fixture.id,
      modality: fixture.modality,
      intent: fixture.intent,
      observableInput: fixture.input,
      semanticInterpretationOutcome,
      groundingOutcome,
      // Deprecated compatibility alias: this is now the semantic outcome only.
      interpretationOutcome,
      semanticWording: result.sensoryInterpretation?.sensoryExpression ?? null,
      presentationWording: Array.isArray(result.sensoryExpressions)
        ? result.sensoryExpressions
        : [],
      // Deprecated compatibility alias: wording now means semantic wording.
      wording: result.sensoryInterpretation?.sensoryExpression ?? null,
      semanticProfile: result.sensoryInterpretation?.semanticProfile ?? null,
      authorizedTermIds,
      semanticAuthorizedTermIds,
      legacyGroundingTermIds,
      termAuthorizationSource,
      nonInterpretedTermReach:
        semanticInterpretationOutcome !== null &&
        semanticInterpretationOutcome !== "interpreted" &&
        authorizedTermIds.length > 0,
      productMatchCount,
      resultCategory: resultCategory(
        semanticInterpretationOutcome ?? groundingOutcome,
        authorizedTermIds,
        productMatchCount,
      ),
      fallbackReason: fallbackReason(result, authorizedTermIds),
      deterministicContract: {
        status: contractFailure ? "failed" : "passed",
        groundingCaseIds: result.groundingCaseIds ?? [],
        groundingExpressionIds: result.groundingExpressionIds ?? [],
        ...(contractFailure ? contractFailure : {}),
      },
      evaluator: contractFailure
        ? { status: "skipped", reason: "contract-failure" }
        : { status: "not-run" },
    };
    if (judge && !contractFailure) {
      entry.evaluator = normalizeEvaluatorResult(await judge({ ...fixture, ...entry }));
    }
    entry.humanReviewReasons = reviewReasons(fixture, entry);
    cases.push(entry);
  }

  const evaluatorResults = cases.filter((entry) =>
    ["completed", "malformed"].includes(entry.evaluator.status),
  );
  const summary = {
    totalFixtureCount: cases.length,
    semanticInterpretedCount: cases.filter(
      (entry) => entry.semanticInterpretationOutcome === "interpreted",
    ).length,
    semanticInsufficientCount: cases.filter(
      (entry) => entry.semanticInterpretationOutcome === "insufficient",
    ).length,
    semanticAmbiguousCount: cases.filter(
      (entry) => entry.semanticInterpretationOutcome === "ambiguous",
    ).length,
    groundingInterpretedCount: cases.filter((entry) => entry.groundingOutcome === "interpreted")
      .length,
    groundingInsufficientCount: cases.filter((entry) => entry.groundingOutcome === "insufficient")
      .length,
    groundingAmbiguousCount: cases.filter((entry) => entry.groundingOutcome === "ambiguous").length,
    ...summarizeReachMetrics(cases),
    deterministicContractFailureCount: cases.filter(
      (entry) => entry.deterministicContract.status === "failed",
    ).length,
    evaluator: evaluatorResults.length
      ? summarizeEvaluatorResults(evaluatorResults.map((entry) => entry.evaluator))
      : { status: "not-run", dimensions: null },
    contractFailureByCodePath: contractFailureCounts(cases),
    semanticAuthorizationReachCount: cases.filter(
      (entry) => entry.semanticAuthorizedTermIds.length > 0,
    ).length,
    reviewedGroundingFallbackReachCount: cases.filter(
      (entry) => entry.legacyGroundingTermIds.length > 0,
    ).length,
    nonInterpretedLegacyTermReachCount: cases.filter((entry) => entry.nonInterpretedTermReach)
      .length,
    evaluatorFailCaseCount: cases.filter((entry) => evaluatorCaseStatus(entry).hasFail).length,
    evaluatorReviewCaseCount: cases.filter((entry) => {
      const status = evaluatorCaseStatus(entry);
      return status.hasReview && !status.hasFail;
    }).length,
    evaluatorSkippedCaseCount: cases.filter((entry) => entry.evaluator.status === "skipped").length,
    humanReviewQueueCount: cases.filter((entry) => entry.humanReviewReasons.length > 0).length,
  };
  const humanReviewSummary = cases
    .filter((entry) => {
      const status = evaluatorCaseStatus(entry);
      return entry.deterministicContract.status === "failed" || status.hasFail || status.hasReview;
    })
    .map((entry) => ({
      fixtureId: entry.fixtureId,
      observableInput: entry.observableInput,
      semanticInterpretationOutcome: entry.semanticInterpretationOutcome,
      groundingOutcome: entry.groundingOutcome,
      interpretationOutcome: entry.interpretationOutcome,
      semanticWording: entry.semanticWording,
      presentationWording: entry.presentationWording,
      semanticProfile: entry.semanticProfile,
      evaluator: entry.evaluator,
      deterministicContract: entry.deterministicContract,
      termAuthorizationSource: entry.termAuthorizationSource,
      semanticAuthorizedTermIds: entry.semanticAuthorizedTermIds,
      legacyGroundingTermIds: entry.legacyGroundingTermIds,
    }));
  return {
    version: "0.1.0",
    baselineKind: mode,
    baselineNote:
      mode === "live-production-equivalent"
        ? "Observation from the production provider and validation path; not ground truth."
        : "Offline deterministic reviewed-grounding observation; not production-equivalent and not ground truth.",
    cases,
    summary,
    humanReviewSummary,
  };
}

async function createLiveJudge(env) {
  const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
  const client = new BedrockRuntimeClient({ region: env.AWS_REGION });
  return async (record) => {
    const response = await client.send(
      new ConverseCommand({
        modelId: env.BEDROCK_EVALUATOR_MODEL_ID ?? env.BEDROCK_MODEL_ID,
        messages: [{ role: "user", content: [{ text: buildEvaluatorPrompt(record) }] }],
        inferenceConfig: { maxTokens: 700, temperature: 0 },
      }),
    );
    const text = response.output?.message?.content?.find(
      (item) => typeof item.text === "string",
    )?.text;
    if (!text) throw new Error("live evaluator returned no text");
    return parseEvaluatorResponse(text);
  };
}

export async function main() {
  const live = process.argv.includes("--live");
  const outputIndex = process.argv.indexOf("--output");
  const outputPath =
    outputIndex >= 0
      ? path.resolve(process.cwd(), process.argv[outputIndex + 1])
      : offlineBaselinePath;
  const baselineIndex = process.argv.indexOf("--baseline");
  const baseline =
    baselineIndex >= 0
      ? await fs
          .readFile(path.resolve(process.cwd(), process.argv[baselineIndex + 1]), "utf8")
          .then(JSON.parse)
          .catch(() => null)
      : null;
  const provider = live ? (request) => invokeBedrock(request, process.env) : undefined;
  const judge = live ? await createLiveJudge(process.env) : undefined;
  const report = await runSemanticEvaluation({
    provider,
    judge,
    mode: live ? "live-production-equivalent" : "offline-deterministic-grounding",
  });
  const comparison = baseline
    ? compareEvaluationReports(report, baseline)
    : {
        baselineAvailable: false,
        baselineCompatible: false,
        changedCases: [],
        contractFailures: report.cases
          .filter((entry) => entry.deterministicContract.status === "failed")
          .map((entry) => entry.fixtureId),
      };
  const reportWithQueue = integrateComparisonReviewQueue(report, comparison);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(reportWithQueue, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(reportWithQueue.summary, null, 2));
  console.log(`Semantic evaluation report written to ${path.relative(process.cwd(), outputPath)}`);
}
