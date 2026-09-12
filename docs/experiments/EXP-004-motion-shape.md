# EXP-004 - Richer body-motion shape representation

- **Related hypothesis:** [H009 - Richer body-motion shape improves perceived fidelity](../hypotheses/H009-richer-body-motion-shape-improves-fidelity.md)
- **Predecessor:** [EXP-003 - Whole-body movement tasting interface](EXP-003-body-expression.md)
- **Owner of decision:** Human
- **Result:** pending

## Working question

Can observable motion shape make body expression feel more faithful by distinguishing how a person moved, not only how much or how long they moved?

## EXP-003 learning

Pose tracking was visually working, and replay helped people understand the captured movement. However, different motions often collapsed into similar feature judgments. EXP-003 measured amount of movement more effectively than movement shape. This is recorded as human evidence, not as an automatic decision about H007 or H008.

## Selected observable features

EXP-004 adds four compact motion-level features:

| Feature                 | Deterministic observation                                                                                                             | Human-readable output                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Expansion / contraction | Signed change in mean wrist/elbow distance from the shoulder-centered torso reference across active frames                            | 「腕や身体が外へ広がる動きでした」 / 「身体の中心へ縮まる動きでした」 |
| Dominant direction      | Aggregate displacement of meaningfully moving joints, classified only as upward, downward, or lateral when one axis clearly dominates | 「上方向へ伸びる動きでした」など                                      |
| Repetition              | Direction reversals of the most active representative joint after a minimum movement threshold                                        | 「動きが何度か繰り返されました」                                      |
| Participation           | Active body-region ratio across left arm, right arm, torso, and lower-body groups                                                     | 「身体の一部を中心に動きました」 / 「上半身を広く使う動きでした」     |

Body-relative geometry still uses the per-frame shoulder midpoint/width normalization, which is useful for expansion, contraction, and relative joint motion. In parallel, whole-body translation is tracked from the shoulder-center trajectory relative to the first frame and divided by a stable median shoulder width. This prevents side-to-side sway from disappearing through per-frame recentering while keeping camera-distance sensitivity controlled. Tiny center changes below the named global-activity heuristic are ignored. Ambiguous or insufficient evidence remains `unknown`.

Whole-body center movement participates conservatively in activity, coarse direction, movement spread, and repetition. Relative and global signals are not blindly double-counted: the larger meaningful direction signal is used for the coarse direction description, while the center trajectory can become the representative path when it contains more movement. These remain experimental heuristics, not scientific measurements.

The existing EXP-003 features—capture/active duration, movement, speed, spread, active joints, and ending behavior—remain available. New motion-shape descriptions are presented separately from those aggregate features.

## Heuristic constants

The new constants are `BODY_MOTION_SHAPE_CHANGE_THRESHOLD = 0.15`, `BODY_MOTION_DIRECTION_THRESHOLD = 0.2`, `BODY_MOTION_DIRECTION_DOMINANCE_RATIO = 1.25`, `BODY_MOTION_REVERSAL_THRESHOLD = 0.08`, and `BODY_BROAD_PARTICIPATION_RATIO = 0.5`. They are inspectable experimental UI heuristics, not scientific thresholds.

## Intentionally omitted features

Curved-versus-straight trajectory is omitted because reliable representative-joint selection and curvature evidence would add noise to this prototype. Precise left/right semantics, body action classification, dominant direction beyond coarse axes, and audio/rhythm features are also out of scope.

## Intermediate representation and semantic bridge

The new motion shape is an observed motion-level representation, not a sake vocabulary. Expansion, direction, repetition, and participation are currently description-only and do not create new dictionary candidates. The existing EXP-003 broad-spread → `weight:light/heavy` mapping remains as a legacy experimental bridge for comparison, but it is not presented as proof that spread means weight. No authoritative dictionary semantics changed.

Existing duration, ending, and product matching behavior remains in the shared pipeline. Unsupported motion features remain unmapped rather than being forced into a sake term.

### Ending behavior boundary

Ending behavior describes an observed stop, not the end of the capture timer. The final active movement sequence is inspected together with the inactive tail that follows it. A high-speed active sequence followed by sufficient observed inactivity may be `abrupt`; a measured slowdown followed by inactivity may be `gradual`. If movement remains active through the final frame, the result is `continued`, meaning that stopping was not observed. Insufficient or noisy evidence remains `unknown`. Only `abrupt` and `gradual` enter the existing experimental sharp/round bridge; `continued` and `unknown` remain unmapped for shape.

The inactive-tail duration and the existing activity/speed ratios are named experimental heuristics. They are not scientific thresholds, and post-capture stillness is not treated as evidence of gradual slowing unless it is actually observed after the final active sequence.

### Pose-jitter boundary

Pose estimation jitter is not treated as intentional movement from a single peak or from capture-wide cumulative distance. The fast description requires a consecutive run of fast active segments and a minimum duration. Region participation requires repeated regional activity, while tiny or incoherent multi-joint jitter remains unclassified. A coherent localized movement can still be meaningful through its normalized spread, and whole-body sway continues to use the separate body-center trajectory. These activity, speed, and regional thresholds are experimental heuristics.

Human review also found that landmarks visibly move a little while the person is still. Before movement features are calculated, each normalized joint now uses a named experimental dead zone; displacements below it are carried forward from the previous filtered pose. Body-center movement keeps its separate whole-body threshold, so center translation is not removed by the joint filter. Static jitter should therefore produce no meaningful movement, while intentional small movement above the normalized dead zone remains available.

The body capture retry and next-capture paths explicitly clear the pose canvas after stopping replay/capture, so a previous skeleton is not mistaken for the new capture.

## Replay and privacy

EXP-003 replay is reused. It redraws the temporary `BodyPoseFrame[]` landmark sequence with original timestamps; it does not store or replay camera video. Retry and unmount clear the sequence. No upload, persistence, account/history storage, action-recognition model, face analysis, emotion inference, or cloud processing is added.

## Automated verification

Deterministic fixtures cover expansion, contraction, upward direction, localized/broad participation, repeated movement, tiny movement, unknown behavior, existing active-duration/ending/spread handling, body-to-language flow, product matching, and EXP-002 regressions. Run the repository standard validation before review.

## Human Experience Gate

Review camera allow/deny and replay first, then compare:

- both arms slowly opening outward;
- both arms drawing inward;
- one arm sweeping laterally;
- reaching upward;
- repeated side-to-side sway;
- short localized movement;
- broad upper-body movement;
- circular movement as an intentionally omitted/unknown case.

Check whether motion descriptions differ when they should, whether replay supports the description, whether any semantic bridge feels forced, whether explicit unmapped output is trustworthy, and whether the richer body experience feels less gimmicky without becoming a recommendation or diagnosis.

H007, H008, and H009 remain `pending` / `unvalidated`. The human owns all hypothesis decisions.
