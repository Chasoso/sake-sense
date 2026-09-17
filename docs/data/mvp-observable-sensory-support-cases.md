# MVP observable sensory support cases

Issue #47 records small, deterministic, experimental support cases between observable Body/Voice features and the beginner-facing expressions defined in Issue #46. The data is not a taste measurement, scientific claim, or direct feature-to-sake-term mapping.

```text
observable features
  -> experimental support case
  -> #46 sensory expression
  -> approved #46 term link only
  -> #45 curated vocabulary
```

The fixture provider evaluates only structured observations. It never receives raw video, pose frames, landmarks, audio, samples, transcription, or inferred emotion.

## Observable feature contract

Body observations are `duration`, `ending`, `expansion`, `direction`, `repetition`, `participation`, `spread`, and `speed`. They are derived locally by the existing Body feature extractor. Voice observations are only `durationMs`, `averageIntensity`, `pauseCount`, and `endingBehavior`.

## Support cases

| Case                                  | Modality | Feature pattern              | Expression                    | Downstream term       | Status       |
| ------------------------------------- | -------- | ---------------------------- | ----------------------------- | --------------------- | ------------ |
| body-short-abrupt-clean-fade          | Body     | short + abrupt               | clean-fade                    | kire (approved link)  | experimental |
| body-lingering-gradual-soft-settle    | Body     | lingering + gradual          | soft-settle                   | none (candidate link) | experimental |
| body-expanding-spreading-outward      | Body     | expanding                    | spreading-outward             | none (unmapped)       | experimental |
| body-lateral-repeated-wavering        | Body     | lateral + repeated           | wavering-continuous           | none (unmapped)       | experimental |
| body-sustained-fast-unmapped          | Body     | sustained-fast               | none                          | none                  | experimental |
| body-ambiguous-short-abrupt-expanding | Body     | short + abrupt + expanding   | ambiguous-mixed state         | none                  | experimental |
| body-insufficient-movement            | Body     | duration unknown             | insufficient-expression state | none                  | experimental |
| voice-long-fading-soft-settle         | Voice    | duration ≥701ms + fading     | soft-settle                   | none (candidate link) | experimental |
| voice-long-maintained-unmapped        | Voice    | duration ≥701ms + maintained | none                          | none                  | experimental |
| voice-insufficient-observation        | Voice    | duration 0                   | insufficient-expression state | none                  | experimental |

`ambiguous-mixed` and `insufficient-expression` remain system interpretation states, not expression IDs. Multiple matches are not resolved by dataset array order: an explicit, most-specific interpretation-state case wins; otherwise incompatible matched results become `ambiguous-mixed`.

## Boundaries and limitations

`clean-fade` can derive `kire` only by using the approved link in the expression dataset. `soft-settle` is a candidate link and therefore never creates `atoaji` automatically. `spreading-outward` and `wavering-continuous` are intentionally unmapped.

Broad or repeated lateral movement does not mean heavy, rich, or `nojun`; sustained-fast does not mean `kire` or `sanmi`. `unmapped` is a useful normal outcome. Voice support is deliberately narrow and experimental because the current local Voice features do not establish flavour or texture.

Human semantic and UX review is required before treating any support case as natural: short + abrupt wording, lingering + gradual wording, the distinction between `wavering-continuous` and `wave-like`, whether Voice expressions are natural, and whether unmapped results are understandable.
