# Body segmentation mask spike (#77)

Status: architecture spike complete; Human Experience completed.

## API compatibility

The repository uses `@mediapipe/tasks-vision` `1.0.1`. Its installed type
definitions expose the Pose Landmarker segmentation path used by this spike:

- `PoseLandmarkerOptions.outputSegmentationMasks`
- `PoseLandmarkerResult.segmentationMasks`
- `MPMask.width`, `MPMask.height`, and `MPMask.getAsFloat32Array()`
- `PoseLandmarkerResult.close()` for releasing returned mask resources

The normal `createBodyPoseLandmarker()` factory remains mask-free. The spike
uses a separate factory and is enabled only in development with
`?bodySegmentationSpike=1`.

## Preview

While the query flag is active, the existing Body camera view adds four
development-only panes for the same detected frame:

1. Camera
2. Raw float mask rendered as grayscale
3. Binary mask using `SEGMENTATION_THRESHOLD = 0.5`
4. Gold boundary contour on a dark green background

Boundary extraction is intentionally lightweight: exposed foreground pixels
are collected and ordered around their centroid. No production contour
algorithm, temporal reconstruction, or new vision dependency is included.

## Privacy and semantic boundary

Mask values are read and rendered in the current frame only. No raw frame,
mask, or contour is persisted, downloaded, uploaded, or passed to the
semantic bridge. `BodyPoseFrame[]` and `extractBodyMovementFeatures()` remain
unchanged. The returned MediaPipe result is closed after its values are read.

## Human Experience result

Maintainer Human Experience testing is complete for the spike scenarios,
including neutral, arms open, one arm up, asymmetric/twisted movement,
upper-body-only framing, and movement near the camera frame edge.

The segmentation mask itself was judged **promising**:

- the visible head, torso, and arms were retained well enough to justify
  continuing with a segmentation-based Body outline direction;
- the raw mask provides a materially better basis for body thickness and
  external silhouette than the landmark-width heuristic explored in #72 / PR #76;
- the dev-only preview remained responsive enough for this feasibility spike;
- no privacy or semantic boundary needs to change.

The current Gold contour is **not** suitable as the final contour algorithm.
Its centroid-angle boundary ordering produces shortcut / fan-like artifacts on
concave human shapes. That limitation is isolated from mask feasibility and is
tracked separately in #79.

Performance numbers shown by the development preview should be treated as
end-to-end diagnostic values rather than a pure Pose Landmarker benchmark,
because the preview also performs canvas drawing and React metric updates.

## Finding

Recommendation: **proceed with segmentation-based contour research**.

#77 establishes that Pose Landmarker segmentation masks are a viable foundation
for further Body visual work. The next focused step is #79, which evaluates
true ordered contour extraction and lightweight smoothing, preferably using
the raw probability mask as the source rather than treating the current
thresholded-pixel contour as production quality.

This spike does not replace the production Body renderer.
