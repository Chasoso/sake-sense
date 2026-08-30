# EXP-003 - Whole-body movement tasting interface

- **Related hypotheses:** [H007](../hypotheses/H007-body-expression-improves-engagement.md), [H008](../hypotheses/H008-body-to-sake-bridge-has-purpose.md)
- **Predecessors:** [EXP-002](EXP-002-voice-richer-expression.md), [Ishikawa sample](../data/ishikawa-sake-sample-v0.1.md)
- **Owner of decision:** Human
- **Result:** pending

## Working question

Does a short, local whole-body expression make the path from movement to sensory hints, sake language, and real Ishikawa sake feel more natural, engaging, and purposeful than EXP-002?

## What was built

EXP-003 adds a separate selectable local flow. It requests camera access, shows a mirrored preview, captures approximately three seconds of pose landmarks, draws a lightweight skeleton feedback layer, and extracts deterministic movement features. The existing pipeline is reused:

`body movement -> observable features -> existing sensory representation -> dictionary candidates -> provenance-backed Ishikawa sake`

The EXP-002 voice and free-form finger movement flow remains available from the mode switch.

## Pose technology and privacy

The prototype uses MediaPipe Tasks Vision Pose Landmarker (`@mediapipe/tasks-vision`, Apache-2.0) with one local pose. The WASM runtime and official lite model are loaded when camera mode starts; landmark inference runs in the browser. Camera frames and landmarks are kept only in memory for the active capture, are not uploaded or persisted, and are cleared on retry/reset. No face, emotion, age, gender, ethnicity, health, intoxication, or preference inference is performed.

If the browser cannot load the pose runtime/model, or camera permission is denied, the user can return to EXP-002. The model asset currently uses the official remote MediaPipe asset URL, so a fully offline deployment would need that asset packaged separately.

## Observable feature set

- Duration: elapsed capture time.
- Total movement and average/peak speed: summed normalized joint displacement over time.
- Spread: normalized spatial extent of observed landmarks.
- Active joint count: joints crossing a small movement threshold.
- Ending speed ratio and ending behavior: final-quarter speed compared with earlier median speed.

Landmarks are normalized around the shoulder midpoint and shoulder width. Features are calculated across consecutive pose frames only.

## Experimental mappings

| Observed movement           | Existing sensory hint | Status       |
| --------------------------- | --------------------- | ------------ |
| Short capture               | `duration:short`      | experimental |
| Sustained capture           | `duration:lingering`  | experimental |
| Abrupt ending               | `shape:sharp`         | experimental |
| Gradual ending              | `shape:round`         | experimental |
| Broad normalized spread     | `weight:heavy`        | experimental |
| Contained normalized spread | `weight:light`        | experimental |

These mappings reuse existing dictionary dimensions and are shown as experimental hints. They do not claim that the body detected taste. Dominant direction and other omitted signals are intentionally not assigned a sake meaning.

## Human-readable flow

The UI shows the body prompt, captured movement feedback, human-readable movement summaries, sensory hints, dictionary candidates, and source-backed Ishikawa sake examples. Candidate explanations, per-reference evidence strength, rationale, and official source links from EXP-002 remain visible. A missing product match is shown as a sample limitation rather than invented.

## Automated verification

Deterministic tests cover normalized body feature extraction, short/sustained movement, abrupt/gradual ending, invalid sequences, body-to-representation mapping, camera capability boundary, existing candidate/product matching, and EXP-002 regressions. Run `npm run validate` before review.

## Human Experience Gate

Human review is required. Try camera allow, deny, unavailable fallback, small hand movement, broad upper-body movement, short abrupt movement, long gradual movement, unusual/unmapped movement, retry/reset, and comparison with EXP-002. Check whether the movement feedback, feature-to-term reasoning, provenance-backed product connection, privacy wording, and non-recommendation framing are understandable.

H007 and H008 remain `unvalidated`; the human owns the eventual `keep`, `revise`, or `reject` decision.
