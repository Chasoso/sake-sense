# Body contour extraction spike (#79)

Status: focused architecture spike; Human Experience validation pending.

## Scope

This development-only spike evaluates whether a Pose Landmarker segmentation
confidence mask can provide a more stable ordered body contour than the former
centroid-angle ordering of thresholded boundary pixels. It does not replace the
production Body renderer, replay, waiting visual, feature extraction, or
semantic request path.

## Pipeline

The preview keeps the existing camera and mask panes and adds two contour panes:

```text
raw float mask
  -> marching-squares iso-contours
  -> largest polygon by absolute area
  -> Douglas-Peucker simplification (tolerance 0.8)
  -> one Chaikin-style spatial smoothing pass
  -> gold outline
```

- Raw mask values are the primary contour source; the thresholded mask remains
  visible only as a comparison diagnostic.
- `RAW_MASK_ISO_LEVEL` is `0.5`.
- No preprocessing blur is currently applied (`preprocessingMs` is reported as
  zero). This keeps thin limbs visible and makes raw-versus-final behavior easy
  to inspect before adding another variable.
- Multiple components are retained for diagnostics, while the component with
  the largest absolute polygon area is selected for the final preview.
- No centroid-angle sorting, temporal interpolation, optical flow, or external
  contour dependency is used.

## Shape behavior

Marching Squares follows local cell connectivity, so concave regions such as an
L-shape remain ordered around their local boundary instead of being connected
through a centroid. The final preview closes the selected polygon for drawing;
when a subject touches a frame edge, the mask's iso-contour follows that edge
and may be clipped by the frame rather than inventing a limb outside it.

The synthetic tests cover rectangles, concave regions, detached components,
deterministic ordering, simplification, smoothing, and input immutability.
Crossed arms, overlapping arms, upper-body crops, and edge movement remain
required manual scenarios because their quality depends on the actual MediaPipe
mask.

## Instrumentation

The development preview reports, per processed frame:

- Pose plus mask time and approximate FPS
- threshold, iso-contour, primary-selection, simplification, and smoothing time
- raw and final contour point counts

These are end-to-end diagnostic timings including canvas work and React metric
updates, not a standalone benchmark. Smartphone performance is still pending
maintainer verification. If contour processing approaches Pose plus mask time,
that is a finding for a later focused spike; this change does not introduce a
worker, WASM, OpenCV, or other large dependency.

## Privacy and semantic boundary

Mask values and contours remain transient in the browser. No camera frame,
mask, contour, or derived preview data is persisted, downloaded, uploaded, or
sent to AWS or the semantic bridge. `BodyPoseFrame[]` and
`extractBodyMovementFeatures()` are unchanged.

## Preliminary recommendation

**B. Promising, but needs another focused spike.**

Raw-mask iso-contours are a technically stronger basis than the former
centroid-angle boundary ordering, and the deterministic helper tests pass.
However, the recommendation is preliminary until a maintainer checks neutral,
arms-open, one-arm-up, crossed/overlapping arms, twist, partial framing, and
frame-edge movement on a smartphone. Do not adopt this contour pipeline in
production based on this spike alone.
