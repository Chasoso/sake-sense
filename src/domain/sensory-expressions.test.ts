import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import expressionData from "./data/sensory-expressions.v0.1.json";
import interpretationStateData from "./data/sensory-interpretation-states.v0.1.json";
import schema from "../../schemas/sensory-expressions.schema.json";
import {
  findSensoryExpressionErrors,
  getApprovedCandidateTermIds,
  getSensoryExpression,
  getSensoryInterpretationState,
  sensoryExpressions,
  sensoryInterpretationStates,
} from "./sensory-expressions";

describe("MVP sensory expression dataset", () => {
  it("has the reviewed active and experimental candidate pool", () => {
    expect(
      sensoryExpressions.filter((expression) => expression.expressionStatus === "active"),
    ).toHaveLength(9);
    expect(
      sensoryExpressions.filter((expression) => expression.expressionStatus === "experimental"),
    ).toHaveLength(6);
    expect(sensoryExpressions.map((expression) => expression.id)).toEqual([
      "lingering-after-feel",
      "clean-fade",
      "smooth-flow",
      "rounded-enveloping",
      "soft-settle",
      "wavering-continuous",
      "spreading-outward",
      "pulsing-strength",
      "wave-like",
      "quick-change",
      "compact-stop",
      "continuous-gentle",
      "sliding-smooth",
      "rounded-soft",
      "slowly-fading",
    ]);
  });

  it("keeps term-link status independent from expression status", () => {
    expect(getSensoryExpression("soft-settle")).toMatchObject({
      expressionStatus: "active",
      termLinkStatus: "candidate",
      candidateTermIds: ["atoaji"],
    });
    expect(getApprovedCandidateTermIds("lingering-after-feel")).toEqual(["atoaji"]);
    expect(getApprovedCandidateTermIds("soft-settle")).toEqual([]);
    expect(getApprovedCandidateTermIds("slowly-fading")).toEqual([]);
    expect(getApprovedCandidateTermIds("wavering-continuous")).toEqual([]);
  });

  it("keeps approved links selectable and leaves the reviewed expressions intentionally unmapped", () => {
    expect(
      sensoryExpressions
        .filter((expression) => expression.termLinkStatus === "approved")
        .map((expression) => [expression.id, expression.candidateTermIds]),
    ).toEqual([
      ["lingering-after-feel", ["atoaji"]],
      ["clean-fade", ["kire"]],
      ["smooth-flow", ["nameraka"]],
      ["rounded-enveloping", ["marui"]],
    ]);
    expect(
      sensoryExpressions
        .filter((expression) => expression.termLinkStatus === "unmapped")
        .map((expression) => expression.id),
    ).toEqual(["wavering-continuous", "spreading-outward", "pulsing-strength", "wave-like"]);
    expect(sensoryExpressions.flatMap((expression) => expression.candidateTermIds)).not.toEqual(
      expect.arrayContaining(["sanmi", "umami", "amami", "tanrei", "nojun"]),
    );
  });

  it("validates records and keeps interpretation states outside the expression dataset", () => {
    const validate = new Ajv({ allErrors: true }).compile(schema);
    expect(validate(expressionData), JSON.stringify(validate.errors)).toBe(true);
    expect(findSensoryExpressionErrors(expressionData)).toEqual([]);
    expect(sensoryInterpretationStates).toHaveLength(2);
    expect(interpretationStateData.states.map((state) => state.id)).toEqual([
      "ambiguous-mixed",
      "insufficient-expression",
    ]);
    expect(getSensoryExpression("ambiguous-mixed")).toBeUndefined();
    expect(getSensoryInterpretationState("ambiguous-mixed")?.displayText).toContain("ひとつの言葉");
  });

  it("rejects invalid statuses, non-selectable links, and invalid unmapped records", () => {
    const invalid = structuredClone(expressionData);
    invalid.expressions[0].expressionStatus = "mapped";
    invalid.expressions[0].termLinkStatus = "pending";
    invalid.expressions[1].candidateTermIds = ["sanmi"];
    invalid.expressions[5].candidateTermIds = ["atoaji"];
    expect(findSensoryExpressionErrors(invalid)).toEqual(
      expect.arrayContaining([
        "Invalid expression status: lingering-after-feel",
        "Invalid term link status: lingering-after-feel",
        "Non-selectable candidate term sanmi in clean-fade",
        "Unmapped expression cannot have candidate terms: wavering-continuous",
      ]),
    );
  });
});
