# Semantic evaluation harness

This harness compares Body / Voice semantic flows across a fixed set of structured
observations. It is an evaluation aid for changes such as Issue #89; it is not a
semantic truth oracle and it does not change production runtime behavior.

## Layers and authority

The deterministic production pipeline remains authoritative for:

- reviewed grounding and fallback behavior;
- selectable Japanese term authorization;
- product matching and result reach;
- provenance and evidence semantics.

The optional evaluator only reviews five independent dimensions:

- `semanticConsistency`
- `unsupportedInference`
- `ambiguityHandling`
- `profileTextConsistency`
- `wordingQuality`

It returns `pass`, `review`, or `fail` with a short rationale. It cannot add term
IDs, select products, rank recommendations, or alter provenance. A malformed
response is converted to a fail-safe result requiring human review.

## Fixtures and deterministic run

`backend/semantic-bridge/eval/body-voice-evaluation.v0.1.json` contains 20
structured fixtures: 10 Body and 10 Voice cases. They contain no video, frames,
pose history, or audio. The fixture set includes abrupt, gradual, expanding,
contracting, repeated lateral, sustained, fading, maintained, ambiguous, and
low-signal observations.

Run the offline report with:

```bash
npm run eval:semantic
```

This command uses the production validation, reviewed grounding, authorization,
and product-match modules. It does not access AWS or any network. The checked-in
report is `docs/evaluation/semantic-baseline.json`.

The baseline is an observation of the current implementation, not a set of
correct answers. A change in the report is a review signal; it is not by itself a
CI failure.

## Optional live evaluator

Live evaluation is explicitly opt-in:

```bash
npm run eval:semantic:live
```

It requires the existing Bedrock environment configuration, including
`AWS_REGION` and `BEDROCK_MODEL_ID` (or `BEDROCK_EVALUATOR_MODEL_ID`). Do not run
this command in default CI and do not commit live output. The live evaluator is
review-only and cannot influence deterministic term authorization or product
matching.

## Human review queue

The report queues:

- stable control cases;
- deterministic contract failures;
- malformed evaluator responses;
- evaluator `review` or `fail` dimensions.

When comparing a live or changed report to the baseline, additionally review
changes to interpretation outcome, semantic profile, authorized terms, and product
reach. Keep the queue human-reviewed rather than optimizing only for match rate.

## Workflow for semantic changes

Before and after a semantic change such as #89:

1. Run `npm run eval:semantic` on the current baseline.
2. Run the same fixture set against the candidate implementation or an explicit
   live evaluation.
3. Review changed outcomes, profiles, authorized terms, product reach, and all
   queued control/ambiguous/low-signal cases.
4. Confirm that insufficient and ambiguous inputs still stop safely.
5. Have a human approve any intended semantic or wording change.

The harness reports semantic changes separately from deterministic contract
failures so a malformed integration result cannot be mistaken for a desired
semantic change.
