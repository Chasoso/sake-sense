import { describe, expect, it } from "vitest";
import {
  authorizeSensoryTerms,
  evaluateSemanticRoute,
  resolveAuthorizationConflicts,
  validateSensoryClassProposals,
} from "./semantic-authorization.mjs";

const baseProfile = {
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

function profile(overrides = {}) {
  return { ...baseProfile, ...overrides };
}

function interpretation(overrides = {}) {
  return { outcome: "interpreted", semanticProfile: profile(overrides) };
}

const allTerms = ["atoaji", "kire", "nameraka", "marui", "tanrei", "nojun"];

describe("AI-first deterministic sensory authorization", () => {
  it.each([
    [
      "atoaji",
      "lingering-after-feel",
      { persistence: "lingering", timeQuality: "sustained", continuity: "continuous" },
    ],
    ["kire", "clean-fade", { persistence: "brief", timeQuality: "sudden", resolution: "abrupt" }],
    ["nameraka", "smooth-flow", { smoothness: "smooth", continuity: "continuous" }],
    ["marui", "rounded-enveloping", { roundness: "rounded", spread: "enclosing" }],
    [
      "tanrei",
      "light-delicate",
      { weightQuality: "light", persistence: "brief", expansion: "condensing" },
    ],
    [
      "nojun",
      "rich-full",
      { weightQuality: "strong", persistence: "lingering", expansion: "expansive" },
    ],
  ])("authorizes %s strongly from reviewed semantic evidence", (termId, sensoryClass, values) => {
    const result = authorizeSensoryTerms(interpretation(values), [], allTerms);
    expect(result.authorizedTermIds).toContain(termId);
    expect(result.authorization.find((entry) => entry.termId === termId)).toMatchObject({
      sensoryClass,
      level: "strong",
    });
  });

  it.each([
    ["atoaji", "lingering-after-feel", { persistence: "moderate", resolution: "gradual" }],
    ["kire", "clean-fade", { persistence: "brief" }],
    ["nameraka", "smooth-flow", { smoothness: "smooth", flowQuality: "free" }],
    ["marui", "rounded-enveloping", { roundness: "rounded", smoothness: "smooth" }],
    ["tanrei", "light-delicate", { weightQuality: "light", persistence: "moderate" }],
    ["nojun", "rich-full", { weightQuality: "strong", persistence: "moderate" }],
  ])("does not let proposals promote %s", (termId, sensoryClass, values) => {
    const withoutProposal = authorizeSensoryTerms(interpretation(values), [], allTerms);
    const withProposal = authorizeSensoryTerms(interpretation(values), [sensoryClass], allTerms);
    expect(withProposal).toEqual(withoutProposal);
    expect(withProposal.authorization.every((entry) => entry.level === "strong")).toBe(true);
  });

  it.each([
    ["atoaji", { persistence: "brief", resolution: "abrupt" }],
    ["kire", { persistence: "lingering" }],
    ["nameraka", { smoothness: "rough" }],
    ["marui", { roundness: "angular" }],
    ["tanrei", { weightQuality: "strong" }],
    ["nojun", { weightQuality: "light" }],
  ])("rejects %s when its reviewed Reject condition is present", (termId, values) => {
    const result = authorizeSensoryTerms(interpretation(values), ["unmapped"], allTerms);
    expect(result.authorizedTermIds).not.toContain(termId);
  });

  it("does not authorize a supported route from proposal plus Anchor alone", () => {
    expect(
      authorizeSensoryTerms(
        interpretation({ persistence: "moderate" }),
        ["lingering-after-feel"],
        allTerms,
      ).authorizedTermIds,
    ).toEqual([]);
    expect(
      authorizeSensoryTerms(
        interpretation({ weightQuality: "light" }),
        ["light-delicate"],
        allTerms,
      ).authorizedTermIds,
    ).toEqual([]);
    expect(
      authorizeSensoryTerms(interpretation({ weightQuality: "strong" }), ["rich-full"], allTerms)
        .authorizedTermIds,
    ).toEqual([]);
  });

  it("does not treat unknown optional axes as rejection", () => {
    const result = authorizeSensoryTerms(
      interpretation({ smoothness: "smooth", continuity: "continuous" }),
      ["smooth-flow"],
      allTerms,
    );
    expect(result.authorizedTermIds).toEqual(["nameraka"]);
  });

  it.each([
    [
      "kire",
      "marui",
      { resolution: "abrupt", timeQuality: "sudden", roundness: "rounded", spread: "enclosing" },
    ],
    [
      "nameraka",
      "marui",
      { smoothness: "smooth", continuity: "continuous", roundness: "rounded", spread: "enclosing" },
    ],
    [
      "nojun",
      "nameraka",
      {
        weightQuality: "strong",
        persistence: "moderate",
        expansion: "expansive",
        spread: "spreading",
        smoothness: "smooth",
        continuity: "continuous",
      },
    ],
  ])("retains non-conflicting terms %s and %s", (first, second, values) => {
    const classes = {
      atoaji: "lingering-after-feel",
      kire: "clean-fade",
      nameraka: "smooth-flow",
      marui: "rounded-enveloping",
      nojun: "rich-full",
    };
    const result = authorizeSensoryTerms(
      interpretation(values),
      [classes[first], classes[second]],
      allTerms,
    );
    expect(result.authorizedTermIds).toEqual(expect.arrayContaining([first, second]));
  });

  it("removes both sides of a same-level tanrei/nojun conflict", () => {
    const first = {
      termId: "tanrei",
      sensoryClass: "light-delicate",
      level: "strong",
      supportCount: 2,
    };
    const second = {
      termId: "nojun",
      sensoryClass: "rich-full",
      level: "strong",
      supportCount: 2,
    };
    const result = resolveAuthorizationConflicts([first, second]);
    expect(result.retained).toEqual([]);
    expect(result.conflicts[0]).toMatchObject({ resolution: "same_level_conflict" });
  });

  it("never returns a supported authorization level", () => {
    const result = authorizeSensoryTerms(
      interpretation({ weightQuality: "light", persistence: "moderate" }),
      ["light-delicate"],
      allTerms,
    );
    expect(result.authorization).toEqual([]);
    expect(result.authorization.every((entry) => entry.level === "strong")).toBe(true);
  });

  it.each([
    [{ outcome: "ambiguous" }, ["smooth-flow"]],
    [{ outcome: "insufficient" }, ["rich-full"]],
  ])("stops %s before normal authorization", (semanticOutcome, proposals) => {
    expect(authorizeSensoryTerms(semanticOutcome, proposals, allTerms)).toEqual({
      authorizedTermIds: [],
      authorization: [],
      authorizationConflicts: [],
    });
  });

  it("keeps unmapped as a valid no-match proposal", () => {
    expect(
      authorizeSensoryTerms(interpretation({ smoothness: "smooth" }), ["unmapped"], allTerms)
        .authorizedTermIds,
    ).toEqual([]);
  });

  it("keeps proposals non-authoritative even when they say unmapped", () => {
    const result = authorizeSensoryTerms(
      interpretation({ smoothness: "smooth", continuity: "continuous" }),
      ["unmapped"],
      allTerms,
    );
    expect(result.authorizedTermIds).toEqual(["nameraka"]);
  });

  it.each([
    [["smooth-flow"], true],
    [["unmapped"], true],
    [["smooth-flow", "light-delicate"], true],
    [["unknown-class"], false],
    [["smooth-flow", "light-delicate", "rich-full"], false],
    [["unmapped", "smooth-flow"], false],
  ])("validates finite sensory class proposal contract", (proposals, valid) => {
    expect(validateSensoryClassProposals(proposals).ok).toBe(valid);
  });

  it("does not authorize a term outside the reviewed selectable allow-list", () => {
    expect(
      authorizeSensoryTerms(
        interpretation({ smoothness: "smooth", continuity: "continuous" }),
        [],
        ["sanmi"],
      ).authorizedTermIds,
    ).toEqual([]);
  });

  it("exposes route rejection and support evidence deterministically", () => {
    const route = {
      termId: "test",
      sensoryClass: "smooth-flow",
      anchor: [["smoothness", ["smooth"]]],
      supports: [["continuity", ["continuous"]]],
      strongSupportCount: 1,
      reject: (value) => value.smoothness === "rough",
    };
    expect(evaluateSemanticRoute(route, profile({ smoothness: "rough" }), true)).toMatchObject({
      level: null,
      rejected: true,
      rejectionCategory: "explicit_reject",
    });
  });

  it("requires two supports for atoaji after the policy review", () => {
    expect(
      authorizeSensoryTerms(
        interpretation({ persistence: "moderate", continuity: "continuous" }),
        [],
        allTerms,
      ).authorizedTermIds,
    ).not.toContain("atoaji");
    expect(
      authorizeSensoryTerms(
        interpretation({
          persistence: "moderate",
          timeQuality: "sustained",
          continuity: "continuous",
        }),
        [],
        allTerms,
      ).authorizedTermIds,
    ).toContain("atoaji");
  });

  it.each([
    [
      "body-expanding",
      { persistence: "moderate", continuity: "continuous", expansion: "expansive" },
    ],
    ["voice-ambiguous-ending", { persistence: "moderate", timeQuality: "sustained" }],
    [
      "voice-uncertain-medium",
      { persistence: "moderate", timeQuality: "sustained", smoothness: "rough" },
    ],
  ])("does not authorize atoaji for the reviewed one-support case %s", (_fixtureId, values) => {
    expect(
      authorizeSensoryTerms(interpretation(values), [], allTerms).authorizedTermIds,
    ).not.toContain("atoaji");
  });

  it.each([
    [
      "body-sustained-fast",
      {
        persistence: "lingering",
        timeQuality: "sustained",
        resolution: "unresolved",
        continuity: "continuous",
      },
    ],
    [
      "body-broad-gradual",
      {
        persistence: "lingering",
        timeQuality: "sustained",
        resolution: "gradual",
        continuity: "continuous",
      },
    ],
  ])("keeps atoaji for the reviewed two-support case %s", (_fixtureId, values) => {
    expect(authorizeSensoryTerms(interpretation(values), [], allTerms).authorizedTermIds).toContain(
      "atoaji",
    );
  });

  it("keeps nameraka at threshold one without allowing smoothness alone", () => {
    expect(
      authorizeSensoryTerms(interpretation({ smoothness: "smooth" }), [], allTerms)
        .authorizedTermIds,
    ).not.toContain("nameraka");
    expect(
      authorizeSensoryTerms(
        interpretation({ smoothness: "smooth", continuity: "continuous" }),
        [],
        allTerms,
      ).authorizedTermIds,
    ).toContain("nameraka");
    expect(
      authorizeSensoryTerms(
        interpretation({ smoothness: "smooth", flowQuality: "free" }),
        [],
        allTerms,
      ).authorizedTermIds,
    ).toContain("nameraka");
    expect(
      authorizeSensoryTerms(interpretation({ smoothness: "rough" }), [], allTerms)
        .authorizedTermIds,
    ).not.toContain("nameraka");
  });

  it("keeps marui on Primary supports only and ignores experimentalProfile", () => {
    const primaryOnly = authorizeSensoryTerms(
      interpretation({ roundness: "rounded" }),
      [],
      allTerms,
    );
    const withExperimental = authorizeSensoryTerms(
      {
        ...interpretation({ roundness: "rounded" }),
        experimentalProfile: { softness: "soft" },
      },
      [],
      allTerms,
    );
    expect(primaryOnly.authorizedTermIds).not.toContain("marui");
    expect(withExperimental).toEqual(primaryOnly);
    expect(
      authorizeSensoryTerms(
        interpretation({ roundness: "rounded", smoothness: "smooth" }),
        [],
        allTerms,
      ).authorizedTermIds,
    ).toContain("marui");
    expect(
      authorizeSensoryTerms(
        interpretation({ roundness: "rounded", spread: "enclosing" }),
        [],
        allTerms,
      ).authorizedTermIds,
    ).toContain("marui");
    expect(
      authorizeSensoryTerms(interpretation({ roundness: "angular" }), [], allTerms)
        .authorizedTermIds,
    ).not.toContain("marui");
  });

  it("keeps sensoryExpression non-authoritative", () => {
    const withoutText = authorizeSensoryTerms(
      interpretation({
        persistence: "moderate",
        timeQuality: "sustained",
        continuity: "continuous",
      }),
      [],
      allTerms,
    );
    const withText = authorizeSensoryTerms(
      {
        ...interpretation({
          persistence: "moderate",
          timeQuality: "sustained",
          continuity: "continuous",
        }),
        sensoryExpression: "全く別の表現",
      },
      [],
      allTerms,
    );
    expect(withText).toEqual(withoutText);
  });
});
