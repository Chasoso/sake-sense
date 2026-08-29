# EXP-001 — Sensory dictionary v0.1 research spike

- **Related hypotheses:** [H002](../hypotheses/H002-intermediate-sensory-representation.md), [H003](../hypotheses/H003-grounded-sensory-dictionary.md)
- **Date:** 2026-08-29
- **Owner of decision:** Human
- **Result:** pending

## What was built/tested

This research spike defines an eight-entry, machine-readable v0.1 dictionary. It separates source-grounded sake terminology, beginner-facing language candidates, and experimental nonverbal candidates. The data is in [`sensory-dictionary.v0.1.json`](../../src/domain/data/sensory-dictionary.v0.1.json), with its structure in [`sensory-dictionary.schema.json`](../../schemas/sensory-dictionary.schema.json).

The first local prototype now exercises one short flow: an everyday sensory expression plus one pointer stroke are converted into explainable features, the shared dimensions `shape` / `duration`, and one or more dictionary candidates. There is no network or LLM call. This prototype is an experiment and does not validate H001-H003.

The proposed intermediate dimensions are deliberately small:

- `weight`: light ↔ heavy
- `shape`: sharp ↔ round
- `duration`: short ↔ lingering

These dimensions are working representations derived from the retained terms, not a scientific sensory model.

## Sources reviewed

1. [National Tax Agency, tasting terminology reference (2023)](https://www.nta.go.jp/taxes/sake/hambai/moderutekisuto/pdf/r05_07_07.pdf) — used for concise paraphrases of 淡麗, 濃醇, なめらか, and 切れが良い.
2. [National Research Institute of Brewing, Sensory Evaluation Terms](https://www.nrib.go.jp/English/sake_info/sake-essentials/sensory-evaluation-terms/) — used for the corresponding terminology for 濃醇, まるい, なめらか, 酸味, うま味, and あと味. It was consulted as a cross-check for terminology, not used as the definition provenance for 淡麗.

Only concise paraphrases and provenance metadata are stored. Source prose is not copied into the repository. Public visibility was not treated as an open-data license.

## Retained vocabulary

The initial set retains 淡麗, 濃醇, なめらか, まるい, 切れが良い, 酸味, うま味, and あと味. They cover taste, mouthfeel, and aftertaste while remaining understandable enough to support a beginner-facing experiment. `余韻` is not retained as an authoritative entry; it appears only as an explicitly experimental everyday-language candidate for `あと味`.

The candidate list in Issue #5 was not copied wholesale. Terms without a sufficiently clear source-backed, beginner-relevant paraphrase were omitted from this v0.1 instead of being filled by generated definitions.

## Known ambiguities and limitations

- Terms such as 淡麗 and 濃醇 are holistic evaluation words; the data does not reduce them to a single numeric axis.
- うま味 is intentionally `unmapped` in v0.1 because the three current dimensions do not provide a justified polarity for it. This is a model limitation, not a claim that うま味 means either light, heavy, sharp, round, short, or lingering.
- Everyday-language candidates are bridges for testing, not official definitions. `inferred-from-examples` and `experimental` are intentionally visible statuses.
- Nonverbal candidates are illustrative experiment seeds only. They do not claim that a gesture, sound, or onomatopoeia objectively means a sake term.
- The set is not a complete sake vocabulary and does not assume comprehensive Ishikawa product data.
- Source wording, translation choices, participant understanding, and the usefulness of the dimensions require later human review.

## Automated verification

- `npm run validate:dictionary` validates the JSON Schema and dimension references.
- `npm run test -- src/domain/sensory-dictionary.test.ts` checks deterministic schema validation.
- `npm run validate` runs the repository-wide no-network suite.

## Human experience observations

Pending. A human should assess whether the retained terms are useful to beginners, whether the definitions are understandable without overclaiming, and whether the three dimensions feel like a plausible experiment rather than arbitrary scoring.

For the local prototype, the review checklist is:

- Can a first-time user understand the task without a long explanation?
- Is entering an everyday expression and drawing one stroke comfortable?
- Does the gesture-to-feature explanation feel understandable rather than magical?
- Do multiple candidates and mixed signals communicate uncertainty clearly?
- Does the short interaction feel interesting enough to repeat?
- Does it motivate a next experiment without presenting a recommendation or diagnosis?

## Decision and learning

The human must decide `keep`, `revise`, or `reject` after reviewing evidence. No H002 or H003 status is changed by this research spike alone.

## Follow-up Issues

To be added after the human review gate identifies the smallest useful next experiment.
