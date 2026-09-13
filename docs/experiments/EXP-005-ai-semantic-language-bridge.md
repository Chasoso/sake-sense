# EXP-005 - AI-assisted sensory language bridge

- **Related hypothesis:** [H010 - AI-assisted semantic interpretation](../hypotheses/H010-ai-assisted-semantic-interpretation.md)
- **Owner of decision:** Human
- **Result:** pending

## EXP-004 learning

EXP-004 made observable movement more inspectable: duration, ending, spread, expansion, direction, repetition, participation, sustained speed, and meaningful activity are deterministic and local. The remaining problem is that the legacy `spread -> weight -> 淡麗/濃醇` bridge is too direct. Large repeated lateral motion is not sufficient evidence for 濃醇.

## Working question

Can a constrained semantic bridge make combinations of observable movement easier to express in beginner-friendly language without weakening transparency or curated vocabulary boundaries?

## Architecture

`BodyMovementFeatures` is converted by a pure function into provider-neutral `SensoryBridgeInput`. The input contains only interpreted observations: duration, ending, expansion, direction, repetition, participation, movement extent, and sustained-speed evidence. Raw frames, video, images, landmarks, and personal data are never included.

The bridge response contains sensory expressions, validated dictionary candidate IDs, unmapped features, and a concise reason. Candidate IDs are checked against the same mapped-only selectable set used to serialize the provider context before existing provenance-backed product matching runs. Each selectable context entry includes only its ID, display term, concise definition summary, and represented dimensions.

## Provider status

This implementation intentionally adds no external provider, SDK, API key, network call, or cloud runtime. The current UI identifies the deterministic local fixture explicitly; it does not claim that an AI interpreted the movement. A deterministic fixture provider demonstrates the contract locally; unavailable or invalid responses use a no-candidate fallback. A future real provider would receive the structured motion input and grounded mapped dictionary context. A production provider requires a separate product and architecture decision.

## Semantic boundary

The EXP-005 path does not pass legacy `weight:heavy` or `weight:light` conclusions to the bridge. Broad spread remains `spread:broad`, and repeated lateral sway may remain unmapped. Zero candidates is a valid result. Existing EXP-003/004 deterministic behavior remains historical/comparison behavior and is not silently removed.

## Safety and privacy

The bridge does not detect taste, emotion, personality, preference, health, age, gender, intoxication, or product suitability. It does not recommend or rank sake. Camera processing remains local and temporary; no raw camera material or movement history is uploaded or persisted.

## Automated verification

Tests cover observable input construction, dictionary serialization, prompt safety language, valid zero-candidate responses, malformed/unknown/duplicate/extra response rejection, fixture sway behavior, short abrupt mapping, and fallback behavior. Standard validation remains no-network.

## Human Experience Gate

- repeated lateral sway does not automatically become 濃醇 or 淡麗;
- short abrupt motion has an explanation consistent with replay;
- expanding motion remains an observation unless a candidate is grounded;
- ambiguous motion and provider failure feel acceptable as unmapped results;
- the user can distinguish observed movement, experimental interpretation, curated term, and real-sake evidence.

H010 remains `pending / unvalidated`. H007, H008, and H009 remain human-owned and unvalidated.
