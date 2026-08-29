# H005 — Richer expression improves engagement

- **Status:** unvalidated
- **Owner of decision:** Human
- **Related experiment:** [EXP-002 — Voice and richer expression](../experiments/EXP-002-voice-richer-expression.md)

## Hypothesis

A user may find it more natural and engaging to express a sensation through voice and a richer free-form movement than through keyboard text plus a single plain stroke.

The value to test is not simply that more input modalities are better. The question is whether removing keyboard friction and making expression itself more playful improves comfort, perceived meaning, and willingness to repeat the interaction.

## Rationale and assumptions

EXP-001 human observations described keyboard input as cumbersome and a single line as too plain. These observations motivate testing a different input experience, but do not establish that voice or richer movement will be better. Browser microphone support, permission behavior, and personal comfort may vary.

## Experiment idea

Offer a voice-first local input path with a text fallback, together with a short free-form movement interaction. Keep the captured expression and deterministic movement/voice features inspectable, and compare the experience with the EXP-001 flow during human review.

## Success signals

- A user can begin without reaching for a keyboard.
- Voice input feels lower-friction than typing for a short sensory expression.
- Movement feels like meaningful expression rather than a decorative task.
- A user wants to try another expression or movement.
- A first-time user understands the interaction without lengthy explanation.

## Failure signals

- Voice interaction is more awkward than typing.
- Movement still feels arbitrary or disconnected from the result.
- More expressive input increases confusion without increasing interest.
- The user still experiences the interaction as a form rather than an experience.

## Evidence and follow-up

No EXP-002 human result has been recorded. The human decides `keep`, `revise`, or `reject` after review. Voice recognition compatibility and microphone permission behavior remain implementation limitations to observe.
