import { describe, expect, it } from "vitest";
import {
  evaluateMvpHumanExperienceCase,
  mvpHumanExperienceCases,
} from "./mvp-human-experience-cases";

describe("MVP Human Experience representative cases", () => {
  it("keeps stable unique cases across the required Body and Voice families", () => {
    expect(mvpHumanExperienceCases).toHaveLength(11);
    expect(new Set(mvpHumanExperienceCases.map((case_) => case_.id)).size).toBe(
      mvpHumanExperienceCases.length,
    );
    expect(mvpHumanExperienceCases.filter((case_) => case_.modality === "body")).toHaveLength(7);
    expect(mvpHumanExperienceCases.filter((case_) => case_.modality === "voice")).toHaveLength(3);
    expect(
      mvpHumanExperienceCases.filter((case_) => case_.modality === "expression-review"),
    ).toHaveLength(1);
  });

  it("preserves the fully mapped fixture route through explicit product evidence", () => {
    const case_ = mvpHumanExperienceCases.find(
      (candidate) => candidate.id === "body-short-abrupt-to-kire-product",
    )!;
    expect(evaluateMvpHumanExperienceCase(case_)).toMatchObject({
      expressionIds: ["clean-fade"],
      termIds: ["kire"],
      productIds: expect.arrayContaining(["kagatobi-ikazuchi-issen"]),
    });
  });

  it("preserves expression-only, term-without-product, unmapped, and interpretation-state outcomes", () => {
    const byId = new Map(mvpHumanExperienceCases.map((case_) => [case_.id, case_]));
    expect(
      evaluateMvpHumanExperienceCase(byId.get("body-lingering-gradual-expression-only")!),
    ).toMatchObject({
      expressionIds: ["soft-settle"],
      termIds: [],
      productIds: [],
    });
    expect(
      evaluateMvpHumanExperienceCase(
        byId.get("expression-rounded-enveloping-term-without-product")!,
      ),
    ).toMatchObject({ expressionIds: ["rounded-enveloping"], termIds: ["marui"], productIds: [] });
    expect(evaluateMvpHumanExperienceCase(byId.get("body-sustained-fast-unmapped")!)).toMatchObject(
      {
        expressionIds: [],
        termIds: [],
        productIds: [],
      },
    );
    expect(
      evaluateMvpHumanExperienceCase(byId.get("body-short-abrupt-expanding-ambiguous")!),
    ).toMatchObject({ interpretationStateId: "ambiguous-mixed", termIds: [], productIds: [] });
  });

  it("keeps broad repeated lateral movement and representative Voice paths out of unsupported term output", () => {
    const byId = new Map(mvpHumanExperienceCases.map((case_) => [case_.id, case_]));
    expect(
      evaluateMvpHumanExperienceCase(byId.get("body-lateral-repeated-broad-no-nojun")!),
    ).toMatchObject({ expressionIds: ["wavering-continuous"], termIds: [], productIds: [] });
    expect(
      evaluateMvpHumanExperienceCase(byId.get("voice-long-fading-expression-only")!),
    ).toMatchObject({ expressionIds: ["soft-settle"], termIds: [], productIds: [] });
    expect(
      evaluateMvpHumanExperienceCase(byId.get("voice-long-maintained-unmapped")!),
    ).toMatchObject({
      expressionIds: [],
      termIds: [],
      productIds: [],
    });
  });
});
