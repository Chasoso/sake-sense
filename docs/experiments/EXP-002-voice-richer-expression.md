# EXP-002 — Voice and richer expression

- **Related hypotheses:** [H005](../hypotheses/H005-richer-expression-improves-engagement.md), [H006](../hypotheses/H006-real-sake-connection-gives-purpose.md)
- **Predecessor:** [EXP-001](EXP-001-sensory-dictionary-v0.1.md)
- **Date:** 2026-08-29
- **Owner of decision:** Human
- **Result:** pending

## Working question

Does an experience that lets a user express a sensation with voice and richer movement, then connects that expression through sake language to real Ishikawa sake, feel more natural, engaging, and purposeful than EXP-001?

This is a working question for the next experiment, not an established product requirement.

## Human evidence from EXP-001

The first review found that the core idea could be realized, while keyboard text plus one plain line felt simple, cumbersome, and somewhat thin. The user wanted voice, richer expression, and a clearer connection after a sake term. These observations are recorded in [EXP-001](EXP-001-sensory-dictionary-v0.1.md).

## What EXP-002 is intended to test

- Whether a voice-first entry reduces keyboard friction for short sensory expressions.
- Whether a richer short movement feels more expressive and repeatable than one plain stroke.
- Whether connecting a translated term to a real, source-grounded Ishikawa sake gives the translation a clearer purpose.

## What was built for Issue #16

The local prototype now connects the existing voice and free-form movement inputs to the existing sensory hints and dictionary candidates, then looks up only the provenance-backed Ishikawa sample products that reference those candidate terms. Product cards show the producer, concise sourced summary, the term reference used for the connection, and an official source link. This is an exploratory “check this word in real sake” path, not a recommendation or ranking.

If a candidate has no supporting product in the intentionally small sample, the interface explains that limitation instead of inventing a match. A retry action lets the user try another expression without adding history or personalization.

## Automated verification

The integrated domain flow is covered by deterministic tests for grounded product matching, multiple term references, no-product-match behavior, voice-only fallback, and the existing text/movement and mixed-signal paths. The standard repository validation suite is required before the human review.

## Human Experience Gate for EXP-002

Result remains `pending`. Human review should compare this flow with EXP-001 and check voice-first comfort, richer movement, the clarity of sensory hints and candidate reasoning, the usefulness of the Ishikawa product connection, the accuracy of source presentation, retry behavior, and whether any result feels like a recommendation or diagnosis. The human owns the H005/H006 `keep`, `revise`, or `reject` decision.

## What EXP-002 must not claim

- Voice or movement features are not scientific measurements of taste.
- A displayed sake is not a recommendation, ranking, compatibility diagnosis, or claim about the user's preferences.
- A small sample is not a complete representation of Ishikawa sake.
- Technical completion does not validate H005 or H006, and does not automatically change H001-H003.

## Success and failure signals

### H005 — Richer expression improves engagement

Success signals include beginning without a keyboard, voice feeling lower-friction than typing, movement feeling meaningful rather than decorative, wanting to retry, and understanding the interaction without lengthy explanation.

Failure signals include voice feeling more awkward, movement remaining arbitrary, added richness increasing confusion without interest, or the interaction still feeling like a form.

### H006 — Real sake connection gives the translation a purpose

Success signals include understanding why a sourced Ishikawa sake is shown, reduced “so what?” feeling after terminology, curiosity about tasting or learning, and interpreting the result as an example rather than a recommendation.

Failure signals include an arbitrary or bolted-on product connection, recommendation-like interpretation, weak provenance, or additional information without motivation.

## Human Experience Gate

The human must review whether the recorded EXP-001 learnings match the actual experience and whether H005/H006 are the right next uncertainties. For EXP-002, review understandability, input comfort, perceived meaning of movement, voice permission/fallback behavior, translation plausibility, product-connection clarity, interest/fun, and willingness to continue.

The human owns the eventual `keep`, `revise`, or `reject` decisions.

## Follow-up Issues

- [Issue #14 — EXP-002 voice and richer gesture input prototype](https://github.com/Chasoso/sake-sense/issues/14)
- [Issue #15 — Ishikawa sake sample dataset with provenance](https://github.com/Chasoso/sake-sense/issues/15)
