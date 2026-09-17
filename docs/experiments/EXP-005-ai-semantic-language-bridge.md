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

The bridge response contains sensory expressions, validated dictionary candidate IDs, unmapped features, and a concise reason. The browser sends only the mapped selectable IDs; the production Lambda resolves those IDs against the canonical repository dictionary and constructs the display term, concise definition summary, and represented dimensions for Bedrock. Candidate IDs are checked against the same mapped-only selectable set before existing provenance-backed product matching runs. Browser-provided dictionary text is never authoritative.

Production AI prose is requested and validated as cautious, beginner-friendly Japanese. The backend replaces model-generated `unmappedFeatures` with stable `feature:value` identifiers derived from the validated Body or Voice input.

## Provider status

Provider implementations explicitly declare `fixture` or `ai`; successful execution preserves that source kind, while `fallback` is a runtime outcome rather than a provider implementation. Local development and CI use the deterministic fixture. When `VITE_SENSORY_BRIDGE_API_URL` is configured for production, Body and Voice use the same API Gateway/Lambda/Bedrock semantic boundary with modality-specific derived input. Body sends categorical movement features; Voice sends only duration, average intensity, pause count, and ending behavior derived locally from microphone samples. Raw camera/audio data never leaves the browser. The browser and Lambda validators remain authoritative, and unavailable or invalid responses use a no-candidate fallback. No real provider is called by standard tests.

## Semantic boundary

The EXP-005 path does not pass legacy `weight:heavy` or `weight:light` conclusions to the bridge. Broad spread remains `spread:broad`, and repeated lateral sway may remain unmapped. Zero candidates is a valid result. Existing EXP-003/004 deterministic behavior remains historical/comparison behavior and is not silently removed.

The reviewed beginner-facing expression records are maintained separately in [MVP sensory expressions](../data/mvp-sensory-expressions.md). The local fixture retains its historical display routes through separate fixture-only legacy records; it does not select #46 expressions, returns no sake-term candidates from Body or Voice observations, and does not establish approved feature-to-expression support. Feature-to-expression support rules remain a later Human-reviewed responsibility; expression-to-term link status does not establish a feature mapping.

## Safety and privacy

The bridge does not detect taste, emotion, personality, preference, health, age, gender, intoxication, or product suitability. It does not recommend or rank sake. Camera processing remains local and temporary; no raw camera material or movement history is uploaded or persisted.

## Automated verification

Tests cover observable input construction, Body and Voice request serialization without raw sensor fields, prompt safety language, production request validation, bounded Bedrock request construction, valid zero-candidate responses, malformed/unknown/duplicate/extra response rejection, fixture expression display behavior without term mapping, provider failure, and fallback behavior. The Lambda bundle is built with `npm run build:semantic-bridge` and deployed from a human-managed S3 artifact. Standard validation remains no-network.

## Human Experience Gate

- repeated lateral sway does not automatically become 濃醇 or 淡麗;
- short abrupt motion has an explanation consistent with replay;
- expanding motion remains an observation unless a candidate is grounded;
- ambiguous motion and provider failure feel acceptable as unmapped results;
- the user can distinguish observed movement, experimental interpretation, curated term, and real-sake evidence.

H010 remains `pending / unvalidated`. H007, H008, and H009 remain human-owned and unvalidated.
