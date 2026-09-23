import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import supportCaseData from "./data/sensory-support-cases.v0.1.json";
import schema from "../../schemas/sensory-support-cases.schema.json";
import {
  evaluateBodySensorySupport,
  evaluateGestureSensorySupport,
  evaluateVoiceSensorySupport,
  findSensorySupportCaseErrors,
  getApprovedCandidateTermIdsForSupport,
  isRuntimeEligibleSupportCase,
  sensorySupportCases,
} from "./sensory-support-cases";
import type { SensoryBridgeInput, VoiceSensoryBridgeInput } from "./sensory-bridge";
import type { GestureFeatures } from "./gesture";

const bodyInput: SensoryBridgeInput = {
  duration: "lingering",
  ending: "continued",
  expansion: "unknown",
  direction: "unknown",
  repetition: "single",
  participation: "localized",
  spread: "compact",
  speed: "unknown",
};

const voiceInput: VoiceSensoryBridgeInput = {
  durationMs: 1200,
  averageIntensity: 0.4,
  pauseCount: 1,
  endingBehavior: "fading",
};

const gestureInput: GestureFeatures = {
  pointCount: 12,
  durationMs: 900,
  pathLength: 90,
  averageSpeed: 0.075,
  spread: 80,
  horizontalDirectionChanges: 0,
  endingSpeedRatio: 0.5,
  abruptEnding: false,
};
const slowInput: GestureFeatures = {
  ...gestureInput,
  durationMs: 1800,
  pathLength: 50,
  averageSpeed: 0.05,
};
const shortFastAbruptInput: GestureFeatures = {
  ...gestureInput,
  pointCount: 6,
  durationMs: 500,
  pathLength: 150,
  averageSpeed: 0.6,
  spread: 50,
  endingSpeedRatio: 1.3,
  abruptEnding: true,
};
const broadInput: GestureFeatures = {
  ...gestureInput,
  durationMs: 900,
  pathLength: 220,
  averageSpeed: 0.3,
  spread: 190,
  endingSpeedRatio: 0.8,
  abruptEnding: false,
};
const compactInput: GestureFeatures = {
  ...gestureInput,
  pointCount: 3,
  durationMs: 400,
  pathLength: 30,
  averageSpeed: 0.075,
  spread: 30,
  endingSpeedRatio: 0.5,
};
const repeatedTurnsInput: GestureFeatures = {
  ...gestureInput,
  pointCount: 10,
  horizontalDirectionChanges: 4,
};

describe("observable sensory support cases", () => {
  it("keeps the reviewed Body and Voice cases machine-readable", () => {
    expect(sensorySupportCases).toHaveLength(10);
    expect(sensorySupportCases.filter((case_) => case_.modality === "body")).toHaveLength(7);
    expect(sensorySupportCases.filter((case_) => case_.modality === "voice")).toHaveLength(3);
    expect(sensorySupportCases.every((case_) => case_.status === "experimental")).toBe(true);
    const validate = new Ajv({ allErrors: true }).compile(schema);
    expect(validate(supportCaseData), JSON.stringify(validate.errors)).toBe(true);
    expect(findSensorySupportCaseErrors(supportCaseData)).toEqual([]);
  });

  it("evaluates short abrupt through clean-fade and derives only its approved term", () => {
    const evaluation = evaluateBodySensorySupport({
      ...bodyInput,
      duration: "short",
      ending: "abrupt",
    });
    expect(evaluation).toMatchObject({
      matchedCaseIds: ["body-short-abrupt-clean-fade"],
      resultKind: "expression",
      expressionIds: ["clean-fade"],
    });
    expect(getApprovedCandidateTermIdsForSupport(evaluation)).toEqual(["kire"]);
  });

  it("does not promote candidate or unmapped expressions to term candidates", () => {
    const gradual = evaluateBodySensorySupport({
      ...bodyInput,
      duration: "lingering",
      ending: "gradual",
    });
    expect(gradual.expressionIds).toEqual(["soft-settle"]);
    expect(getApprovedCandidateTermIdsForSupport(gradual)).toEqual([]);

    const expanding = evaluateBodySensorySupport({ ...bodyInput, expansion: "expanding" });
    expect(expanding.expressionIds).toEqual(["spreading-outward"]);
    expect(getApprovedCandidateTermIdsForSupport(expanding)).toEqual([]);

    const lateral = evaluateBodySensorySupport({
      ...bodyInput,
      direction: "lateral",
      repetition: "repeated",
      participation: "broad",
      spread: "broad",
    });
    expect(lateral.expressionIds).toEqual(["wavering-continuous"]);
    expect(getApprovedCandidateTermIdsForSupport(lateral)).not.toContain("nojun");
  });

  it("treats unmapped support as neutral when one expression is supported", () => {
    const shortAbruptFast = evaluateBodySensorySupport({
      ...bodyInput,
      duration: "short",
      ending: "abrupt",
      speed: "sustained-fast",
    });
    expect(shortAbruptFast).toMatchObject({
      matchedCaseIds: ["body-short-abrupt-clean-fade", "body-sustained-fast-unmapped"],
      resultKind: "expression",
      expressionIds: ["clean-fade"],
    });
    expect(getApprovedCandidateTermIdsForSupport(shortAbruptFast)).toEqual(["kire"]);

    const expandingFast = evaluateBodySensorySupport({
      ...bodyInput,
      expansion: "expanding",
      speed: "sustained-fast",
    });
    expect(expandingFast).toMatchObject({
      resultKind: "expression",
      expressionIds: ["spreading-outward"],
    });
    expect(getApprovedCandidateTermIdsForSupport(expandingFast)).toEqual([]);
  });

  it("keeps sustained-fast unmapped and resolves conflicting Body support explicitly", () => {
    expect(evaluateBodySensorySupport({ ...bodyInput, speed: "sustained-fast" })).toMatchObject({
      resultKind: "unmapped",
      expressionIds: [],
    });
    expect(
      evaluateBodySensorySupport({
        ...bodyInput,
        duration: "short",
        ending: "abrupt",
        expansion: "expanding",
      }),
    ).toMatchObject({
      resultKind: "interpretation-state",
      interpretationStateId: "ambiguous-mixed",
      expressionIds: [],
    });
  });

  it("keeps different expression matches ambiguous instead of using array order", () => {
    const evaluation = evaluateBodySensorySupport({
      ...bodyInput,
      duration: "lingering",
      ending: "gradual",
      expansion: "expanding",
    });
    expect(evaluation).toMatchObject({
      resultKind: "interpretation-state",
      interpretationStateId: "ambiguous-mixed",
      expressionIds: [],
    });
  });

  it("excludes deferred and legacy cases from normal evaluation", () => {
    const cleanFade = sensorySupportCases.find(
      (case_) => case_.id === "body-short-abrupt-clean-fade",
    );
    expect(cleanFade).toBeDefined();

    for (const status of ["deferred", "legacy"] as const) {
      const case_ = { ...cleanFade!, status };
      expect(isRuntimeEligibleSupportCase(case_)).toBe(false);
      expect(
        evaluateBodySensorySupport({ ...bodyInput, duration: "short", ending: "abrupt" }, [case_]),
      ).toEqual({ matchedCaseIds: [], resultKind: "unmapped", expressionIds: [] });
    }
  });

  it("uses interpretation states for insufficient Body and Voice observations", () => {
    expect(evaluateBodySensorySupport({ ...bodyInput, duration: "unknown" })).toMatchObject({
      resultKind: "interpretation-state",
      interpretationStateId: "insufficient-expression",
    });
    expect(evaluateVoiceSensorySupport({ ...voiceInput, durationMs: 0 })).toMatchObject({
      resultKind: "interpretation-state",
      interpretationStateId: "insufficient-expression",
    });
  });

  it("keeps Voice support limited, experimental, and termless", () => {
    const fading = evaluateVoiceSensorySupport(voiceInput);
    expect(fading).toMatchObject({
      resultKind: "expression",
      expressionIds: ["soft-settle"],
    });
    expect(getApprovedCandidateTermIdsForSupport(fading)).toEqual([]);
    expect(
      evaluateVoiceSensorySupport({ ...voiceInput, endingBehavior: "maintained" }),
    ).toMatchObject({ resultKind: "unmapped", expressionIds: [] });
  });

  it("evaluates Gesture movement with deterministic multi-feature reviewed cases", () => {
    const smooth = evaluateGestureSensorySupport(gestureInput);
    expect(smooth).toMatchObject({
      matchedCaseIds: ["gesture-smooth-continuous-flow"],
      resultKind: "expression",
      expressionIds: ["smooth-flow"],
    });
    expect(getApprovedCandidateTermIdsForSupport(smooth)).toEqual(["nameraka"]);
    expect(evaluateGestureSensorySupport(slowInput)).toEqual(
      evaluateGestureSensorySupport({ ...slowInput }),
    );
    expect(evaluateGestureSensorySupport(shortFastAbruptInput)).toMatchObject({
      resultKind: "expression",
      expressionIds: ["clean-fade"],
    });
    expect(
      getApprovedCandidateTermIdsForSupport(evaluateGestureSensorySupport(shortFastAbruptInput)),
    ).toEqual(["kire"]);
    expect(evaluateGestureSensorySupport(shortFastAbruptInput)).not.toEqual(smooth);
    expect(evaluateGestureSensorySupport(broadInput)).toMatchObject({
      resultKind: "expression",
      expressionIds: ["rounded-enveloping"],
    });
    expect(evaluateGestureSensorySupport(broadInput).matchedCaseIds).not.toContain(
      "gesture-smooth-continuous-flow",
    );
    expect(evaluateGestureSensorySupport(compactInput).resultKind).toBe("unmapped");
    expect(evaluateGestureSensorySupport(repeatedTurnsInput).resultKind).toBe("unmapped");
  });

  it("rejects malformed patterns, system states as expressions, and duplicate cases", () => {
    const invalid = structuredClone(supportCaseData);
    invalid.cases[0].status = "pending";
    invalid.cases[0].featurePattern = { rawAudio: "forbidden" } as never;
    invalid.cases[1].expressionIds = ["ambiguous-mixed"];
    invalid.cases.push(invalid.cases[2]);
    expect(findSensorySupportCaseErrors(invalid)).toEqual(
      expect.arrayContaining([
        "Invalid body feature pattern rawAudio in body-short-abrupt-clean-fade",
        "Invalid support case status: body-short-abrupt-clean-fade",
        "Unknown support expression ambiguous-mixed in body-lingering-gradual-soft-settle",
        "Interpretation state cannot be a support expression: body-lingering-gradual-soft-settle",
        "Duplicate sensory support case ID: body-expanding-spreading-outward",
      ]),
    );
  });
});
