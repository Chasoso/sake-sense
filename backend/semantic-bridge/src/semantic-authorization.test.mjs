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
    ["atoaji", "lingering-after-feel", { persistence: "lingering", timeQuality: "sustained" }],
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
  ])("authorizes %s with proposal plus Anchor and Support", (termId, sensoryClass, values) => {
    const result = authorizeSensoryTerms(interpretation(values), [sensoryClass], allTerms);
    expect(result.authorization.find((entry) => entry.termId === termId)).toMatchObject({
      level: ["atoaji", "nameraka", "marui"].includes(termId) ? "strong" : "supported",
      supportCount: 1,
    });
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
    ["atoaji", "kire", { persistence: "moderate", resolution: "abrupt", timeQuality: "sustained" }],
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

  it.each([
    [
      { termId: "tanrei", sensoryClass: "light-delicate", level: "strong", supportCount: 2 },
      { termId: "nojun", sensoryClass: "rich-full", level: "supported", supportCount: 1 },
    ],
    [
      { termId: "tanrei", sensoryClass: "light-delicate", level: "supported", supportCount: 1 },
      { termId: "nojun", sensoryClass: "rich-full", level: "strong", supportCount: 2 },
    ],
  ])("keeps the stronger tanrei/nojun route", (first, second) => {
    const result = resolveAuthorizationConflicts([first, second]);
    expect(result.retained).toEqual([first.level === "strong" ? first : second]);
    expect(result.conflicts[0]).toMatchObject({ resolution: "strong_wins" });
  });

  it.each(["strong", "supported"])(
    "records same-level tanrei/nojun conflict without proposal-order winner",
    (level) => {
      const candidates = [
        { termId: "tanrei", sensoryClass: "light-delicate", level, supportCount: 1 },
        { termId: "nojun", sensoryClass: "rich-full", level, supportCount: 1 },
      ];
      const result = resolveAuthorizationConflicts(candidates);
      expect(result.retained).toEqual([]);
      expect(result.conflicts[0]).toMatchObject({ resolution: "same_level_conflict" });
    },
  );

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
});
