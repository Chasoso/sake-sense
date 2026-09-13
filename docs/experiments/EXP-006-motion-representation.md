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

1. the existing `BodyMovementFeatures` baseline;
2. deterministic extended trajectory, dynamics, rhythm, body-usage, and ending descriptors;
3. a compact normalized `MotionSignature` with simple temporal phases.

The harness uses synthetic, landmark-like pose sequences and reuses the existing extractor for the baseline. It is not imported by the capture UI or semantic bridge.

## Current status

Automated comparison and stability checks are provided by the experiment tests. On the 12 deterministic fixtures, the current coarse key produced 8 unique signatures (4 collision counts), while the v0 Motion Signature key produced 12 unique signatures (0 collision counts). This is a fixture result, not a claim of statistical or human-level discrimination: the fixtures and descriptor thresholds were designed together and still need human review.

## Representations compared

### A. Current `BodyMovementFeatures`

The baseline is the repository implementation itself, not a copy. It remains the production representation and is included in the comparison report so that duration, ending, spread, direction, repetition, participation, and speed behavior can be inspected per fixture.

### B. Extended descriptors

The experiment derives normalized trajectory shape/complexity/extent, mean and peak speed, speed variation, acceleration tendency, smoothness, repetition/pause/interval measures, amplitude trend, dominant joints, left/right asymmetry, participation extent, and ending decay. Numeric values are normalized by the first-frame shoulder width and shoulder-centered coordinates. Time is represented relative to the capture timestamps.

### C. `MotionSignature v0`

`MotionSignature` is a compact derived object containing the extended descriptor groups and at most four deterministic temporal phases. It contains no raw landmark arrays. The phase splitter uses low-speed pauses as boundaries, otherwise preserves a small number of activity regimes; it is deliberately heuristic and can miss overlapping or very subtle phases.

The repeatable report is available through `compareMotionRepresentations()` and `renderComparisonMarkdown()` in `src/experiments/motion-representation/report.ts`.

## Test gesture set and comparison

The fixture set covers large/small lateral sweeps, fingertip-only movement, wrist oscillation, circular and shrinking-circle paths, rapid outward expansion, slow expansion/return, fine tremor, a pause, fast-to-slow motion, and left/right asymmetry. The current-vs-signature collision summary is asserted by the experiment test and is regenerated from the fixtures rather than hand-entered.

The fingertip-only fixture is intentionally a limitation case: Pose-only input cannot observe articulation below the wrist, so a production decision about that distinction cannot be made from this harness.

## Noise and performance

Position shift, body-scale changes, timing based on capture-relative timestamps, and small landmark jitter are tested. Shoulder-relative normalization preserves path categories under translation/scale in the fixture test and keeps the circular path stable under small perturbation. This is a trade-off: aggressive normalization can remove absolute posture information that might be meaningful in another hypothesis.

The fixture uses 13 frames over approximately three seconds and eight representative joints. Descriptor work is O(frames × joints), with no unbounded history beyond the existing local capture. The signature is a small JSON object of scalar/category values and phases, suitable for local smartphone computation in principle. Actual iPhone-class responsiveness and human discrimination remain unmeasured and require the Human Experience Gate.

## Sensor findings and recommendation

Pose is sufficient for coarse shoulder/elbow/wrist trajectory, timing, and asymmetry experiments. It is not sufficient for fingertip movement, finger opening/closing, or reliable wrist rotation. MediaPipe Hands should remain a separate experiment if those distinctions matter; it is not added to production here.

**Decision: `revise` pending human review.** The fixture evidence supports investigating a selected normalized Motion Signature with temporal phases because it separates four fixture collisions that the baseline key collapses. It does not justify changing the production contract yet: descriptor thresholds are heuristic, the fixture set is synthetic, and real capture quality and intended human differences have not been evaluated. A follow-up should first validate the signature against recorded-but-local human examples, then select only descriptors that remain stable and interpretable.

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
