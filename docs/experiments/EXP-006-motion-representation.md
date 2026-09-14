# EXP-006 - Subtle body motion representation

- **Related issue:** [Issue #42](https://github.com/Chasoso/sake-sense/issues/42)
- **Date:** 2026-09-14
- **Owner of decision:** Human
- **Result:** pending

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

The harness uses synthetic, landmark-like pose sequences and reuses the existing extractor for the baseline. It is not imported by the capture UI or semantic bridge.

## Current status

Automated comparison and stability checks are provided by the experiment tests. The comparison now separates four levels:

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

The full current extractor retains frame/capture/active duration, movement totals, mean/peak speed, sustained-fast evidence, spread, meaningful-activity flag, active-joint count, ending ratio/behavior, and the complete current motion-shape categories. Numeric values are quantized at meaningful engineering tolerances, so small jitter is not automatically a new identity. On this fixture set it separates every fixture, even though the production coarse contract does not.

### C. Extended descriptors

The experiment derives normalized trajectory shape/complexity/extent, mean and peak speed, speed variation, acceleration tendency, smoothness, repetition/pause/interval measures, amplitude trend, dominant joints, left/right asymmetry, participation extent, and ending decay. Numeric values are normalized by the first-frame shoulder width and shoulder-centered coordinates. Time is represented relative to the capture timestamps.

### D. `MotionSignature v0`

`MotionSignature` is a compact derived object containing the extended descriptor groups and at most four deterministic temporal phases. It contains no raw landmark arrays. The phase splitter uses low-speed pauses as boundaries, otherwise preserves a small number of activity regimes; it is deliberately heuristic and can miss overlapping or very subtle phases.

The repeatable report is available through `compareMotionRepresentations()` and `renderComparisonMarkdown()` in `src/experiments/motion-representation/report.ts`. It includes unique counts, collision pairs, known-unobservable fixture count, and recovered observable distinctions.

## Real capture diagnostic path

In development builds, `BodyExperiment` sends the same local `capturedFrames` history to `createRealCaptureDiagnostics()`. The diagnostic branches are:

`captured BodyPoseFrame[] -> { BodyMovementFeatures, SensoryBridgeInput, ExtendedMotionDescriptors, MotionSignature }`

The current and diagnostic branches now share `analyzeBodyMovement()` from `src/domain/body.ts`. `extractBodyMovementFeatures()` returns the analysis result, while the dev-only diagnostic projects the same normalized-frame, joint, region, speed, ending, and motion-shape evidence into safe scalar/category fields. It no longer independently approximates production decisions. Extended descriptors and `MotionSignature` still analyze the same captured frames as separate experiment representations. The panel reports frame count/duration/estimated FPS, valid/invalid sample counts, current-threshold active joints, region activity, mean/median/p90 segment speed, fast-motion evidence, ending evidence, and production direction projections. It also reports diagnostic-only visibility statistics and what-if observable-only/upper-body speed and participation comparisons. Region observability and region activity are kept separate: `current` is production-equivalent, while `observableOnly` filters each segment to joints visible at both endpoints. `participationIfUnobservedIgnored` uses the visibility-filtered region activity, not production region activity. Neither diagnostic threshold changes current production participation. It contains no landmark arrays, images, video, audio, prompt, or network payload.

## Test gesture set and comparison

The fixture set covers large/small lateral sweeps, fingertip-only movement, wrist oscillation, circular and shrinking-circle paths, rapid outward expansion, slow expansion/return, fine tremor, a pause, fast-to-slow motion, and left/right asymmetry. The current-vs-signature collision summary is asserted by the experiment test and is regenerated from the fixtures rather than hand-entered.

The fingertip-only fixture is a limitation case, not a tiny wrist movement: all Pose wrist landmarks remain static. Pose therefore produces the same representation as a still hand, as it should; Motion Signature does not invent a distinction absent from the sensor input.

Path-shape fixtures distinguish straight one-way, straight out-and-back, ellipse/circle-like closure, an open curved arc, and lateral oscillation. Circular classification requires closed geometry, non-trivial enclosed-area/turn evidence, and consistent angular progression; start/end closure alone is insufficient. The out-and-back fixture is therefore not circular.

Temporal segmentation groups contiguous low-speed segments into one pause region and preserves the post-pause active phase. The pause fixture is represented as `active -> pause -> active`; the phase cap merges a short non-essential phase rather than truncating the beginning or ending.

Ending descriptors distinguish gradual deceleration, an abrupt stop after a fast final active segment, and continued movement at capture end. An inactive tail alone is not labeled gradual: progressive slowdown before the tail is required.

## Noise and performance

Position shift, body-scale changes, timing based on capture-relative timestamps, and small landmark jitter are tested. Shoulder-relative normalization preserves path categories under translation/scale in the fixture test and keeps the circular path stable under small perturbation. This is a trade-off: aggressive normalization can remove absolute posture information that might be meaningful in another hypothesis.

The fixture uses 13 frames over approximately three seconds and eight representative joints. Descriptor work is O(frames × joints), with no unbounded history beyond the existing local capture. The signature is a small JSON object of scalar/category values and phases, suitable for local smartphone computation in principle. Actual iPhone-class responsiveness and human discrimination remain unmeasured and require the Human Experience Gate.

## Sensor findings and recommendation

Pose is sufficient for coarse shoulder/elbow/wrist trajectory, timing, and asymmetry experiments. It is not sufficient for fingertip movement, finger opening/closing, or reliable wrist rotation. MediaPipe Hands should remain a separate experiment if those distinctions matter; it is not added to production here.

**Decision: `revise` pending human review.** The evidence supports a narrower conclusion: the production coarse contract loses six observable fixture pair distinctions, while the full current `BodyMovementFeatures` already retains those distinctions for this synthetic set. The extended descriptors and Motion Signature add useful path/phase diagnostics, but have not demonstrated additional discrimination beyond the full current extractor here. They correctly do not recover the unobservable fingertip case. This does not justify changing the production contract: thresholds are heuristic, the fixture set is synthetic, and real capture quality and intended human differences have not been evaluated. A follow-up should validate selected descriptors against recorded-but-local human examples before any production adoption.

## Real Capture Human Experience Gate

The first real-device review found a meaningful synthetic-to-real discrepancy. Reported examples included approximately 109–113 frames over three seconds, `activeJointCount: 33`, broad participation, and sustained-fast evidence even for small motion. A large lateral motion was reported as upward/contracting; small lateral motion was unknown/expanding. Circle and straight out-and-back were both repeated/expanding/broad at the production coarse layer. These are human-observed results, not new synthetic claims.

**Gate status: FAIL / more evidence required.** The mismatch means the synthetic 12/12 full-current result is insufficient to establish semantic correctness. Likely causes to investigate include MediaPipe jitter accumulation at higher frame density, low-visibility joints contributing to movement, all-landmark aggregation, camera-relative posture drift, normalization, and current thresholds. This experiment does not tune those thresholds or adopt Motion Signature for production.

The real-device capture was framed primarily on the upper body, yet the lower-body region was still reported as active. This strengthens the hypothesis that off-screen or low-visibility landmark estimates may contribute movement noise, but it is not yet proof: the new diagnostics must compare visibility, current activity, observable-only participation, and all-joint versus upper-body speed on additional captures. The diagnostic visibility threshold is an investigation aid only; it is not a production recommendation.

Use the following template when collecting dev-only diagnostic JSON from real capture:

| Gesture                | Expected distinction           | Current features | Production coarse | Extended descriptors | Motion Signature    | Pass/fail | Notes |
| ---------------------- | ------------------------------ | ---------------- | ----------------- | -------------------- | ------------------- | --------- | ----- |
| large lateral movement | lateral / broad                | paste summary    | paste coarse      | paste summary        | paste phases/shape  |           |       |
| small lateral movement | lateral / localized or unknown | paste summary    | paste coarse      | paste summary        | paste phases/shape  |           |       |
| circle                 | circular path                  | paste summary    | paste coarse      | paste shape          | paste shape/phases  |           |       |
| straight out-and-back  | out-and-back path              | paste summary    | paste coarse      | paste shape          | paste shape/phases  |           |       |
| gradual slowdown       | gradual ending                 | paste summary    | paste coarse      | paste ending         | paste ending/phases |           |       |
| movement with pause    | active/pause/active            | paste summary    | paste coarse      | paste rhythm         | paste phases        |           |       |

Production adoption remains pending until real-capture evidence is collected and reviewed by a human.

For the next capture review, compare current `activeJointCount` / participation / speed with observable joint count, observable active joints, observable regions, participation with unobserved regions ignored, and observable-only / upper-body-only speed. If the current result is broad/fast while the observability-aware result is localized/moderate, off-screen noise becomes a stronger hypothesis. This is a decision criterion, not a conclusion from the current fixture.

## Privacy, performance, and sensor boundary

All normalization and descriptor work is browser-local in principle and uses derived data only. No camera frame, video, raw landmark history, or hand landmark is uploaded. The implementation is intentionally pure and deterministic so it can be run in CI without a camera, AWS, or Bedrock.

Pose landmarks can describe shoulder, elbow, and wrist movement, but cannot reliably observe fingertip articulation, finger opening/closing, or fine wrist rotation. MediaPipe Hands is not added to production by this experiment; it remains a follow-up option if the comparison shows that Pose is insufficient.

## Human Experience Gate

- [ ] Review the generated fixture comparison and collision findings.
- [ ] Decide whether the richer representation preserves differences that people intend to express.
- [ ] Confirm that any future production representation remains understandable and privacy-safe.

No production semantic contract, prompt, AWS path, or Body capture behavior is changed by EXP-006.

## Follow-up

After human review, create a separate implementation Issue for any selected production descriptor. Do not send `MotionSignature` to the production semantic bridge as part of this experiment.