# EXP-006 - Subtle body motion representation

- **Related issue:** [Issue #42](https://github.com/Chasoso/sake-sense/issues/42)
- **Follow-up:** [Issue #44](https://github.com/Chasoso/sake-sense/issues/44)
- **Date:** 2026-09-14
- **Owner of decision:** Human
- **Result:** completed — production redesign required

## Decision

EXP-006 is complete as an architecture / experiment task.

The experiment does **not** recommend productionizing `MotionSignature v0` as a whole and does not recommend simply widening the current `BodyMovementFeatures` contract. Real-device captures showed that the current extractor is materially affected by off-screen / low-visibility Pose landmarks, all-landmark movement aggregation, frame-density-sensitive cumulative movement, and hip-dependent direction logic.

The recommended production direction is a new Body representation centered on **observable upper-body motion**, with wrist/arm trajectory descriptors retained locally and only compact derived semantics crossing the network boundary. Production implementation moves to Issue #44.

## Architecture under test

Current production path:

`Camera -> MediaPipe Pose -> BodyPoseFrame[] -> BodyMovementFeatures -> SensoryBridgeInput -> semantic bridge`

EXP-006 kept that production path unchanged and compared four representations from the same local capture history:

1. production coarse `SensoryBridgeInput`;
2. full current `BodyMovementFeatures`;
3. deterministic extended descriptors;
4. `MotionSignature v0` with bounded temporal phases.

A development-only diagnostic path also exposes the exact internal analysis used by `extractBodyMovementFeatures()` plus visibility / observability what-if summaries. Raw camera frames and raw landmark histories remain local.

## Synthetic comparison

On the 12 main synthetic fixtures, after meaningful quantization:

| Representation | Unique fixture keys | Interpretation |
| --- | ---: | --- |
| Production coarse contract | 8 / 12 | Several intended distinctions collide after categorical serialization. |
| Full current `BodyMovementFeatures` | 12 / 12 | Synthetic numeric features retain the fixture distinctions. |
| Extended descriptors | 12 / 12 | Adds trajectory, dynamics, rhythm, body-usage, and ending descriptors. |
| `MotionSignature v0` | 12 / 12 | Adds the same compact descriptor groups plus temporal phases. |

The synthetic 12/12 result did **not** establish real-capture semantic correctness. This became the central finding of the Human Experience Gate.

## Real-capture diagnostics

`BodyExperiment` sends the same local `BodyPoseFrame[]` to:

- current production analysis;
- production coarse serialization;
- extended descriptors;
- `MotionSignature v0`.

The diagnostic panel reuses `analyzeBodyMovement()` for production-equivalent evidence and additionally reports diagnostic-only observability summaries:

- per-joint visibility / observability;
- current vs observable-only region activity;
- current vs observable-only vs upper-body-only speed;
- participation with unobserved regions ignored;
- production direction evidence;
- expansion / repetition evidence.

The diagnostic visibility thresholds are investigation aids only. They do not alter production filtering or thresholds.

## Human Experience Gate

### Capture condition

Multiple real-device captures were performed at roughly 36–39 FPS over approximately three seconds. The most important repeated validation used **upper-body-only framing**: the lower body was not visible in the camera image.

### Reproduced current-extractor behavior

Across repeated upper-body-only captures, the current extractor continued to report patterns such as:

- `activeJointCount = 33`;
- lower-body region active even though the lower body was off-screen;
- `participation = broad`;
- `hasSustainedFastMovement = true`;
- direction unavailable when hips were not observable.

This behavior reproduced across more than one capture, so it is not treated as a one-off sample artifact.

### Off-screen landmark finding

Visibility-aware diagnostics strongly support the hypothesis that off-screen Pose estimates contaminate current movement aggregation.

In repeated upper-body-only captures:

- hips / knees / ankles / feet had near-zero or zero visible sample ratios;
- the same joints were still classified as currently active by the current extractor;
- current lower-body region activity was high;
- observable-only lower-body movement and active-segment counts dropped to zero.

One representative repeated capture showed:

- current lower-body activity ratio: about `0.99`;
- observable-only lower-body activity ratio: `0`;
- observable lower-body joint count: `0`.

This is strong evidence that the current all-landmark aggregation is treating off-screen landmark estimation jitter as real body motion.

### Speed finding

The relationship below reproduced across upper-body-only captures:

`current median speed > observable-only median speed > upper-body-only median speed`

Representative captures included approximately:

| Capture | Current median | Observable-only median | Upper-body-only median |
| --- | ---: | ---: | ---: |
| A | 0.0850 | 0.0419 | 0.0089 |
| B | 0.0982 | 0.0607 | 0.0154 |

The current fast threshold is `0.01`. Removing off-screen / irrelevant joints therefore materially reduces the speed estimate, but upper-body-only values can still cross the current threshold. Visibility filtering alone is therefore not a complete production fix; the speed definition itself should be redesigned to be representative and frame-rate robust.

### Active-joint finding

Visibility filtering explains only part of `activeJointCount = 33`.

Repeated captures showed roughly 23 observable joints, and nearly all observable joints were also considered active. Facial landmarks and other visible points accumulated enough movement over ~119 frames to exceed the current cumulative threshold.

Therefore two separate problems exist:

1. unobservable joints can be marked active;
2. cumulative movement over a dense three-second sequence makes many observable but semantically irrelevant joints active as well.

The current `activeJointCount` definition is not recommended as a production semantic feature without redesign.

### Participation finding

Visibility-aware filtering correctly removes the off-screen lower-body region, but `participationIfUnobservedIgnored` can still remain `broad` because both arms and the visible shoulder portion of the torso cross the current activity criteria.

Observable-only torso movement is substantially lower than current torso movement once invisible hips are removed, but incidental shoulder motion can still make the torso count as active.

Production participation should therefore be redesigned around **meaningful contribution**, not only active-region count. A candidate is torso contribution relative to intentional arm / wrist motion.

### Direction finding

The current direction path repeatedly produced:

- `orientation = null`;
- `selectedSource = none`;
- `dominantDirection = unknown`;

when hips were outside the frame.

This is a production-design limitation for Sake Sense because Body input should work with upper-body-only framing. Direction must have a fallback that can use observable arm / wrist trajectory without requiring hip-derived body orientation.

## Extended descriptor findings

Several extended trajectory / body-usage descriptors remained useful on real capture and are the strongest production candidates from EXP-006:

- wrist-centered `pathShape`;
- `dominantDirection`;
- `spatialExtent`;
- `dominantJoints`;
- left/right symmetry / asymmetry.

Examples of real captures produced coherent `oscillating` wrist trajectories and reasonable dominant-joint / symmetry distinctions while the current production direction was `unknown`.

These descriptors should be evaluated in Issue #44 as selected production candidates rather than adopting the full experiment representation.

## Motion Signature v0 findings

`MotionSignature v0` is **not** recommended for production as a whole.

The trajectory portion is useful because it shares the promising extended descriptors, but rhythm / phase behavior is not yet reliable on real capture. Repeated continuous movement could produce many pause detections and phase sequences dominated by `pause`; negative phase start timestamps were also observed around the capture origin.

Temporal phases may be revisited later, but they are not required for the next production Body representation.

## Pose vs Hands

Pose is sufficient for the next production iteration when the target is shoulder / elbow / wrist trajectory, extent, direction, and symmetry.

Pose alone is not sufficient for:

- fingertip articulation;
- finger opening / closing;
- reliable wrist rotation.

MediaPipe Hands should remain a separate follow-up experiment only if those distinctions become necessary. EXP-006 does not justify adding Hands to production now.

## Recommended production representation

Issue #44 should design the next Body representation around:

### Observable joints

Core candidates:

- left/right shoulder;
- left/right elbow;
- left/right wrist.

Optional reference:

- hips only when sufficiently observable.

Do not aggregate face, knees, ankles, feet, and other Pose points indiscriminately into semantic movement metrics.

### Trajectory

Prioritize:

- wrist-centered path shape;
- dominant direction;
- spatial extent;
- dominant / representative joint;
- symmetry / asymmetry.

### Dynamics

Replace all-landmark accumulated speed with a frame-rate-robust representative metric, such as dominant-joint or robust percentile / median speed normalized by time.

### Participation

Replace simple active-region counting with a measure of meaningful contribution, including observability and relative torso contribution.

### Direction

Support an upper-body-only fallback based on observable wrist / arm trajectory when body orientation cannot be derived from hips.

## Privacy boundary

The experiment confirms that useful distinctions can be derived locally without sending raw motion history to AWS / Bedrock.

Continue to keep the following local:

- camera frames;
- raw video;
- raw Pose landmark history;
- raw Hand landmark history;
- normalized landmark history.

Only compact derived semantic observations should cross the network boundary.

## Final Human Experience Gate

- **Experiment objective:** PASS — the experiment identified concrete information-loss / noise points and produced evidence for the next design.
- **Current production representation:** FAIL for reliable subtle Body interpretation on the tested real captures.
- **Motion Signature v0 as a whole:** FAIL for production adoption, mainly because rhythm / phases are not reliable enough.
- **Selected extended trajectory descriptors:** PROMISING — carry forward to the production redesign in Issue #44.
- **Privacy boundary:** PASS — no raw camera / landmark history needs to leave the browser.

This result means **production follow-up is required**, not that more diagnostic scope should be added to Issue #42.

## Follow-up

Production redesign is tracked in:

- #44 Redesign production Body representation around observable upper-body motion

Issue #42 should close when PR #43 is merged. No production semantic contract, Bedrock prompt, AWS path, or network privacy boundary is changed by EXP-006.