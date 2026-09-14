# EXP-006 - Subtle body motion representation

- **Related issue:** [Issue #42](https://github.com/Chasoso/sake-sense/issues/42)
- **Follow-up:** [Issue #44](https://github.com/Chasoso/sake-sense/issues/44)
- **Date:** 2026-09-14
- **Owner of decision:** Human
- **Result:** completed — production redesign required

## Architecture note: current information flow

The current Body path is:

`Camera -> MediaPipe Pose -> captured BodyPoseFrame[] -> BodyMovementFeatures -> SensoryBridgeInput -> semantic bridge`

`BodyExperiment` keeps approximately three seconds of pose frames in a local ref. The same temporary frame history is copied into component state for local replay. `extractBodyMovementFeatures()` normalizes frames around the shoulder geometry, suppresses joint jitter, and reduces the history to duration, speed, spread, ending, participation, repetition, direction, and expansion categories. Only those derived observations are used by the production semantic bridge; raw frames, video, images, and landmarks are not sent.

The irreversible compression point is the conversion from the frame history to `BodyMovementFeatures`. Whole trajectories become dominant categories and scalar totals, temporal phases become active-duration/ending summaries, and joint-level contribution becomes active-joint/participation summaries. EXP-006 keeps that production representation unchanged and compares it locally with richer derived descriptors.

Raw pose frames remain local until capture/replay state is cleared. This experiment also keeps all fixture and derived data local; it does not extend the production request contract.

## What was built/tested

An experiment-only harness under `src/experiments/motion-representation/` compares:

1. the production coarse `SensoryBridgeInput` contract;
2. the full existing `BodyMovementFeatures` baseline;
3. deterministic extended trajectory, dynamics, rhythm, body-usage, and ending descriptors;
4. a compact normalized `MotionSignature` with simple temporal phases.

The harness uses synthetic, landmark-like pose sequences and reuses the existing extractor for the baseline. It is not imported by the semantic bridge.

## Current status

Automated comparison and stability checks are provided by the experiment tests. The comparison separates four levels:

| Representation                      | Unique fixture keys | Interpretation                                                                                    |
| ----------------------------------- | ------------------: | ------------------------------------------------------------------------------------------------- |
| Production coarse contract          |              8 / 12 | Six pairwise distinctions collide after categorical bridge serialization.                         |
| Full current `BodyMovementFeatures` |             12 / 12 | Numeric/current extractor fields retain these fixture distinctions after meaningful quantization. |
| Extended descriptors                |             12 / 12 | Adds path, dynamics, rhythm, body-usage, and ending descriptors.                                  |
| `MotionSignature v0`                |             12 / 12 | Adds the compact descriptor groups plus bounded temporal phases.                                  |

One fixture is intentionally known-unobservable (`fingertip-only-lateral`). It is not treated as a success case for richer discrimination. The six coarse collision pairs are `circular-movement/slow-expand-return`, `circular-movement/fine-tremor`, `shrinking-circle/pause`, `shrinking-circle/asymmetric-left-right`, `slow-expand-return/fine-tremor`, and `pause/asymmetric-left-right`. This is a deterministic fixture result, not statistical or human-level validation.

## Representations compared

### A. Production coarse contract

The production AI receives the categorical `SensoryBridgeInput` built by `buildSensoryBridgeInput()`: duration, ending, expansion, direction, repetition, participation, spread, and sustained-fast speed evidence. The comparison calls that real builder rather than reconstructing it.

### B. Full current `BodyMovementFeatures`

The full current extractor retains frame/capture/active duration, movement totals, mean/peak speed, sustained-fast evidence, spread, meaningful-activity flag, active-joint count, ending ratio/behavior, and the complete current motion-shape categories. Numeric values are quantized at meaningful engineering tolerances, so small jitter is not automatically a new identity. On the synthetic fixture set it separates every fixture, even though the production coarse contract does not.

### C. Extended descriptors

The experiment derives normalized trajectory shape/complexity/extent, mean and peak speed, speed variation, acceleration tendency, smoothness, repetition/pause/interval measures, amplitude trend, dominant joints, left/right asymmetry, participation extent, and ending decay. Numeric values are normalized by shoulder geometry and capture-relative timestamps.

### D. `MotionSignature v0`

`MotionSignature` is a compact derived object containing the extended descriptor groups and at most four deterministic temporal phases. It contains no raw landmark arrays. The phase splitter is deliberately heuristic.

The repeatable report is available through `compareMotionRepresentations()` and `renderComparisonMarkdown()` in `src/experiments/motion-representation/report.ts`. It includes unique counts, collision pairs, known-unobservable fixture count, and recovered observable distinctions.

## Real capture diagnostic path

In development builds, `BodyExperiment` sends the same local `capturedFrames` history to `createRealCaptureDiagnostics()`. The diagnostic branches are:

`captured BodyPoseFrame[] -> { BodyMovementFeatures, SensoryBridgeInput, ExtendedMotionDescriptors, MotionSignature }`

The current and diagnostic branches share `analyzeBodyMovement()` from `src/domain/body.ts`. `extractBodyMovementFeatures()` returns the analysis result, while the dev-only diagnostic projects the same normalized-frame, joint, region, speed, ending, and motion-shape evidence into safe scalar/category fields. It also reports diagnostic-only visibility statistics and current-vs-observable-only region and speed comparisons. Raw landmark arrays are not exported.

## Test gesture set and comparison

The fixture set covers large/small lateral sweeps, fingertip-only movement, wrist oscillation, circular and shrinking-circle paths, rapid outward expansion, slow expansion/return, fine tremor, a pause, fast-to-slow motion, and left/right asymmetry.

The fingertip-only fixture is a limitation case, not a tiny wrist movement: all Pose wrist landmarks remain static. Pose therefore produces the same representation as a still hand, as it should; Motion Signature does not invent a distinction absent from the sensor input.

Path-shape fixtures distinguish straight one-way, straight out-and-back, ellipse/circle-like closure, an open curved arc, and lateral oscillation. Circular classification requires closed geometry, non-trivial enclosed-area/turn evidence, and consistent angular progression; start/end closure alone is insufficient.

Temporal segmentation groups contiguous low-speed segments into one pause region in the synthetic fixture and preserves the post-pause active phase. Real capture later showed that this heuristic over-detects pauses and should not be promoted to production yet.

Ending descriptors distinguish gradual deceleration, an abrupt stop after a fast final active segment, and continued movement at capture end.

## Noise and performance

Position shift, body-scale changes, timing based on capture-relative timestamps, and small landmark jitter are tested. Shoulder-relative normalization preserves path categories under translation/scale in the fixture test and keeps the circular path stable under small perturbation.

The synthetic fixture uses 13 frames over approximately three seconds, while real-device capture produced roughly 36–39 FPS over the same duration. That density difference was important: real capture exposed accumulation and observability problems hidden by the synthetic set.

## Sensor findings and recommendation

Pose is sufficient for coarse shoulder/elbow/wrist trajectory and asymmetry experiments. It is not sufficient for fingertip movement, finger opening/closing, or reliable wrist rotation. MediaPipe Hands should remain a separate experiment if those distinctions become necessary; it is not added to production here.

**Decision: experiment complete; production redesign required.** The synthetic comparison showed where the coarse contract loses distinctions, while repeated real-device tests showed that the full current extractor is not a reliable production representation for subtle Body interpretation. Selected trajectory descriptors are promising, but `MotionSignature v0` as a whole is not recommended. Production redesign moves to Issue #44.

## Real Capture Human Experience Gate

Repeated real-device review found a stable synthetic-to-real discrepancy. Upper-body-only captures still produced `activeJointCount: 33`, broad participation, sustained-fast evidence, and high lower-body activity even though the lower body was not visible.

Visibility-aware diagnostics showed that hips, knees, ankles, and feet could have near-zero visibility while the current extractor still accumulated movement and marked them active. Observable-only lower-body activity dropped to zero in repeated upper-body-only captures. This strongly supports off-screen landmark estimation jitter as a real source of current movement inflation.

Speed showed the same pattern across repeated captures: `current median > observable-only median > upper-body-only median`. Representative measurements were approximately `0.0850 > 0.0419 > 0.0089` and `0.0982 > 0.0607 > 0.0154`. Visibility filtering materially reduces speed, but does not by itself define the correct production speed metric.

The current `activeJointCount` also remains problematic after visibility is considered because nearly all observable joints can cross the cumulative threshold over a dense three-second capture. Production should therefore use a semantically meaningful joint subset rather than all 33 Pose landmarks.

Visibility-aware participation removes the off-screen lower-body region, but can still remain broad because incidental shoulder activity makes the torso count as active. Production participation should represent meaningful contribution, such as torso contribution relative to arm/wrist motion.

Current direction repeatedly becomes unavailable when hips are outside the frame (`orientation = null`, `selectedSource = none`, `dominantDirection = unknown`). Upper-body-only input therefore needs a wrist/arm trajectory fallback.

Extended descriptors remained useful for wrist-centered `pathShape`, `dominantDirection`, `spatialExtent`, `dominantJoints`, and left/right symmetry/asymmetry. These are the strongest candidates to carry into Issue #44.

`MotionSignature v0` is not recommended as a whole. Its trajectory portion is useful, but rhythm / phase behavior over-detects pauses in real continuous motion and is not ready for production.

## Final Human Experience Gate

- [x] Review the generated fixture comparison and collision findings.
- [x] Compare repeated upper-body-only real captures with production-equivalent diagnostics.
- [x] Confirm off-screen / low-visibility landmark contamination is reproducible.
- [x] Identify selected richer descriptors worth carrying forward.
- [x] Confirm the raw camera / landmark privacy boundary remains unchanged.

Final assessment:

- **Experiment objective:** PASS.
- **Current production representation:** FAIL for the tested subtle real-capture use case.
- **Motion Signature v0 as a whole:** FAIL for production adoption.
- **Selected extended trajectory descriptors:** PROMISING.
- **Privacy boundary:** PASS.

This result means production follow-up is required, not that more diagnostic scope should be added to Issue #42.

## Privacy, performance, and sensor boundary

All normalization and descriptor work remains browser-local and uses derived data only. No camera frame, video, raw landmark history, or hand landmark is uploaded.

Pose landmarks can describe shoulder, elbow, and wrist movement, but cannot reliably observe fingertip articulation, finger opening/closing, or fine wrist rotation. MediaPipe Hands remains a follow-up option if those distinctions become necessary.

## Recommended production direction

Issue #44 should redesign Body representation around observable upper-body motion.

Core candidates are shoulders, elbows, and wrists. Hips should be used only when sufficiently observable. Production trajectory candidates are wrist-centered path shape, direction, spatial extent, dominant/representative joints, and symmetry/asymmetry.

All-landmark accumulated speed should be replaced with a frame-rate-robust representative metric. Participation should measure meaningful contribution rather than only active-region count. Direction should support an upper-body-only fallback when hip-derived orientation is unavailable.

## Follow-up

Production redesign is tracked in #44: **Redesign production Body representation around observable upper-body motion**.

Issue #42 should close when PR #43 is merged. No production semantic contract, prompt, AWS path, or Body network privacy boundary is changed by EXP-006.