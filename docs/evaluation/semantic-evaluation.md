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
and product-match modules. It does not access AWS or any network. It deliberately
does not invoke the production semantic provider, so it is an offline deterministic
grounding observation, not a production-equivalent semantic baseline. The checked-in
report is `docs/evaluation/semantic-offline-baseline.json`.

The baseline is an observation of the current implementation, not a set of
correct answers. A change in the report is a review signal; it is not by itself a
CI failure.

Each case separates the layers that produce an outcome:

- `semanticInterpretationOutcome` is the provider's `sensoryInterpretation.outcome`.
- `groundingOutcome` is the reviewed support-case result derived from
  `interpretationStateId` and `groundingExpressionIds`.
- `interpretationOutcome` is retained only as a compatibility alias for the
  semantic outcome; it is never the grounding outcome.

Offline runs have no provider semantic outcome, so their semantic outcome fields
are `null` while grounding metrics remain observable. Live semantic counts,
evaluator input, interpreted reach metrics, and baseline outcome comparison use
`semanticInterpretationOutcome`. Grounding counts and grounding-outcome changes
are reported separately.

## Production-equivalent live baseline and optional evaluator

The production-equivalent run is explicitly opt-in:

```bash
npm run eval:semantic:live
```

It invokes the existing semantic provider and the optional AI evaluator. It
requires the existing Bedrock environment configuration, including `AWS_REGION`
and `BEDROCK_MODEL_ID` (or `BEDROCK_EVALUATOR_MODEL_ID`). It writes an untracked
`artifacts/semantic-live-baseline.json` report by default. Do not run this command
in default CI or commit live output. This is the explicit command for obtaining a
production-equivalent observation before/after a semantic change.

To compare against a previously captured baseline, provide a baseline of the same
kind explicitly:

```bash
node scripts/evaluation/eval-semantic.mjs --live \
  --baseline artifacts/semantic-live-baseline-before.json \
  --output artifacts/semantic-live-baseline-after.json
```

Offline and live baselines are never compared as semantic changes. The report
marks a baseline-kind mismatch instead.

The separated outcome fields are part of the current report schema. Older live
artifacts that contain only the former grounding-derived `interpretationOutcome`
are rejected as a baseline-schema mismatch; regenerate them with the current
runner before comparison rather than treating grounding as semantic output.

## Human review queue

The report queues:

- stable control cases;
- deterministic contract failures;
- malformed evaluator responses;
- evaluator `review` or `fail` dimensions.

When comparing a live or changed report to the baseline, additionally review
changes to semantic interpretation outcome, grounding outcome, semantic profile,
authorized terms, and product reach. Semantic outcome changes use the
`baseline-semantic-outcome-changed` reason; grounding changes use
`baseline-grounding-outcome-changed`. These changes are added to each affected
case's `humanReviewReasons` and to the queue count; they are not merely emitted
as a separate comparison summary.
Keep the queue human-reviewed rather than optimizing only for match rate.

The report keeps global reach counts for compatibility, but they include any
outcome that produced authorized terms or product matches. They must not be read
as interpreted success rates. Outcome-specific metrics are provided separately:

- `interpretedAuthorizedTermReachCount` (semantic outcome)
- `interpretedProductReachCount` (semantic outcome)
- `ambiguousWithAuthorizedTermsCount` (semantic outcome)
- `insufficientWithAuthorizedTermsCount` (semantic outcome)

The separate outcome counts are `semanticInterpretedCount`,
`semanticAmbiguousCount`, `semanticInsufficientCount`, and
`groundingInterpretedCount`, `groundingAmbiguousCount`,
`groundingInsufficientCount`.

Provider contract failures retain a sanitized validation `code` and `path` for
diagnosis. Provider request failures are classified separately from semantic
contract failures and may include only safe structural metadata such as failure
kind, provider error name, HTTP status, provider output kind, and a sanitized
Converse request summary. Provider responses themselves are never written to the
report. A malformed evaluator response records only sanitized shape metadata
such as top-level keys and dimension keys.

Provider or deterministic contract failures skip the AI evaluator with
`{ status: "skipped", reason: "contract-failure" }`; skipped cases are not
included in evaluator pass/review/fail aggregates but remain in the human review
queue.

Term reach is also attributed by source. `semantic-authorization` means the
reviewed semantic profile authorization path produced the term. A
`reviewed-support-grounding` result is the legacy support-case fallback and is
reported, not removed, by this harness. `nonInterpretedLegacyTermReachCount`
tracks ambiguous/insufficient cases that still reach terms through that fallback;
this is current behavior for #89 review, not a successful interpretation metric.

The report also includes `contractFailureByCodePath`, evaluator fail/review case
counts, and a compact `humanReviewSummary` containing structured fixture input,
outcome, wording, profile, evaluator statuses/rationales, contract metadata, and
term source. It excludes raw provider and evaluator responses.

## Workflow for semantic changes

Before and after a semantic change such as #89:

1. Run `npm run eval:semantic` to refresh the offline deterministic observation.
2. Run `npm run eval:semantic:live` to capture a production-equivalent baseline
   before the change, and again after the change with `--baseline` pointing to the
   before report.
3. Review changed outcomes, profiles, authorized terms, product reach, and all
   queued control/ambiguous/low-signal cases.
4. Confirm that insufficient and ambiguous inputs still stop safely.
5. Have a human approve any intended semantic or wording change.

The harness reports semantic changes separately from deterministic contract
failures so a malformed integration result cannot be mistaken for a desired
semantic change.
