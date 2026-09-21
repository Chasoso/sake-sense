# Body inner contours spike (#84)

Status: focused architecture spike; Human Experience validation pending.

## Detection method

This development-only preview detects negative space from the thresholded
binary segmentation mask:

```text
thresholded foreground mask
  -> 4-neighbor foreground component labeling
  -> select largest component as the primary person
  -> create a primary-person-only mask
  -> 4-neighbor flood fill of background in that mask
  -> discard components touching the frame border
  -> area filter
  -> temporary component mask
  -> existing Marching Squares iso-contour extraction
  -> restrained inner outline
```

The binary source is the existing `thresholdSegmentationMask()` output. The
largest 4-neighbor foreground component is the primary person for this
one-person spike. Hole detection runs only on a temporary mask containing that
component, so a detached foreground noise ring cannot contribute a false
person hole. The default `INNER_CONTOUR_MIN_AREA` is `24` pixels.
Border-connected background is never treated as a hole, and multiple enclosed
components inside the primary person are supported. The component pixel lists
are transient helper data only.

Inner contours reuse the existing deterministic Marching Squares implementation;
centroid-angle sorting is not reintroduced. The outer contour remains the
primary visual. Inner contours use the same gold family at
`INNER_CONTOUR_OPACITY = 0.7` and `INNER_CONTOUR_LINE_WIDTH_SCALE = 0.7`, with
no fills, dots, skeleton overlay, or pose-specific synthetic gaps.

## Preview and temporal behavior

The dev-only preview adds a detected-inner-contours pane and overlays accepted
inner contours on the final outer contour. Inner contours are currently
rendered per frame without persistent identity tracking or optical flow. This
keeps the spike small and makes flicker, tiny-hole noise, head/arm separation,
armpit gaps, and arm/torso gaps directly observable.

The existing outer contour stabilization and production semantic path are
unchanged. Inner contour detection is not sent to the semantic bridge and does
not alter `BodyPoseFrame[]`, feature extraction, capture semantics, or the
production renderer.

Multi-person subject selection is out of scope for this spike and remains part
of the separate #74 scope; largest-component selection is intentionally the
only primary-subject rule here.

## Performance and known risks

The preview reports hole detection, filtering, and inner-contour extraction
times, foreground component count/time, accepted hole count, and accepted area alongside the existing Pose/mask
and outer-contour metrics. No new dependency is used. The main risks are
frame-to-frame flicker from changing mask topology, holes that disappear under
segmentation noise, and visual clutter when several meaningful gaps coexist.
Smartphone performance and the required scenarios—neutral, raised arms,
bent/crossed/overlapping arms, upper-body crop, and frame-edge movement—remain
maintainer checks.

## Preliminary recommendation

**B. Promising, but needs another focused spike.**

The deterministic hole pipeline is suitable for Human Experience comparison,
but production adoption should wait until maintainers confirm that inner
contours improve head/arm and arm/torso readability without excessive flicker
or clutter.
