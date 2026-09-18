# EXP-009 Production semantic grounding

## Purpose

The production semantic bridge may use a model to write cautious beginner-facing
language, but a model-returned selectable dictionary ID is not itself a valid
normal candidate. Candidate eligibility is reconstructed deterministically from
the reviewed MVP data:

```text
observable structured input
→ runtime-eligible support case
→ sensory expression
→ approved expression-to-term link
→ selectable candidate term
→ explicit product evidence
```

Only an `approved` expression link can produce a normal candidate term. A
`candidate` link and an `unmapped` expression remain termless. This is a policy
gate after model-response validation, not prompt tuning or a claim about taste.

## Response provenance contract

The production response separates the compact structured input from the outcome:

| Field                                         | Meaning                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `observedFeatures`                            | Every submitted derived feature, including explicit `unknown` values.                         |
| `interpretationEvidence`                      | Feature pattern from the reviewed case that selected an expression or state.                  |
| `unmappedFeatures`                            | Feature pattern from a matched explicit unmapped support case. It is not a copy of all input. |
| `unusedFeatures`                              | Observed features not used by either of those reviewed patterns.                              |
| `interpretationStateId`                       | A state such as `ambiguous-mixed` or `insufficient-expression`, never an expression.          |
| `groundingCaseIds` / `groundingExpressionIds` | Reviewed records used to derive the outcome.                                                  |

An unmapped case is neutral evidence: it does not veto a compatible expression
case. Explicit interpretation-state cases still take priority. When no support
case matches, all observed features are reported as unmapped and no candidate is
returned.

## Regression boundaries

- `clean-fade → kire` remains available only through its approved link.
- `soft-settle → atoaji` remains a candidate link and never becomes a normal
  candidate.
- Expanding or repeated lateral/broad input cannot promote an unsupported term
  or `nojun`.
- Ambiguous and insufficient outcomes have no normal candidate term.
- Product matching receives only post-gate candidate IDs, never raw model IDs.

## Human Experience review

The deterministic gate makes the data-policy boundary reviewable; it does not
decide whether a user-facing model expression is natural. Human review should
confirm that approved results are understandable, and that unmapped, ambiguous,
and insufficient outcomes do not appear as failures or unsupported taste claims.
