import supportCaseData from "./data/sensory-support-cases.v0.1.json";
import {
  getApprovedCandidateTermIds,
  getSensoryExpression,
  sensoryExpressions,
  sensoryInterpretationStates,
} from "./sensory-expressions";
import type { GestureFeatures } from "./gesture";
import type { SensoryBridgeInput, VoiceSensoryBridgeInput } from "./sensory-bridge";

export type SensorySupportCaseStatus = "active" | "experimental" | "deferred" | "legacy";
export type SensorySupportCaseResultKind = "expression" | "unmapped" | "interpretation-state";

type NumericRange = { minimum?: number; maximum?: number };
type BodyFeaturePattern = Partial<SensoryBridgeInput>;
type VoiceFeaturePattern = Partial<Omit<VoiceSensoryBridgeInput, "durationMs">> & {
  durationMs?: NumericRange;
};
type GestureFeaturePattern = Partial<
  Record<keyof GestureFeatures, boolean | number | NumericRange>
>;

type GestureSupportCase = {
  id: string;
  resultKind: SensorySupportCaseResultKind;
  featurePattern: GestureFeaturePattern;
  expressionIds: string[];
};

type EvaluableSupportCase = {
  id: string;
  resultKind: SensorySupportCaseResultKind;
  featurePattern: Record<string, unknown>;
  expressionIds: string[];
  interpretationStateId?: string;
};

export type SensorySupportCase = {
  id: string;
  modality: "body" | "voice";
  status: SensorySupportCaseStatus;
  resultKind: SensorySupportCaseResultKind;
  featurePattern: BodyFeaturePattern | VoiceFeaturePattern;
  expressionIds: string[];
  interpretationStateId?: string;
  rationale: string;
  notes: string;
};

type SensorySupportCaseDataset = {
  version: string;
  status: string;
  cases: SensorySupportCase[];
};

type SensorySupportCaseValidationDataset = {
  cases: Array<{
    id: string;
    modality: string;
    status: string;
    resultKind: string;
    featurePattern: Record<string, unknown>;
    expressionIds: string[];
    interpretationStateId?: string;
    rationale: string;
    notes: string;
  }>;
};

export type SensorySupportEvaluation = {
  matchedCaseIds: string[];
  resultKind: SensorySupportCaseResultKind;
  expressionIds: string[];
  interpretationStateId?: string;
};

export const sensorySupportCaseDataset = supportCaseData as SensorySupportCaseDataset;
export const sensorySupportCases = sensorySupportCaseDataset.cases;

/**
 * Small, reviewed Gesture movement cases. These describe movement qualities,
 * never symbolic shapes or the user's drawing intent.
 */
export const gestureSensorySupportCases: readonly GestureSupportCase[] = [
  // These calibrated combinations deliberately separate speed, duration, spread,
  // and ending observations; no single feature is sufficient for a match.
  {
    id: "gesture-short-fast-abrupt-clean-fade",
    resultKind: "expression",
    featurePattern: {
      durationMs: { maximum: 700 },
      averageSpeed: { minimum: 0.4 },
      spread: { maximum: 260 },
      endingSpeedRatio: { minimum: 1.0 },
      abruptEnding: true,
    },
    expressionIds: ["clean-fade"],
  },
  {
    id: "gesture-slow-long-lingering-after-feel",
    resultKind: "expression",
    featurePattern: {
      durationMs: { minimum: 1_200 },
      averageSpeed: { maximum: 0.1 },
      spread: { maximum: 180 },
      horizontalDirectionChanges: { maximum: 1 },
    },
    expressionIds: ["lingering-after-feel"],
  },
  {
    id: "gesture-broad-spreading-rounded-enveloping",
    resultKind: "expression",
    featurePattern: {
      durationMs: { minimum: 700, maximum: 1_300 },
      pathLength: { minimum: 120 },
      spread: { minimum: 120 },
      averageSpeed: { minimum: 0.2 },
      horizontalDirectionChanges: { maximum: 2 },
      abruptEnding: true,
    },
    expressionIds: ["rounded-enveloping"],
  },
  {
    id: "gesture-repeated-direction-changes-wavering",
    resultKind: "unmapped",
    featurePattern: {
      pointCount: { minimum: 5 },
      horizontalDirectionChanges: { minimum: 3 },
    },
    expressionIds: [],
  },
  {
    id: "gesture-smooth-continuous-flow",
    resultKind: "expression",
    featurePattern: {
      durationMs: { minimum: 700, maximum: 1_400 },
      pathLength: { minimum: 80 },
      averageSpeed: { minimum: 0.02, maximum: 0.2 },
      spread: { minimum: 165 },
      horizontalDirectionChanges: { maximum: 1 },
    },
    expressionIds: ["smooth-flow"],
  },
  {
    id: "gesture-compact-insufficient",
    resultKind: "unmapped",
    featurePattern: {
      pointCount: { maximum: 4 },
      pathLength: { maximum: 40 },
      spread: { maximum: 60 },
    },
    expressionIds: [],
  },
];

const supportCaseStatuses = new Set<string>(["active", "experimental", "deferred", "legacy"]);
const resultKinds = new Set<string>(["expression", "unmapped", "interpretation-state"]);
const bodyFeatureValues: Record<keyof SensoryBridgeInput, ReadonlySet<string>> = {
  duration: new Set(["short", "lingering", "unknown"]),
  ending: new Set(["abrupt", "gradual", "continued", "unknown"]),
  expansion: new Set(["expanding", "contracting", "unknown"]),
  direction: new Set(["upward", "downward", "lateral", "unknown"]),
  repetition: new Set(["single", "repeated", "unknown"]),
  participation: new Set(["localized", "broad", "unknown"]),
  spread: new Set(["compact", "broad", "unknown"]),
  speed: new Set(["sustained-fast", "unknown"]),
};
const voiceFeatureValues = {
  endingBehavior: new Set(["maintained", "fading", "unknown"]),
};

function isNumericRange(value: unknown): value is NumericRange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const range = value as Record<string, unknown>;
  return (
    Object.keys(range).every((key) => key === "minimum" || key === "maximum") &&
    (range.minimum === undefined || (typeof range.minimum === "number" && range.minimum >= 0)) &&
    (range.maximum === undefined || (typeof range.maximum === "number" && range.maximum >= 0)) &&
    !(
      typeof range.minimum === "number" &&
      typeof range.maximum === "number" &&
      range.minimum > range.maximum
    )
  );
}

function matchesBodyPattern(input: SensoryBridgeInput, pattern: BodyFeaturePattern): boolean {
  return Object.entries(pattern).every(
    ([key, value]) => input[key as keyof SensoryBridgeInput] === value,
  );
}

function matchesVoicePattern(
  input: VoiceSensoryBridgeInput,
  pattern: VoiceFeaturePattern,
): boolean {
  return Object.entries(pattern).every(([key, value]) => {
    if (key === "durationMs") {
      const range = value as NumericRange;
      return (
        (range.minimum === undefined || input.durationMs >= range.minimum) &&
        (range.maximum === undefined || input.durationMs <= range.maximum)
      );
    }
    return input[key as keyof Omit<VoiceSensoryBridgeInput, "durationMs">] === value;
  });
}

function matchesGesturePattern(input: GestureFeatures, pattern: GestureFeaturePattern): boolean {
  return Object.entries(pattern).every(([key, expected]) => {
    const actual = input[key as keyof GestureFeatures];
    if (typeof expected === "object" && expected !== null) {
      const range = expected as NumericRange;
      return (
        typeof actual === "number" &&
        (range.minimum === undefined || actual >= range.minimum) &&
        (range.maximum === undefined || actual <= range.maximum)
      );
    }
    return actual === expected;
  });
}

function patternSpecificity(case_: EvaluableSupportCase): number {
  return Object.keys(case_.featurePattern).length;
}

/** Only reviewed runtime cases participate in the normal fixture evaluation. */
export function isRuntimeEligibleSupportCase(case_: SensorySupportCase): boolean {
  return case_.status === "active" || case_.status === "experimental";
}

function evaluateMatchedCases(matches: EvaluableSupportCase[]): SensorySupportEvaluation {
  if (!matches.length) return { matchedCaseIds: [], resultKind: "unmapped", expressionIds: [] };

  const highestStateSpecificity = Math.max(
    -1,
    ...matches
      .filter((case_) => case_.resultKind === "interpretation-state")
      .map(patternSpecificity),
  );
  if (highestStateSpecificity >= 0) {
    const states = matches.filter(
      (case_) =>
        case_.resultKind === "interpretation-state" &&
        patternSpecificity(case_) === highestStateSpecificity,
    );
    const stateIds = [
      ...new Set(states.map((case_) => case_.interpretationStateId).filter(Boolean)),
    ];
    if (stateIds.length === 1) {
      return {
        matchedCaseIds: states.map((case_) => case_.id),
        resultKind: "interpretation-state",
        expressionIds: [],
        interpretationStateId: stateIds[0],
      };
    }
  }

  const expressionIds = [...new Set(matches.flatMap((case_) => case_.expressionIds))];
  // An unmapped case says only that its own observations are insufficient. It is
  // neutral evidence, rather than a veto on an expression supported elsewhere.
  if (expressionIds.length === 1) {
    return {
      matchedCaseIds: matches.map((case_) => case_.id),
      resultKind: "expression",
      expressionIds,
    };
  }
  if (!expressionIds.length) {
    return {
      matchedCaseIds: matches.map((case_) => case_.id),
      resultKind: "unmapped",
      expressionIds: [],
    };
  }
  return {
    matchedCaseIds: matches.map((case_) => case_.id),
    resultKind: "interpretation-state",
    expressionIds: [],
    interpretationStateId: "ambiguous-mixed",
  };
}

export function evaluateBodySensorySupport(
  input: SensoryBridgeInput,
  cases: readonly SensorySupportCase[] = sensorySupportCases,
): SensorySupportEvaluation {
  return evaluateMatchedCases(
    cases.filter(
      (case_): case_ is SensorySupportCase & { modality: "body" } =>
        isRuntimeEligibleSupportCase(case_) &&
        case_.modality === "body" &&
        matchesBodyPattern(input, case_.featurePattern as BodyFeaturePattern),
    ),
  );
}

export function evaluateVoiceSensorySupport(
  input: VoiceSensoryBridgeInput,
  cases: readonly SensorySupportCase[] = sensorySupportCases,
): SensorySupportEvaluation {
  return evaluateMatchedCases(
    cases.filter(
      (case_): case_ is SensorySupportCase & { modality: "voice" } =>
        isRuntimeEligibleSupportCase(case_) &&
        case_.modality === "voice" &&
        matchesVoicePattern(input, case_.featurePattern as VoiceFeaturePattern),
    ),
  );
}

export function evaluateGestureSensorySupport(
  input: GestureFeatures,
  cases: readonly GestureSupportCase[] = gestureSensorySupportCases,
): SensorySupportEvaluation {
  return evaluateMatchedCases(
    cases
      .filter((case_) => case_.resultKind === "expression" || case_.resultKind === "unmapped")
      .filter((case_) => matchesGesturePattern(input, case_.featurePattern)),
  );
}

export function getApprovedCandidateTermIdsForSupport(
  evaluation: SensorySupportEvaluation,
): string[] {
  if (evaluation.resultKind !== "expression") return [];
  return [...new Set(evaluation.expressionIds.flatMap(getApprovedCandidateTermIds))];
}

export function getSensoryExpressionDisplayTextsForSupport(
  evaluation: SensorySupportEvaluation,
): string[] {
  return evaluation.expressionIds.flatMap((id) => {
    const displayText = getSensoryExpression(id)?.displayText;
    return displayText ? [displayText] : [];
  });
}

export function findSensorySupportCaseErrors(
  dataset: SensorySupportCaseValidationDataset,
  expressions: readonly { id: string }[] = sensoryExpressions,
  interpretationStates: readonly { id: string }[] = sensoryInterpretationStates,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const patternKeys = new Set<string>();
  const expressionIds = new Set(expressions.map((expression) => expression.id));
  const stateIds = new Set<string>(interpretationStates.map((state) => state.id));

  for (const case_ of dataset.cases) {
    if (ids.has(case_.id)) errors.push(`Duplicate sensory support case ID: ${case_.id}`);
    ids.add(case_.id);
    if (!supportCaseStatuses.has(case_.status))
      errors.push(`Invalid support case status: ${case_.id}`);
    if (!resultKinds.has(case_.resultKind)) errors.push(`Invalid support result kind: ${case_.id}`);
    const patternKey = `${case_.modality}:${JSON.stringify(case_.featurePattern)}`;
    if (patternKeys.has(patternKey)) errors.push(`Duplicate support pattern: ${case_.id}`);
    patternKeys.add(patternKey);

    for (const expressionId of case_.expressionIds) {
      if (!expressionIds.has(expressionId)) {
        errors.push(`Unknown support expression ${expressionId} in ${case_.id}`);
      }
      if (stateIds.has(expressionId)) {
        errors.push(`Interpretation state cannot be a support expression: ${case_.id}`);
      }
    }
    if (case_.resultKind === "expression" && !case_.expressionIds.length) {
      errors.push(`Expression result requires an expression ID: ${case_.id}`);
    }
    if (case_.resultKind !== "expression" && case_.expressionIds.length) {
      errors.push(`Non-expression result cannot have expression IDs: ${case_.id}`);
    }
    if (case_.resultKind === "interpretation-state") {
      if (!case_.interpretationStateId || !stateIds.has(case_.interpretationStateId)) {
        errors.push(`Unknown interpretation state in ${case_.id}`);
      }
    } else if (case_.interpretationStateId) {
      errors.push(`Only interpretation-state can have an interpretation state: ${case_.id}`);
    }

    const pattern = case_.featurePattern as Record<string, unknown>;
    if (case_.modality === "body") {
      for (const [key, value] of Object.entries(pattern)) {
        const allowed = bodyFeatureValues[key as keyof SensoryBridgeInput];
        if (!allowed || typeof value !== "string" || !allowed.has(value)) {
          errors.push(`Invalid body feature pattern ${key} in ${case_.id}`);
        }
      }
    } else if (case_.modality === "voice") {
      for (const [key, value] of Object.entries(pattern)) {
        if (key === "durationMs") {
          if (!isNumericRange(value)) errors.push(`Invalid voice duration pattern in ${case_.id}`);
        } else {
          const isValidNumericFeature =
            key === "averageIntensity"
              ? typeof value === "number" && value >= 0 && value <= 1
              : key === "pauseCount"
                ? typeof value === "number" && Number.isInteger(value) && value >= 0
                : false;
          const allowed = voiceFeatureValues[key as keyof typeof voiceFeatureValues];
          if (
            !isValidNumericFeature &&
            (!allowed || typeof value !== "string" || !allowed.has(value))
          ) {
            errors.push(`Invalid voice feature pattern ${key} in ${case_.id}`);
          }
        }
      }
    } else {
      errors.push(`Invalid support modality: ${case_.id}`);
    }
  }
  return errors;
}
