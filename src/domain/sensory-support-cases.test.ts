import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import supportCaseData from "./data/sensory-support-cases.v0.1.json";
import schema from "../../schemas/sensory-support-cases.schema.json";
import {
  evaluateBodySensorySupport,
  evaluateVoiceSensorySupport,
  findSensorySupportCaseErrors,
  getApprovedCandidateTermIdsForSupport,
  sensorySupportCases,
} from "./sensory-support-cases";
import type { SensoryBridgeInput, VoiceSensoryBridgeInput } from "./sensory-bridge";

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

  it("rejects malformed patterns, system states as expressions, and duplicate cases", () => {
    const invalid = structuredClone(supportCaseData);
    invalid.cases[0].featurePattern = { rawAudio: "forbidden" } as never;
    invalid.cases[1].expressionIds = ["ambiguous-mixed"];
    invalid.cases.push(invalid.cases[2]);
    expect(findSensorySupportCaseErrors(invalid)).toEqual(
      expect.arrayContaining([
        "Invalid body feature pattern rawAudio in body-short-abrupt-clean-fade",
        "Unknown support expression ambiguous-mixed in body-lingering-gradual-soft-settle",
        "Interpretation state cannot be a support expression: body-lingering-gradual-soft-settle",
        "Duplicate sensory support case ID: body-expanding-spreading-outward",
      ]),
    );
  });
});
