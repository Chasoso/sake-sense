# Body hybrid renderer spike (#83)

Status: focused architecture spike; Human Experience validation pending.

## Strategy

The dev-only segmentation preview keeps the stabilized segmentation contour as
the visible primary shape. Pose Landmarker landmarks provide a quiet structural
reference layer rather than replacing the contour or restoring a full skeleton:

```text
stabilized outer contour + selected inner contours
  -> optional low-opacity pose guidance
```

The current guidance uses the nose/ears as an anonymous head reference and the
shoulder, elbow, and wrist landmarks for independent left/right arm flow. A
shoulder line is included when both shoulders are visible. No dots, fingers,
face details, lower-body skeleton, or fabricated joints are drawn.

## Visibility and fallback

`HYBRID_POSE_MIN_VISIBILITY = 0.6` is a display-only threshold. Landmarks below
it are excluded. A full arm chain requires shoulder, elbow, and wrist; a
shoulder-to-elbow partial guide is allowed, but a missing wrist is never
invented. Each arm is independent, and no usable pose produces an empty guide
layer, leaving the contour-only rendering available.

The guide geometry is normalized to the same source coordinate system as the
contour canvas. It is generated per frame and is not added to
`BodyPoseFrame[]`, feature extraction, semantic requests, or persistent state.

## Comparison preview

The `?bodySegmentationSpike=1` development preview now includes:

- contour-only stabilized output (with inner contours)
- pose structure reference
- hybrid contour plus low-opacity pose guidance

The preview remains outside the camera controls and normal production flow.
Diagnostic metrics report guide generation time, guide count, valid full arm
chains, and visibility-qualified landmark count.

## Known risks and Human Experience

The primary questions are whether the guide improves head/arm and
shoulder/elbow/wrist readability without becoming a technical skeleton, and
whether current-frame pose jitter is noticeable against the stabilized contour.
The required neutral, open-arm, raised-arm, near-head, crossed/overlapping,
twisted, upper-body crop, and frame-edge scenarios remain maintainer checks.

## Preliminary recommendation

**B. Promising, but needs another focused spike.**

The implementation is suitable for direct comparison, but no production
renderer decision is made before Human Experience validation.

Arm guides now render explicit shoulder-to-elbow and elbow-to-wrist segments.
The previous single quadratic Bézier used the elbow only as a control point and
could therefore shortcut the anatomical waypoint; the revised geometry always
passes through the elbow. Partial shoulder-to-elbow chains retain the same
behavior without fabricating a wrist. The head ellipse remains a Human
Experience item and is intentionally unchanged in this revision.
