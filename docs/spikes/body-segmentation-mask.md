# Body segmentation mask spike (#77)

Status: architecture spike, Human Experience pending.

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

## Required human checks

The maintainer should run the preview with:

- neutral
- arms open
- one arm up
- asymmetric/twisted pose
- upper-body-only framing
- movement at the camera frame edge

Record whether arms and torso remain present, whether the boundary flickers,
and whether the main thread remains responsive during the existing capture.

## Initial finding

The installed API is compatible and the local-only preview is technically
available. Automated tests cover thresholding and deterministic boundary
extraction, but they cannot establish mask quality or smartphone performance.

Preliminary recommendation: **B — promising, but needs another focused
spike / Human Experience review before replacing the #76 renderer**.

Human Experience and smartphone performance are pending. In particular,
partial framing and edge-of-frame behavior must be observed before deciding
whether a segmentation-based renderer should proceed.
