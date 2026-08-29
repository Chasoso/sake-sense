# H004 — Human feedback can improve the dictionary later

- **Status:** unvalidated
- **Owner of decision:** Human

## Hypothesis

A future system may improve a sensory dictionary using lightweight human feedback, such as whether a translation feels right, but this is not required for the first prototype.

## Rationale and assumptions

Simple feedback could reveal where mappings are confusing or unhelpful. It may also introduce bias, false confidence, privacy concerns, or incentives to optimize for agreement rather than usefulness. The first prototype should not depend on learning from feedback.

## Experiment idea

After a grounded mapping experience exists, collect optional, clearly contextualized feedback and inspect it manually before considering any automated update.

## Success signals

- Participants can give useful feedback without being led toward an answer.
- Feedback reveals actionable ambiguity or missing vocabulary.
- A human can explain how feedback would change a mapping.

## Failure signals

- Feedback is too vague, sparse, or biased to guide a change.
- Participants interpret a provisional result as authoritative.
- Feedback collection adds burden without improving the experience.

## Evidence and follow-up

No experiment has been recorded yet. Record observations using the [experiment format](../experiments/README.md) before changing this status.
