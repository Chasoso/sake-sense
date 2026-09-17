import { getApprovedCandidateTermIds } from "./sensory-expressions";
import {
  evaluateBodySensorySupport,
  evaluateVoiceSensorySupport,
  getApprovedCandidateTermIdsForSupport,
  getSensoryExpressionDisplayTextsForSupport,
} from "./sensory-support-cases";
import { findSakeProductMatches } from "./sake-product-matching";
import type { SensoryBridgeInput, VoiceSensoryBridgeInput } from "./sensory-bridge";

type CaseOutcome =
  | "fully-mapped"
  | "expression-only"
  | "term-without-product"
  | "unmapped"
  | "interpretation-state";

type BodyCase = {
  id: string;
  modality: "body";
  input: SensoryBridgeInput;
  expectedExpressionIds: string[];
  expectedTermIds: string[];
  expectedProductIds: string[];
  expectedInterpretationStateId?: string;
  outcome: CaseOutcome;
  expectedEvidenceState: string;
  reason: string;
  humanExperienceQuestions: string[];
};

type VoiceCase = Omit<BodyCase, "modality" | "input"> & {
  modality: "voice";
  input: VoiceSensoryBridgeInput;
};

type ExpressionReviewCase = Omit<BodyCase, "modality" | "input"> & {
  modality: "expression-review";
  expressionId: string;
  setup: string;
};

export type MvpHumanExperienceCase = BodyCase | VoiceCase | ExpressionReviewCase;

const bodyBase: SensoryBridgeInput = {
  duration: "lingering",
  ending: "continued",
  expansion: "unknown",
  direction: "unknown",
  repetition: "single",
  participation: "localized",
  spread: "compact",
  speed: "unknown",
};

const voiceBase: VoiceSensoryBridgeInput = {
  durationMs: 1200,
  averageIntensity: 0.4,
  pauseCount: 1,
  endingBehavior: "fading",
};

const reviewQuestions = [
  "観測の説明は実際に起きたことと合っているか。",
  "初心者向け感覚表現は自然に理解できるか。",
  "unmappedやtermなしが壊れた結果に見えないか。",
  "用語・商品が出る場合、実験的解釈と根拠が理解できるか。",
];

/** A deliberately small, human-reviewed set; it is not a new semantic dataset. */
export const mvpHumanExperienceCases: readonly MvpHumanExperienceCase[] = [
  {
    id: "body-short-abrupt-to-kire-product",
    modality: "body",
    input: { ...bodyBase, duration: "short", ending: "abrupt" },
    expectedExpressionIds: ["clean-fade"],
    expectedTermIds: ["kire"],
    expectedProductIds: ["kagatobi-ikazuchi-issen"],
    outcome: "fully-mapped",
    expectedEvidenceState: "explicit selectable product evidence",
    reason:
      "Approved clean-fade link and existing renderable kire product evidence exercise the full path.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "body-lingering-gradual-expression-only",
    modality: "body",
    input: { ...bodyBase, duration: "lingering", ending: "gradual" },
    expectedExpressionIds: ["soft-settle"],
    expectedTermIds: [],
    expectedProductIds: [],
    outcome: "expression-only",
    expectedEvidenceState: "candidate expression-term link is not a normal candidate",
    reason: "Candidate links must stop at the sensory expression.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "body-expanding-unmapped-expression",
    modality: "body",
    input: { ...bodyBase, expansion: "expanding" },
    expectedExpressionIds: ["spreading-outward"],
    expectedTermIds: [],
    expectedProductIds: [],
    outcome: "expression-only",
    expectedEvidenceState: "unmapped expression",
    reason: "Expansion is represented without inferring concentration, nojun, or a product.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "body-lateral-repeated-broad-no-nojun",
    modality: "body",
    input: {
      ...bodyBase,
      direction: "lateral",
      repetition: "repeated",
      participation: "broad",
      spread: "broad",
    },
    expectedExpressionIds: ["wavering-continuous"],
    expectedTermIds: [],
    expectedProductIds: [],
    outcome: "expression-only",
    expectedEvidenceState: "unmapped expression; no nojun shortcut",
    reason: "Guards the repeated broad/lateral regression boundary.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "body-sustained-fast-unmapped",
    modality: "body",
    input: { ...bodyBase, speed: "sustained-fast" },
    expectedExpressionIds: [],
    expectedTermIds: [],
    expectedProductIds: [],
    outcome: "unmapped",
    expectedEvidenceState: "no supported expression or term",
    reason: "Fast movement alone is insufficient and must not shortcut to kire or sanmi.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "body-short-abrupt-expanding-ambiguous",
    modality: "body",
    input: { ...bodyBase, duration: "short", ending: "abrupt", expansion: "expanding" },
    expectedExpressionIds: [],
    expectedTermIds: [],
    expectedProductIds: [],
    expectedInterpretationStateId: "ambiguous-mixed",
    outcome: "interpretation-state",
    expectedEvidenceState: "ambiguous interpretation state",
    reason: "Competing observations remain explicitly ambiguous rather than first-match resolved.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "body-insufficient-movement",
    modality: "body",
    input: { ...bodyBase, duration: "unknown" },
    expectedExpressionIds: [],
    expectedTermIds: [],
    expectedProductIds: [],
    expectedInterpretationStateId: "insufficient-expression",
    outcome: "interpretation-state",
    expectedEvidenceState: "insufficient observation",
    reason: "No meaningful movement must stop safely without an expression or term.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "voice-long-fading-expression-only",
    modality: "voice",
    input: voiceBase,
    expectedExpressionIds: ["soft-settle"],
    expectedTermIds: [],
    expectedProductIds: [],
    outcome: "expression-only",
    expectedEvidenceState: "candidate expression-term link is not a normal candidate",
    reason: "The current limited Voice support remains experimental and termless.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "voice-long-maintained-unmapped",
    modality: "voice",
    input: { ...voiceBase, endingBehavior: "maintained" },
    expectedExpressionIds: [],
    expectedTermIds: [],
    expectedProductIds: [],
    outcome: "unmapped",
    expectedEvidenceState: "no supported expression or term",
    reason: "Long duration alone does not establish a sensory expression.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "voice-insufficient-observation",
    modality: "voice",
    input: { ...voiceBase, durationMs: 0 },
    expectedExpressionIds: [],
    expectedTermIds: [],
    expectedProductIds: [],
    expectedInterpretationStateId: "insufficient-expression",
    outcome: "interpretation-state",
    expectedEvidenceState: "insufficient observation",
    reason: "An invalidly short observation does not generate expression, term, or product output.",
    humanExperienceQuestions: reviewQuestions,
  },
  {
    id: "expression-rounded-enveloping-term-without-product",
    modality: "expression-review",
    expressionId: "rounded-enveloping",
    setup:
      "Review the existing expression directly; this does not claim a Body/Voice feature support rule.",
    expectedExpressionIds: ["rounded-enveloping"],
    expectedTermIds: ["marui"],
    expectedProductIds: [],
    outcome: "term-without-product",
    expectedEvidenceState: "approved term link; no currently renderable product evidence",
    reason: "Shows that a valid approved term can correctly stop without a current product result.",
    humanExperienceQuestions: reviewQuestions,
  },
];

export type MvpHumanExperienceEvaluation = {
  expressionIds: string[];
  sensoryExpressions: string[];
  termIds: string[];
  productIds: string[];
  interpretationStateId?: string;
};

export function evaluateMvpHumanExperienceCase(
  case_: MvpHumanExperienceCase,
): MvpHumanExperienceEvaluation {
  if (case_.modality === "expression-review") {
    const termIds = getApprovedCandidateTermIds(case_.expressionId);
    return {
      expressionIds: [case_.expressionId],
      sensoryExpressions: [],
      termIds,
      productIds: findSakeProductMatches(termIds).map((match) => match.product.id),
    };
  }
  const support =
    case_.modality === "body"
      ? evaluateBodySensorySupport(case_.input)
      : evaluateVoiceSensorySupport(case_.input);
  const termIds = getApprovedCandidateTermIdsForSupport(support);
  return {
    expressionIds: support.expressionIds,
    sensoryExpressions: getSensoryExpressionDisplayTextsForSupport(support),
    termIds,
    productIds: findSakeProductMatches(termIds).map((match) => match.product.id),
    ...(support.interpretationStateId
      ? { interpretationStateId: support.interpretationStateId }
      : {}),
  };
}
