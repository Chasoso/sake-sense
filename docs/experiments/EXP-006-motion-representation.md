# EXP-006 - Subtle body motion representation

- **Related issue:** #42
- **Follow-up:** #44
- **Date:** 2026-09-14
- **Owner of decision:** Human
- **Result:** completed — production redesign required

## Decision

EXP-006 is complete as an architecture / experiment task.

Do not productionize `MotionSignature v0` as a whole.
Do not simply widen the current `BodyMovementFeatures` contract.

Real-device captures showed problems with:

- off-screen and low-visibility Pose landmarks;
- all-landmark movement aggregation;
- frame-density-sensitive cumulative movement;
- hip-dependent direction logic.

The recommended production direction is observable upper-body motion.
Production implementation moves to #44.

## Architecture under test

Current production path:

`Camera -> MediaPipe Pose -> BodyPoseFrame[] -> BodyMovementFeatures -> SensoryBridgeInput -> semantic bridge`

EXP-006 compared four representations from the same local capture history:

1. production coarse `SensoryBridgeInput`;
2. full current `BodyMovementFeatures`;
3. deterministic extended descriptors;
4. `MotionSignature v0` with bounded temporal phases.

The production network boundary was not changed.
Raw camera frames and raw landmark histories stayed local.

## Synthetic comparison

The 12 main synthetic fixtures produced these unique-key counts:

- Production coarse contract: 8 / 12.
- Full current `BodyMovementFeatures`: 12 / 12.
- Extended descriptors: 12 / 12.
- `MotionSignature v0`: 12 / 12.

The synthetic 12 / 12 result did not prove real-capture correctness.
That became the main finding of the Human Experience Gate.

## Real-capture diagnostics

The same local `BodyPoseFrame[]` is analyzed by:

- current production analysis;
- production coarse serialization;
- extended descriptors;
- `MotionSignature v0`.

The dev-only diagnostic also reports:

- per-joint visibility and observability;
- current and observable-only region activity;
- current, observable-only, and upper-body-only speed;
- participation with unobserved regions ignored;
- production direction evidence;
- expansion and repetition evidence.

The visibility thresholds are diagnostic aids only.
They do not change production filtering or thresholds.

## Human Experience Gate

### Capture condition

Multiple real-device captures ran at roughly 36–39 FPS.
Each capture lasted about three seconds.

The repeated validation used upper-body-only framing.
The lower body was not visible in the camera image.

### Reproduced current behavior

Across repeated upper-body-only captures, Current reported:

- `activeJointCount = 33`;
- lower-body activity while the lower body was off-screen;
- `participation = broad`;
- `hasSustainedFastMovement = true`;
- unavailable direction when hips were not observable.

The behavior reproduced across more than one capture.

### Off-screen landmark finding

The diagnostics strongly support off-screen Pose noise as a cause.

In repeated upper-body-only captures:

- hips, knees, ankles, and feet had near-zero visibility;
- the same joints could still be classified as active;
- current lower-body activity remained high;
- observable-only lower-body activity dropped to zero.

One repeated capture showed:

- current lower-body activity ratio: about `0.99`;
- observable-only lower-body activity ratio: `0`;
- observable lower-body joint count: `0`.

Current all-landmark aggregation can therefore treat estimation jitter
as real body motion.

### Speed finding

The following relationship reproduced:

`current > observable-only > upper-body-only`

Representative median-speed results were:

- Capture A: `0.0850 > 0.0419 > 0.0089`.
- Capture B: `0.0982 > 0.0607 > 0.0154`.

The current fast threshold is `0.01`.
Visibility filtering reduces speed materially but is not enough alone.
The production speed definition itself needs redesign.

### Active-joint finding

Visibility filtering explains only part of `activeJointCount = 33`.

Repeated captures showed about 23 observable joints.
Nearly all observable joints were also considered active.

Two separate problems exist:

1. unobservable joints can be marked active;
2. dense cumulative movement can activate irrelevant visible joints.

The current `activeJointCount` should not be carried forward unchanged.

### Participation finding

Visibility filtering removes the off-screen lower-body region.
Participation can still remain `broad`.

Visible shoulder motion can make the torso count as active.
Production participation should measure meaningful contribution.

A candidate is torso contribution relative to arm and wrist motion.

### Direction finding

When hips were outside the frame, Current repeatedly produced:

- `orientation = null`;
- `selectedSource = none`;
- `dominantDirection = unknown`.

Upper-body-only input therefore needs a wrist or arm trajectory fallback.

## Extended descriptor findings

The strongest real-capture production candidates are:

- wrist-centered `pathShape`;
- `dominantDirection`;
- `spatialExtent`;
- `dominantJoints`;
- left/right symmetry and asymmetry.

Real captures produced coherent `oscillating` wrist trajectories.
These descriptors move to #44 for production design.

## Motion Signature v0 findings

`MotionSignature v0` is not recommended as a whole.

Its trajectory portion is useful.
Its rhythm and phase behavior is not reliable enough yet.

Continuous motion could produce many pause detections.
Negative phase start timestamps were also observed.

Temporal phases are not required for the next production iteration.

## Pose vs Hands

Pose is sufficient for the next iteration when the target is:

- shoulder, elbow, and wrist trajectory;
- spatial extent;
- direction;
- symmetry.

Pose alone is not sufficient for:

- fingertip articulation;
- finger opening and closing;
- reliable wrist rotation.

Hands should remain a separate experiment if those details become needed.

## Recommended production representation

#44 should design the next Body representation around observable motion.

Core joint candidates:

- left and right shoulder;
- left and right elbow;
- left and right wrist.

Optional reference:

- hips only when sufficiently observable.

Do not aggregate face, knees, ankles, and feet indiscriminately.

Prioritize trajectory features:

- wrist-centered path shape;
- dominant direction;
- spatial extent;
- dominant or representative joint;
- symmetry and asymmetry.

Replace all-landmark accumulated speed with a frame-rate-robust metric.
Replace simple active-region counting with meaningful contribution.
Add an upper-body direction fallback when hips are unavailable.

## Privacy boundary

Continue to keep these local:

- camera frames;
- raw video;
- raw Pose landmark history;
- raw Hand landmark history;
- normalized landmark history.

Only compact derived semantic observations may cross the network boundary.

## Final Human Experience Gate

- **Experiment objective:** PASS.
- **Current production representation:** FAIL on tested real captures.
- **Motion Signature v0 as a whole:** FAIL for production adoption.
- **Selected trajectory descriptors:** PROMISING.
- **Privacy boundary:** PASS.

The experiment has enough evidence to stop adding diagnostic scope to #42.
Production follow-up is required instead.

## Follow-up

Production redesign is tracked in #44.

Issue #42 should close when PR #43 is merged.
EXP-006 does not change the production semantic contract, Bedrock, or AWS.