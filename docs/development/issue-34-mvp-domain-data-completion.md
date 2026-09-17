# Issue #34 MVP domain-data completion matrix

This matrix is a technical completion aid for the parent issue. Automated validation confirms structural integrity; the Human Experience Gate remains pending human review.

| Area                         | Current readiness               | Evidence                                                                             | Intentional gaps / human decision                                                           |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Vocabulary                   | Ready for MVP technical use     | 9 reviewed terms; 4 selectable and 5 reference-only; provenance validation           | Deferred terms remain out of the MVP model.                                                 |
| Sensory expressions          | Ready for experimental use      | 15 expression candidates with separate expression and term-link statuses             | Human review may merge or remove near-duplicate beginner expressions.                       |
| Body support                 | Ready for experimental fixtures | 7 explicit Body support cases and deterministic evaluator                            | Support cases are experimental, not scientific detection claims.                            |
| Voice support                | Limited experimental readiness  | 3 conservative Voice cases                                                           | Human review must decide whether Voice interpretation is useful enough to retain or expand. |
| Ishikawa product coverage    | Technically ready               | 32/32 brewery baseline, 33 provenance-backed records                                 | Coverage does not assert current availability or term evidence where absent.                |
| Provenance/integrity         | Ready                           | Schema, runtime, cross-layer validators, duplicate JSON-key guard                    | Validation verifies reviewable metadata, not source truth.                                  |
| Representative case coverage | Ready for human evaluation      | 11 cases covering fully mapped, partial, unmapped, ambiguous, and insufficient paths | UI/wording results are unreviewed.                                                          |
| Human Experience Gate        | Pending                         | [EXP-007](../experiments/EXP-007-mvp-human-experience-gate.md) checklist             | A human must record `keep`, `revise`, or `reject` plus notes.                               |

## Decision rule for closing #34

Technical work is ready when `npm run validate` passes and the representative cases remain structurally valid. A human must then complete EXP-007 and decide whether the remaining gaps are acceptable follow-ups or blockers. This matrix does not make that subjective decision automatically.
