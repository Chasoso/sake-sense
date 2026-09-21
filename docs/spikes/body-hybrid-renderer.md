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

The current hybrid pane uses pose only to derive internal arm-boundary
candidates. The visible result contains the stabilized outer contour and
selected inner contours, then retains only candidate boundary portions that
are inside the person mask and sufficiently far from the outer contour. This
keeps segmentation responsible for the external edge and avoids double lines.

The pose diagnostic pane still shows the earlier quiet shoulder/arm/head
reference for comparison, but the Hybrid pane no longer draws the shoulder
line, arm centerlines, or head ellipse.

## Visibility and fallback

`HYBRID_POSE_MIN_VISIBILITY = 0.6` is a display-only threshold. Landmarks below
it are excluded. A full arm chain requires shoulder, elbow, and wrist; a
shoulder-to-elbow partial guide is allowed, but a missing wrist is never
invented. Each arm is independent, and no usable pose produces an empty guide
layer, leaving the contour-only rendering available.

The guide geometry is normalized to the same source coordinate system as the
contour canvas. It is generated per frame and is not added to
`BodyPoseFrame[]`, feature extraction, semantic requests, or persistent state.

Upper-arm and forearm half-widths are named constants
(`HYBRID_UPPER_ARM_HALF_WIDTH = 0.025` and
`HYBRID_FOREARM_HALF_WIDTH = 0.02`). Candidate portions outside the binary
person mask are discarded, and portions within
`HYBRID_OUTER_CONTOUR_SUPPRESSION_DISTANCE = 0.025` of the outer contour are
suppressed. The retained internal boundary uses
`HYBRID_INTERNAL_BOUNDARY_OPACITY = 0.45` and a thinner line than the outer
contour.

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

Human Experience previously found visible centerlines and shoulder lines too
diagnostic. The focused revision therefore uses the pose centerline only for
candidate offset calculation; it is not drawn in Hybrid. The head ellipse is
also absent from Hybrid and remains a diagnostic-pane / Human Experience item.
