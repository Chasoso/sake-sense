# Experiment records

Experiment records preserve the link between a hypothesis, an implementation, technical verification, human experience, and the next decision. The human owns the final result: `keep`, `revise`, or `reject`.

## Template

```markdown
# EXP-<number> — <short name>

- **Related hypothesis:** [H00X](../hypotheses/README.md)
- **Date:** YYYY-MM-DD
- **Owner of decision:** Human
- **Result:** pending | keep | revise | reject

## What was built/tested

Describe the smallest experiment and its scope.

## Automated verification

List exact commands and results. Technical verification does not determine product usefulness.

## Human experience observations

Record what participants understood, enjoyed, found uncomfortable, or found useful. Include the local/demo context.

## Decision and learning

Explain why the human chose keep, revise, or reject and what changed in the hypothesis or specification.

## Follow-up Issues

Link the next Issue(s), if any.
```

Do not silently delete failed experiments. Keep concise records even when a hypothesis is rejected so future work does not repeat the same assumption.

## Records

- [EXP-003 - Whole-body movement tasting interface](EXP-003-body-expression.md)

- [EXP-001 — Sensory dictionary v0.1 research spike](EXP-001-sensory-dictionary-v0.1.md)
- [EXP-002 — Voice and richer expression](EXP-002-voice-richer-expression.md)
