# Issue #34 MVP domain-data completion matrix

This matrix is a technical completion aid for the parent issue. Automated validation confirms structural integrity; representative Human Experience evaluation has been completed and identified follow-up work.

| Area                         | Current readiness               | Evidence                                                                             | Intentional gaps / human decision                                                                |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Vocabulary                   | Ready for MVP technical use     | 9 reviewed terms; 4 selectable and 5 reference-only; provenance validation           | Deferred terms remain out of the MVP model.                                                      |
| Sensory expressions          | Ready for experimental use      | 15 expression candidates with separate expression and term-link statuses             | Human review may merge or remove near-duplicate beginner expressions.                            |
| Body support                 | Ready for experimental fixtures | 7 explicit Body support cases and deterministic evaluator                            | Support cases are experimental, not scientific detection claims.                                 |
| Voice support                | Limited experimental readiness  | 3 conservative Voice cases                                                           | Human review must decide whether Voice interpretation is useful enough to retain or expand.      |
| Ishikawa product coverage    | Technically ready               | 32/32 brewery baseline, 33 provenance-backed records                                 | Coverage does not assert current availability or term evidence where absent.                     |
| Provenance/integrity         | Ready                           | Schema, runtime, cross-layer validators, duplicate JSON-key guard                    | Validation verifies reviewable metadata, not source truth.                                       |
| Representative case coverage | Human evaluation completed      | 11 cases covering fully mapped, partial, unmapped, ambiguous, and insufficient paths | Individual `keep` / `revise` results and observations are recorded in EXP-007.                   |
| Human Experience Gate        | Completed with follow-up issues | [EXP-007](../experiments/EXP-007-mvp-human-experience-gate.md) results and checklist | #44 (Body observation/motion representation) and #59 (production semantic grounding/provenance). |

## Decision rule for closing #34

`npm run validate` passes and the representative cases remain structurally valid, and the Human Experience evaluation has been recorded in EXP-007. However, #34 is **not ready to close**: the remaining blockers/follow-ups are #44 for Body observation quality and #59 for production semantic grounding and unmapped-feature provenance. A human must decide when those follow-ups are resolved or explicitly acceptable for closure.
