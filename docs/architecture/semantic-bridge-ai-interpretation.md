# Semantic bridge: AI sensory interpretation architecture proposal

Status: Phase A architecture / contract review for Issue #89. This document
does not change production behavior and does not approve a final semantic
profile schema or any new sake-term mapping.

Related: [Issue #88](https://github.com/Chasoso/sake-sense/issues/88),
[Issue #59](https://github.com/Chasoso/sake-sense/issues/59).

## 1. Current production flow

The current implementation has two distinct deterministic boundaries: local
feature extraction in the browser and reviewed grounding after the provider
response.

```text
Body capture / Voice capture
  -> local deterministic feature extraction                 [frontend]
  -> compact semantic-bridge request                         [frontend]
  -> API Gateway -> Lambda request validation                 [backend]
  -> Bedrock Converse structured response                     [AI]
  -> Lambda response validation                               [backend]
  -> applyReviewedGrounding                                  [deterministic domain policy]
  -> browser response validation + reviewed grounding          [frontend/domain]
  -> selectable candidate term IDs                            [deterministic domain policy]
  -> provenance/availability product matching                 [deterministic domain policy]
  -> Result UI                                                [frontend]
```

The relevant current responsibilities are:

- `BodyExperiment.tsx` and `Experiment.tsx` create the provider request. The
  browser sends derived Body or Voice fields and the current selectable
  dictionary ID allow-list.
- `sensory-bridge.ts` serializes the request, validates the browser response,
  and applies reviewed grounding again after an HTTP provider response.
- `backend/semantic-bridge/src/validation.mjs` validates request fields,
  canonical selectable dictionary IDs, Japanese user-facing text, response
  shape, and model-returned IDs.
- `backend/semantic-bridge/src/grounding.mjs` then ignores unsupported model
  term promotion and re-derives expression and term eligibility from the
  reviewed `sensory-support-cases` and expression-link status.
- `sake-product-matching.ts` accepts only selectable IDs and explicit product
  term references that pass evidence, provenance, availability, and reference
  checks.
- The frontend creates candidates from the grounded response and renders only
  the products returned by `findSakeProductMatches`.

In the current runtime, AI produces wording and a candidate-ID proposal, but
the reviewed support-case table is the effective interpreter of the observed
feature combination. The candidate IDs are not authoritative merely because
they are in the dictionary allow-list.

## 2. Current problem

The reviewed support cases are an important safety boundary, but their current
runtime role is stronger than a post-model safety check. Examples include:

```text
short + abrupt       -> clean-fade
lingering + gradual  -> soft-settle
expanding            -> spreading-outward
lateral + repeated   -> wavering-continuous
```

The first, `clean-fade`, has an approved `kire` link. The other examples are
expression-only or unmapped in the current dataset and do not normally produce
a sake term. This protects the system from unsupported promotion, but it also
means the deterministic table decides the sensory expression before the AI can
interpret the full combination of observations.

Issue #88 therefore identified two different concerns that must not be
conflated:

1. Some no-match outcomes are intentionally conservative because the reviewed
   policy has no authorized interpretation or product evidence.
2. The production bridge has insufficient observability and provider failures,
   so it is difficult to distinguish conservative outcomes from a real
   coverage or runtime bottleneck.

Issue #59 should not be treated as incorrect. It fixed the important failure
mode where an AI could promote an allowed dictionary ID without a reviewed
`feature -> expression -> term` path. The target architecture moves the
boundary later; it does not remove that guarantee.

## 3. Target responsibility boundary

The proposed architecture is:

```text
observable Body / Voice features
  -> AI sensory interpretation
  -> validated structured interpretation
  -> human-reviewed deterministic sake-term authorization
  -> provenance-backed product matching
```

### AI may own

- holistic interpretation of the supplied observable Body / Voice features;
- concise, beginner-friendly sensory wording;
- a small structured semantic interpretation;
- an explicit `ambiguous` or `insufficient` outcome when evidence is weak or
  conflicting.

### AI must not own

- authoritative sake term IDs;
- product IDs, product ranking, or recommendations;
- provenance, evidence, or availability decisions;
- dictionary definitions or vocabulary status;
- the decision to bypass an authorized term relation.

### Deterministic and human-reviewed logic owns

- output contract and value validation;
- authorization from a reviewed sensory interpretation to selectable sake
  vocabulary;
- selectable versus reference-only enforcement;
- product-term relations;
- evidence and provenance validation;
- availability and renderability filtering;
- the final set of real sake products that may be rendered.

This is a proposed boundary for review, not an authorization to implement it
yet.

## 4. Current AI input contract

The browser currently sends the following compact fields.

### Body

`buildSensoryBridgeInput()` sends:

| Field           | Current values / meaning                    |
| --------------- | ------------------------------------------- |
| `duration`      | `short`, `lingering`, `unknown`             |
| `ending`        | `abrupt`, `gradual`, `continued`, `unknown` |
| `expansion`     | `expanding`, `contracting`, `unknown`       |
| `direction`     | `upward`, `downward`, `lateral`, `unknown`  |
| `repetition`    | `single`, `repeated`, `unknown`             |
| `participation` | `localized`, `broad`, `unknown`             |
| `spread`        | `compact`, `broad`, `unknown`               |
| `speed`         | `sustained-fast`, `unknown`                 |

### Voice

`buildVoiceSensoryBridgeInput()` sends:

| Field              | Meaning / constraint                            |
| ------------------ | ----------------------------------------------- |
| `durationMs`       | derived duration, clamped to the accepted range |
| `averageIntensity` | derived normalized intensity                    |
| `pauseCount`       | derived pause count                             |
| `endingBehavior`   | `maintained`, `fading`, `unknown`               |

The current request also contains `allowedTermIds`. Lambda validates those IDs
against the canonical selectable dictionary and constructs canonical dictionary
context before calling Bedrock. That is a transitional contract concern, not a
proposal that AI should authorize those IDs. A target interpretation request
should be reviewed separately from the deterministic vocabulary authorization
request.

The privacy boundary remains unchanged. The semantic bridge must not receive:

- camera frames or saved video;
- raw video or raw pose history / landmarks;
- raw audio or microphone buffers;
- segmentation masks or contours;
- unnecessary personal data.

No new sensor feature is proposed in Phase A.

## 5. AI output contract: proposal only

The final schema is intentionally undecided. Two small options are provided
for human review rather than adoption.

### Option A: minimum interpretation result

Conceptually:

```json
{
  "outcome": "interpreted",
  "sensoryExpression": "ゆっくりほどけながら、余韻が残るような感じ",
  "semanticProfile": {}
}
```

`outcome` would need a reviewed finite vocabulary, for example an interpreted
state plus explicit ambiguous and insufficient states. The empty profile here
is deliberate: Phase A does not choose its fields or enum values.

### Option B: slightly richer interpretation result

Conceptually:

```json
{
  "outcome": "interpreted",
  "sensoryExpression": "ゆっくりほどけながら、余韻が残るような感じ",
  "semanticProfile": {
    "dimensions": [],
    "confidence": "review-needed"
  },
  "reasonCategory": "derived-from-observation"
}
```

This could make review and observability easier, but it risks creating a new
ontology and false precision. `confidence` must not be treated as a taste
measurement or as authority for a sake term.

Candidate dimensions for review:

| Candidate                   | What it could represent                       | Risk / ambiguity                            |
| --------------------------- | --------------------------------------------- | ------------------------------------------- |
| persistence                 | how long a perceived impression remains       | may be confused with duration or aftertaste |
| resolution / ending quality | abrupt, gradual, or unresolved release        | may overfit movement ending                 |
| spread                      | compact versus broadly distributed impression | may be confused with body participation     |
| continuity                  | continuous, wavering, or interrupted quality  | may encode repetition twice                 |
| softness / sharpness        | felt gentleness versus crisp resolution       | easily becomes an unsupported sake shortcut |
| repetition / wavering       | recurring or oscillating impression           | may duplicate observable repetition         |

These are comparison candidates only. No dimension, enum, value vocabulary,
or mapping is approved by this document.

## 6. Insufficient, ambiguous, and invalid outcomes

The AI must not be forced to produce a sensory expression for every request.
The contract should be able to represent at least these conceptual states:

- `interpreted`: a reviewable sensory interpretation exists;
- `ambiguous`: competing interpretations remain unresolved;
- `insufficient`: the observation does not support a useful interpretation;
- `provider-invalid` / `fallback`: the provider response cannot be trusted or
  the bridge is unavailable.

The last state is an integration outcome, not a sensory claim. It should be
kept distinguishable from a valid `insufficient` observation. All non-validated
or ambiguous states must stop before sake-term authorization unless an
explicitly reviewed policy later says otherwise.

## 7. Deterministic sake-term mapping boundary

The target flow must not introduce shortcuts such as:

```text
short + abrupt -> kire
expanding       -> nojun
fast            -> kire
```

Instead:

```text
observable features
  -> AI sensory interpretation
  -> validated semantic meaning
  -> reviewed authorization rule
  -> selectable sake term ID
  -> product-term evidence and availability checks
```

AI must not directly return an authoritative term ID. Raw movement features
must not jump directly to a sake term because a single feature is not enough to
establish the sensory meaning of a product vocabulary item. A deterministic
mapper may accept only a validated profile and an explicitly reviewed rule;
that mapper is where a future human decision such as “this profile may
authorize this term” belongs.

This Phase A document intentionally does not define any concrete
`semanticProfile -> kire` or equivalent rule.

## 8. `sensory-support-cases` migration plan

Do not delete `sensory-support-cases.v0.1.json`. Reposition it gradually:

```text
Current: production semantic decision table
Target:  representative evaluation / regression fixture set
```

For example, the `short + abrupt` case should provide a repeatable input for
asking:

- what interpretation did the AI produce?
- did it reflect the observed features plausibly?
- was the structured profile stable enough for review?
- did the downstream deterministic authorization behave correctly?

The fixture should not force a fixed free-text expression at runtime after the
target migration. Tests should compare structured contract properties and
human-reviewed acceptance criteria rather than requiring arbitrary free-text
equality. Deterministic fields, if any, may still use exact assertions.

Existing cases remain useful for regression, especially for ambiguous,
insufficient, expression-only, and no-product outcomes. Their expected results
must be re-approved rather than silently carried forward as new semantic truth.

## 9. Compatibility with #59

The following #59 guarantees remain mandatory:

- AI cannot make an arbitrary term ID a production candidate;
- unknown term IDs are rejected;
- reference-only terms do not become normal candidates;
- ambiguous and insufficient outcomes are not forced into terms;
- only authorized term IDs reach product matching;
- products without allowed evidence/provenance or availability eligibility are
  not rendered;
- browser and Lambda validation remain authoritative over provider output;
- raw sensor media remains outside the backend boundary.

The intended change is narrower: the support-case table should no longer
override the AI's sensory interpretation before deterministic term
authorization. The safety boundary moves later; it does not disappear.

## 10. Production observability proposal

Issue #88 showed that current sanitized Lambda logs distinguish provider
success/failure but cannot explain a no-match. A target implementation should
consider logging only bounded, non-sensitive categories such as:

- correlation ID;
- modality;
- AI outcome kind;
- approved semantic-profile category values, after validation;
- authorized term IDs;
- eligible product count;
- validation, fallback, and rejection category.

Do not log raw prompts, raw provider output, raw sensor data, raw audio, raw
pose/landmark history, secrets, tokens, or unnecessary free-text user data.
This is a proposal only; no instrumentation is added in Phase A.

## 11. Implementation phases after Phase A

### Phase B — AI sensory interpretation contract and validation

- **Purpose:** implement the reviewed structured interpretation contract with
  deterministic validation and no-network provider test doubles.
- **Likely files:** `backend/semantic-bridge/src/schema.mjs`,
  `validation.mjs`, `handler.test.mjs`, and browser-side
  `src/domain/sensory-bridge.ts` types/validation.
- **Human decision:** approve outcome states, profile dimensions, enums, and
  whether any current `allowedTermIds` field remains in the AI request.
- **Production behavior:** contract and validation may change; term mapping and
  product matching should not change yet.

### Phase C — AI-first runtime interpretation

- **Purpose:** let Bedrock interpret the compact observable features instead of
  using support cases as the primary runtime interpreter.
- **Likely files:** Bedrock schema/instruction, Lambda validation/handler, and
  browser bridge response handling.
- **Human decision:** review representative Body/Voice interpretations and
  approve the boundary for ambiguous and insufficient results.
- **Production behavior:** yes; this phase changes sensory interpretation.

### Phase D — deterministic sake-term authorization

- **Purpose:** map validated semantic interpretations to selectable terms using
  explicit human-reviewed rules, then retain existing product matching.
- **Likely files:** a new or revised domain mapping module, dictionary/term
  authorization boundary, product-matching integration, and deterministic
  tests. Existing datasets should not be edited without separate approval.
- **Human decision:** approve every semantic-profile-to-term policy and
  multiple-candidate rule.
- **Production behavior:** yes; this phase changes term and product reachability.

### Phase E — observability and deployed Human Experience

- **Purpose:** add sanitized stage metrics and evaluate real Body/Voice cases in
  the deployed environment.
- **Likely files:** Lambda logging, browser diagnostic/result state, deployment
  documentation, and no-network tests for logging categories.
- **Human decision:** approve privacy-safe fields and judge whether successful
  product paths and conservative no-match outcomes are useful.
- **Production behavior:** logging and result-state clarity change; no
  provenance relaxation is implied.

## Human approval checklist

- [ ] AI sensory interpretation responsibility boundary approved
- [ ] AI output outcome structure approved
- [ ] Semantic-profile dimensions approved
- [ ] Enum / value vocabulary approved
- [ ] Insufficient / ambiguous policy approved
- [ ] Sake-term authorization boundary approved
- [ ] Support-case fixture migration strategy approved
- [ ] Production observability proposal approved

## Phase A non-goals and decision status

This document does not change production code, Bedrock prompts, Lambda
behavior, API schemas, support-case data, dictionary/product data, feature
extraction, UI, AWS resources, or tests. It does not close Issue #89 and does
not decide the semantic profile or any authoritative sake-term mapping.
