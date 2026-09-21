# Body contour stabilization spike (#81)

Status: focused architecture spike; Human Experience validation pending.

## Display-only pipeline

The production Body representation and semantic path are unchanged. The
development segmentation preview now uses this presentation-only pipeline:

```text
raw ordered contour
  -> existing spatial simplification/smoothing
  -> 96-point closed arc-length resampling
  -> circular spatial averaging
  -> clockwise winding normalization
  -> cyclic start-index alignment to the previous displayed contour
  -> point-wise EMA temporal smoothing
  -> gold preview
```

`CONTOUR_RESAMPLE_POINT_COUNT` is `96`. Resampling does not duplicate the
closing point and does not mutate the source contour. Winding is normalized to
the screen-coordinate clockwise convention before correspondence is computed.

The additional spatial refinement is a one-pass circular moving average. Its
named radius is currently **`0` by default** after Human Experience showed that
radius `1` reduced shape fidelity: shoulders, neck transitions, and arm ends
became too rounded. When enabled for comparison, radius `1` gives previous and
next points weight `1` and the current point weight `2` (`0.25 / 0.5 / 0.25`
after normalization). It runs after fixed-count resampling and preserves the
96-point cardinality. The dev panes show Raw, Temporal-only, Spatial, and
Temporal-after-spatial results so jitter reduction and shape loss can be judged
separately.

This is deliberately conservative. A larger radius or another pass could round
away thin arms, shoulders, head shape, or torso indentation. Human Experience
confirmed that temporal stabilization reduced frame-to-frame jitter, while the
radius-1 spatial pass over-smoothed the silhouette. The next comparison is the
spatial-off default versus a weaker spatial setting; production adoption
remains pending.

## Temporal rules

- `CONTOUR_TEMPORAL_ALPHA` is `0.75`, so the displayed contour keeps most of
  the previous frame while following the current shape.
- Cyclic alignment checks every offset with a brute-force sum of squared point
  distances. At 96 points this is intentionally simple and deterministic.
- If the average aligned displacement exceeds
  `CONTOUR_DISCONTINUITY_DISTANCE` (`48` mask pixels), the display snaps to the
  current contour instead of producing visible lag.
- The first valid contour initializes directly.
- Missing contours are held for at most
  `CONTOUR_REACQUIRE_RESET_FRAME_COUNT` (`3`) frames, then the state resets.
- Capture start, camera prepare/restart, capture stop, landmarker teardown, and
  reacquisition loss reset the display state. Reacquisition initializes from
  the new contour rather than blending with stale geometry.

The preview exposes raw traced, spatially smoothed, and temporally stabilized
contours side by side, along with resampling, spatial averaging, winding,
alignment, temporal, reset, offset, correction-distance, FPS, and point-count
diagnostics.

Temporal stabilization itself is unchanged: the 96-point winding-normalized
contour is cyclically aligned, then smoothed with EMA alpha `0.75`, with the
existing missing-frame hold/reset and discontinuity snap rules.

## Performance and quality

Alignment is O(N²) with N=96 and is included in the existing development-only
metrics. The measurements include browser canvas and React metric-update work,
so they are diagnostic rather than a standalone benchmark. No worker, WASM,
OpenCV, optical flow, or mask-level temporal filter was added.

The synthetic tests cover fixed-count resampling, approximate arc-length
spacing, winding normalization, cyclic correspondence, EMA initialization and
movement, missing-frame hold/reset, deterministic output, and input
immutability. Smartphone behavior for stillness, deliberate movement,
frame-out, reacquisition, and difficult poses remains a maintainer check.

Known limitations are topology changes and ambiguous contour cells; this spike
does not add a tracker or attempt to infer body parts.

## Privacy and semantic boundary

Only transient derived contour points are used for the dev preview. Raw pose
frames, feature extraction, semantic requests, backend behavior, AWS calls, and
the production Body renderer are unchanged. No mask or contour is persisted or
uploaded.

## Preliminary recommendation

**B. Promising, but needs another focused spike.**

The deterministic pipeline is suitable for smartphone Human Experience review,
but production adoption remains pending evidence about stillness jitter,
quick-motion lag, topology changes, and frame-out/reacquisition behavior.
