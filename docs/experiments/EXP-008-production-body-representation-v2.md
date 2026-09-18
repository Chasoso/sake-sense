# EXP-008 — Production Body representation v2

- Related issue: [#44](https://github.com/Chasoso/sake-sense/issues/44)
- Status: implemented; Human Experience review required

## Observable contract

The production Body extractor reduces locally captured Pose frames to compact,
derived observations. It does not send camera frames, video, raw landmarks, or
landmark history to the semantic bridge.

v2 treats only these visibility-qualified upper-body landmarks as movement
candidates:

- left/right shoulder
- left/right elbow
- left/right wrist

Hips are optional orientation references only. Face and lower-body landmarks
are not movement, speed, spread, participation, or active-joint evidence.
Each segment requires an observable landmark at both endpoints; a low-visibility
or off-screen landmark contributes nothing.

## Representation changes

- Motion and speed use a representative visible-joint distance per segment,
  rather than summing all Pose landmarks.
- Trajectory selection prefers visible wrists, then other arm joints. The local
  compact representation records path shape, spatial extent, dominant joints,
  and symmetry for inspection.
- Shoulder geometry supplies an upper-body direction fallback when hips are not
  observable.
- `broad` participation now requires meaningful contribution from both arms;
  incidental activity in arbitrary landmark regions cannot make it broad.

The existing categorical `BodyMovementFeatures` fields remain as the migration
surface for the current runtime. A capture without sufficient observable motion
returns the safe `unknown`/no-meaningful-movement outcome. It never falls back
to the former whole-body landmark aggregation.

## Regression boundaries

Automated coverage verifies that near-still captures with noisy, low-visibility
off-screen landmarks do not create active joints, duration, ending, broad
participation, or sustained-fast movement. It also verifies direction from a
visible wrist trajectory without hips.

This is an observable motion representation only. It does not establish a
Body-to-sake-term mapping or make a claim about a user's taste.

## Human Experience checklist

- [ ] Upper-body-only smartphone captures retain intended wrist direction.
- [ ] Near-still captures do not appear as continued or broad movement.
- [ ] Bilateral arm use versus a single-arm gesture is understandable in the
      localized/broad presentation.
- [ ] The compact/extended trajectory descriptions remain useful without
      implying a sake-term conclusion.
- [ ] Frame-rate changes do not make the same visible motion feel faster.

## Follow-up boundaries

- Fine finger articulation, wrist rotation, and hand openness remain outside
  Pose and require a separate Hands experiment if needed.
- Semantic grounding and production AI treatment of unmapped observations are
  outside this representation change.
