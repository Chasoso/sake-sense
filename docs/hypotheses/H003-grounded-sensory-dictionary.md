# H003 — Grounded sensory dictionary

- **Status:** unvalidated
- **Owner of decision:** Human

## Hypothesis

Translation quality depends heavily on a curated dictionary connecting authoritative sake terminology, everyday expressions, and experimental nonverbal representations. An LLM should not freely generate this dictionary as authoritative truth.

## Rationale and assumptions

Specialist terminology needs grounding in reliable sources, while everyday and experimental expressions need clear provenance and uncertainty. A curated boundary may make the experience more understandable and safer to revise. The appropriate sources and curation process remain to be determined.

## Experiment idea

Assemble a very small, explicitly sourced set of terms and experimental expressions, label uncertainty, and compare a grounded mapping with an unconstrained generated suggestion in a local review.

## Success signals

- Reviewers can trace mappings to their sources or experimental origin.
- Uncertainty and provisional mappings are visible.
- The small dictionary supports useful exploration without pretending to cover all sake.

## Failure signals

- Source quality or meaning cannot be explained.
- The dictionary creates false authority or overconfident translations.
- Curation effort overwhelms the value of the experiment.

## Evidence and follow-up

No experiment has been recorded yet. Record observations using the [experiment format](../experiments/README.md) before changing this status.
