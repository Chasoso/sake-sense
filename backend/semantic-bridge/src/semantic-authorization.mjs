export const sensoryClassValues = [
  "lingering-after-feel",
  "clean-fade",
  "smooth-flow",
  "rounded-enveloping",
  "light-delicate",
  "rich-full",
  "unmapped",
];

const routeDefinitions = [
  {
    termId: "atoaji",
    sensoryClass: "lingering-after-feel",
    anchor: [["persistence", ["moderate", "lingering"]]],
    supports: [
      ["timeQuality", ["sustained"]],
      ["resolution", ["gradual", "unresolved"]],
      ["continuity", ["continuous"]],
    ],
    strongSupportCount: 2,
    reject: (profile) => profile.persistence === "brief" && profile.resolution === "abrupt",
  },
  {
    termId: "kire",
    sensoryClass: "clean-fade",
    anchor: [["resolution", ["abrupt"]], ["persistence", ["brief"]], "or"],
    supports: [
      ["timeQuality", ["sudden"]],
      ["persistence", ["brief"]],
      ["resolution", ["abrupt"]],
    ],
    strongSupportCount: 2,
    reject: (profile) => profile.persistence === "lingering" || profile.resolution === "unresolved",
  },
  {
    termId: "nameraka",
    sensoryClass: "smooth-flow",
    anchor: [["smoothness", ["smooth"]]],
    supports: [
      ["continuity", ["continuous"]],
      ["flowQuality", ["free"]],
    ],
    strongSupportCount: 1,
    reject: (profile) => profile.smoothness === "rough",
  },
  {
    termId: "marui",
    sensoryClass: "rounded-enveloping",
    anchor: [["roundness", ["rounded"]]],
    supports: [
      ["spread", ["enclosing"]],
      ["smoothness", ["smooth"]],
    ],
    strongSupportCount: 1,
    reject: (profile) => profile.roundness === "angular",
  },
  {
    termId: "tanrei",
    sensoryClass: "light-delicate",
    anchor: [["weightQuality", ["light"]]],
    supports: [
      ["persistence", ["brief", "moderate"]],
      ["expansion", ["condensing", "neutral"]],
      ["spread", ["enclosing", "neutral"]],
    ],
    strongSupportCount: 2,
    reject: (profile) =>
      profile.weightQuality === "strong" ||
      (profile.persistence === "lingering" &&
        profile.expansion === "expansive" &&
        profile.spread === "spreading"),
  },
  {
    termId: "nojun",
    sensoryClass: "rich-full",
    anchor: [["weightQuality", ["strong"]]],
    supports: [
      ["persistence", ["moderate", "lingering"]],
      ["expansion", ["expansive"]],
      ["spread", ["spreading"]],
      ["timeQuality", ["sustained"]],
    ],
    strongSupportCount: 2,
    reject: (profile) =>
      profile.weightQuality === "light" ||
      (profile.persistence === "brief" && profile.expansion === "condensing"),
  },
];

const conflictPairs = new Set(["tanrei:nojun", "nojun:tanrei"]);

function readProfileValue(profile, path) {
  return path.split(".").reduce((value, key) => value?.[key], profile);
}

function conditionSatisfied(profile, condition) {
  if (condition === "or") return false;
  const [path, values] = condition;
  return values.includes(readProfileValue(profile, path));
}

function anchorSatisfied(profile, conditions) {
  if (conditions.at(-1) === "or") {
    return conditions.slice(0, -1).some((condition) => conditionSatisfied(profile, condition));
  }
  return conditions.every((condition) => conditionSatisfied(profile, condition));
}

export function evaluateSemanticRoute(route, profile) {
  const anchorSatisfiedValue = anchorSatisfied(profile, route.anchor);
  const satisfiedSupports = route.supports.filter((support) =>
    conditionSatisfied(profile, support),
  );
  const rejected = route.reject(profile);
  const strong =
    anchorSatisfiedValue && satisfiedSupports.length >= route.strongSupportCount && !rejected;
  return {
    termId: route.termId,
    sensoryClass: route.sensoryClass,
    level: strong ? "strong" : null,
    supportCount: satisfiedSupports.length,
    anchorSatisfied: anchorSatisfiedValue,
    rejected,
    rejectionCategory: rejected
      ? "explicit_reject"
      : !anchorSatisfiedValue
        ? "anchor_not_satisfied"
        : satisfiedSupports.length === 0
          ? "support_shortage"
          : "strong_threshold_not_met",
  };
}

/**
 * Authorize selectable terms from the validated Primary semanticProfile only.
 *
 * sensoryClassProposals, sensoryExpression, and experimentalProfile remain
 * provider/evaluation metadata but are intentionally non-authoritative here.
 */
export function authorizeSensoryTerms(interpretation, _proposals = [], allowedIds = []) {
  const empty = { authorizedTermIds: [], authorization: [], authorizationConflicts: [] };
  if (!interpretation || interpretation.outcome !== "interpreted") return empty;
  // Keep the provider-facing argument for compatibility; proposals are diagnostic-only.
  void _proposals;

  const candidates = routeDefinitions
    .map((route) => evaluateSemanticRoute(route, interpretation.semanticProfile))
    .filter((route) => route.level && allowedIds.includes(route.termId));
  const { retained, conflicts } = resolveAuthorizationConflicts(candidates);
  return {
    authorizedTermIds: retained.map((route) => route.termId),
    authorization: retained,
    authorizationConflicts: conflicts,
  };
}

export function resolveAuthorizationConflicts(candidates) {
  const conflicts = [];
  const retained = [];
  for (const candidate of candidates) {
    const conflict = retained.find((other) =>
      conflictPairs.has(`${candidate.termId}:${other.termId}`),
    );
    if (!conflict) {
      retained.push(candidate);
      continue;
    }
    if (candidate.level !== conflict.level) {
      const stronger = candidate.level === "strong" ? candidate : conflict;
      const weaker = candidate.level === "strong" ? conflict : candidate;
      retained.splice(retained.indexOf(conflict), 1, stronger);
      conflicts.push({
        termIds: [candidate.termId, conflict.termId],
        resolution: "strong_wins",
        removedTermId: weaker.termId,
      });
    } else {
      retained.splice(retained.indexOf(conflict), 1);
      conflicts.push({
        termIds: [candidate.termId, conflict.termId],
        resolution: "same_level_conflict",
      });
    }
  }

  return { retained, conflicts };
}

export function validateSensoryClassProposals(value, outcome = "interpreted") {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.some((entry) => !sensoryClassValues.includes(entry))) {
    return { ok: false, error: "invalid sensory class proposal" };
  }
  if (new Set(value).size !== value.length || value.length > 2) {
    return { ok: false, error: "invalid sensory class proposal count" };
  }
  if (value.includes("unmapped") && value.length !== 1) {
    return { ok: false, error: "unmapped cannot be mixed with normal sensory classes" };
  }
  if (outcome !== "interpreted" && value.some((entry) => entry !== "unmapped")) {
    return { ok: false, error: "non-interpreted outcome cannot propose normal sensory classes" };
  }
  return { ok: true, value };
}
