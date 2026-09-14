# EXP-006 - Subtle body motion representation

- **Related issue:** [Issue #42](https://github.com/Chasoso/sake-sense/issues/42)
- **Date:** 2026-09-14
- **Owner of decision:** Human
- **Result:** completed — production redesign required
- **Experiment objective:** PASS
- **Current production representation:** FAIL for tested subtle real-capture Body interpretation
- **Motion Signature v0 as a whole:** FAIL for production adoption
- **Selected extended trajectory descriptors:** PROMISING
- **Privacy boundary:** PASS

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

The fixture uses 13 frames over approximately three seconds and eight representative joints. Descriptor work is O(frames × joints), with no unbounded history beyond the existing local capture. The signature is a small JSON object of scalar/category values and phases, suitable for local smartphone computation in principle. Human discrimination was assessed through the completed real-capture gate; device-specific performance benchmarking remains a follow-up implementation concern.

## Sensor findings and recommendation

Pose is sufficient for coarse shoulder/elbow/wrist trajectory, timing, and asymmetry experiments. It is not sufficient for fingertip movement, finger opening/closing, or reliable wrist rotation. MediaPipe Hands should remain a separate experiment if those distinctions matter; it is not added to production here.

**Decision: `completed — production redesign required`.** The experiment objective passed: the harness, production-equivalent diagnostics, synthetic comparisons, and repeated real-capture comparisons answered where information is lost. The current production representation fails for the tested subtle real-capture Body interpretation. Selected extended trajectory descriptors are promising, but Motion Signature v0 as a whole is not a production candidate. Issue [#44](https://github.com/Chasoso/sake-sense/issues/44) owns the production redesign and implementation.

## Real Capture Human Experience Gate

Repeated real-device tests used upper-body-only framing and found a reproducible synthetic-to-real discrepancy. Captures were approximately 109–113 frames over three seconds. Small motion could produce `activeJointCount: 33`, broad participation, and sustained-fast evidence. A large lateral motion was reported as upward/contracting; small lateral motion was unknown/expanding. Circle and straight out-and-back were both repeated/expanding/broad at the production coarse layer.

**Gate status: complete for EXP-006; production gate: FAIL.** The completed checks covered repeated upper-body-only captures, current vs observable-only comparison, lower-body off-screen noise reproduction, speed comparison, selected extended descriptors, and the privacy boundary. The synthetic 12/12 full-current result was insufficient to establish semantic correctness. Likely causes include MediaPipe jitter accumulation at higher frame density, low-visibility joints contributing to movement, all-landmark aggregation, camera-relative posture drift, normalization, and current thresholds. No threshold was tuned and no Motion Signature was adopted for production.

### Final real-capture findings

- **Off-screen landmarks:** with upper-body-only framing, current lower-body activity was approximately 1 and lower-body joints were active, while observable lower-body joint count was 0 and observable-only lower-body activity was 0. This is strong evidence that off-screen Pose estimates are entering current movement accumulation.
- **Speed:** multiple captures reproduced `current median > observable-only median > upper-body-only median`, including `0.0850 > 0.0419 > 0.0089` and `0.0982 > 0.0607 > 0.0154`. Visibility filtering alone is therefore insufficient; the speed definition also needs redesign.
- **Active joints:** current `activeJointCount = 33`. Even after excluding unobservable joints in the diagnostic view, many visible facial/upper-body landmarks remain active. Cumulative thresholding and all-landmark aggregation need review.
- **Participation:** lower-body noise removal can still leave `broad`, so simple active-region counting is not a sufficient meaningful-contribution measure.
- **Direction:** when hips are not observable, orientation can be null, the selected projection can be `none`, and direction becomes `unknown`. The next production design needs an upper-body trajectory fallback.

Use the following template when collecting dev-only diagnostic JSON from real capture:

| Gesture                | Expected distinction           | Current features | Production coarse | Extended descriptors | Motion Signature    | Pass/fail | Notes |
| ---------------------- | ------------------------------ | ---------------- | ----------------- | -------------------- | ------------------- | --------- | ----- |
| large lateral movement | lateral / broad                | paste summary    | paste coarse      | paste summary        | paste phases/shape  |           |       |
| small lateral movement | lateral / localized or unknown | paste summary    | paste coarse      | paste summary        | paste phases/shape  |           |       |
| circle                 | circular path                  | paste summary    | paste coarse      | paste shape          | paste shape/phases  |           |       |
| straight out-and-back  | out-and-back path              | paste summary    | paste coarse      | paste shape          | paste shape/phases  |           |       |
| gradual slowdown       | gradual ending                 | paste summary    | paste coarse      | paste ending         | paste ending/phases |           |       |
| movement with pause    | active/pause/active            | paste summary    | paste coarse      | paste rhythm         | paste phases        |           |       |

The EXP-006 production recommendation is now recorded, not pending: redesign the production representation in [Issue #44](https://github.com/Chasoso/sake-sense/issues/44). The diagnostic comparison remains useful as evidence for that implementation work.

## Privacy, performance, and sensor boundary

All normalization and descriptor work is browser-local in principle and uses derived data only. No camera frame, video, raw landmark history, or hand landmark is uploaded. The implementation is intentionally pure and deterministic so it can be run in CI without a camera, AWS, or Bedrock.

Pose landmarks can describe shoulder, elbow, and wrist movement, but cannot reliably observe fingertip articulation, finger opening/closing, or fine wrist rotation. MediaPipe Hands is not added to production by this experiment; it remains a follow-up option if the comparison shows that Pose is insufficient.

## Human Experience Gate

- [x] Review the generated fixture comparison and collision findings.
- [x] Run repeated upper-body-only real captures and compare current, observable-only, and upper-body-only evidence.
- [x] Reproduce lower-body off-screen activity and confirm the privacy boundary.
- [x] Review selected extended trajectory descriptors and reject Motion Signature v0 as a whole for production adoption.
- [x] Confirm that the production redesign must be handled separately from this experiment.

No production semantic contract, prompt, AWS path, or Body capture behavior is changed by EXP-006.

## Follow-up

- [Issue #44 — production Body representation redesign](https://github.com/Chasoso/sake-sense/issues/44) owns the implementation work.
- #42 is the completed Architecture / Experiment investigation; #44 is the Production redesign / implementation follow-up.
- Candidate direction for #44: shoulders/elbows/wrists as core joints, hips only when observable, wrist-centered trajectory shape, spatial extent, robust time-normalized representative-joint dynamics, meaningful contribution, observable regions, and an upper-body direction fallback.
- Pose is sufficient for the next iteration of shoulder, elbow, wrist trajectory, extent, direction, and symmetry. Pose is insufficient for fingertip articulation, finger open/close, and reliable wrist rotation; MediaPipe Hands remains out of production scope.
- Do not send `MotionSignature` v0 to the production semantic bridge.
