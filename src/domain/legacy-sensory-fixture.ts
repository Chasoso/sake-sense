// Historical fixture-only display records. They preserve local UI behavior but are
// not #46 sensory expressions and do not establish #47 feature-to-expression support.
export const legacyFixtureExpressions = {
  "short-abrupt": {
    id: "legacy-short-change",
    displayText: "短く切り替わる感じ",
  },
  "gradual-lingering": {
    id: "legacy-lingering-like",
    displayText: "余韻が残るような感じ",
  },
  "voice-fading": {
    id: "legacy-voice-fading",
    displayText: "余韻が残る感じ",
  },
  "lateral-repeated": {
    id: "legacy-wavering-continuous",
    displayText: "ゆらぎながら続く感じ",
  },
  expanding: {
    id: "legacy-spreading-outward",
    displayText: "外へほどけていく感じ",
  },
} as const;

export type LegacyFixtureExpressionRoute = keyof typeof legacyFixtureExpressions;

export function getLegacyFixtureExpression(route: LegacyFixtureExpressionRoute) {
  return legacyFixtureExpressions[route];
}
