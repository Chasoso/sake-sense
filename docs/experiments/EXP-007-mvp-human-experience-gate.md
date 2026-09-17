# EXP-007: MVP Human Experience gate

This document prepares a human review of the assembled MVP flow. It does not validate subjective quality automatically and does not change the vocabulary, expression, support-case, or product datasets.

## Representative cases

| Case                                               | Modality/setup                                  | Expected expression | Expected term | Expected product                                 | Outcome                 |
| -------------------------------------------------- | ----------------------------------------------- | ------------------- | ------------- | ------------------------------------------------ | ----------------------- |
| body-short-abrupt-to-kire-product                  | Body: short + abrupt                            | clean-fade          | kire          | 加賀鳶 いかづち 一閃 (`kagatobi-ikazuchi-issen`) | fully mapped            |
| body-lingering-gradual-expression-only             | Body: lingering + gradual                       | soft-settle         | none          | none                                             | expression only         |
| body-expanding-unmapped-expression                 | Body: expanding                                 | spreading-outward   | none          | none                                             | expression only         |
| body-lateral-repeated-broad-no-nojun               | Body: lateral + repeated + broad                | wavering-continuous | none          | none                                             | expression only         |
| body-sustained-fast-unmapped                       | Body: sustained-fast                            | none                | none          | none                                             | unmapped                |
| body-short-abrupt-expanding-ambiguous              | Body: short + abrupt + expanding                | none                | none          | none                                             | ambiguous-mixed         |
| body-insufficient-movement                         | Body: no meaningful movement                    | none                | none          | none                                             | insufficient-expression |
| voice-long-fading-expression-only                  | Voice: long + fading                            | soft-settle         | none          | none                                             | expression only         |
| voice-long-maintained-unmapped                     | Voice: long + maintained                        | none                | none          | none                                             | unmapped                |
| voice-insufficient-observation                     | Voice: duration 0                               | none                | none          | none                                             | insufficient-expression |
| expression-rounded-enveloping-term-without-product | Existing expression review, not feature support | rounded-enveloping  | marui         | none currently renderable                        | term without product    |

The `expression-review` case deliberately does not claim any new Body/Voice feature → expression rule. It verifies the valid downstream partial path already represented by the domain data.

## Real local UI checklist

Start the local UI with `npm run dev`. For each case, reproduce the listed observation when possible, or use its deterministic fixture setup in the developer tools/tests to confirm technical behavior. Record one human-owned result and a note; do not pre-fill it.

| Case                                               | Observation description accurate? | Expression understandable? | Vocabulary step reasonable? | Evidence/product understandable? | Outcome (`keep` / `revise` / `reject`) | Note |
| -------------------------------------------------- | --------------------------------- | -------------------------- | --------------------------- | -------------------------------- | -------------------------------------- | ---- |
| body-short-abrupt-to-kire-product                  | [ ]                               | [ ]                        | [ ]                         | [ ]                              |                                        |      |
| body-lingering-gradual-expression-only             | [ ]                               | [ ]                        | [ ]                         | n/a                              |                                        |      |
| body-expanding-unmapped-expression                 | [ ]                               | [ ]                        | n/a                         | n/a                              |                                        |      |
| body-lateral-repeated-broad-no-nojun               | [ ]                               | [ ]                        | n/a                         | n/a                              |                                        |      |
| body-sustained-fast-unmapped                       | [ ]                               | n/a                        | n/a                         | n/a                              |                                        |      |
| body-short-abrupt-expanding-ambiguous              | [ ]                               | [ ]                        | n/a                         | n/a                              |                                        |      |
| body-insufficient-movement                         | [ ]                               | n/a                        | n/a                         | n/a                              |                                        |      |
| voice-long-fading-expression-only                  | [ ]                               | [ ]                        | n/a                         | n/a                              |                                        |      |
| voice-long-maintained-unmapped                     | [ ]                               | n/a                        | n/a                         | n/a                              |                                        |      |
| voice-insufficient-observation                     | [ ]                               | n/a                        | n/a                         | n/a                              |                                        |      |
| expression-rounded-enveloping-term-without-product | n/a                               | [ ]                        | [ ]                         | [ ]                              |                                        |      |

### Recorded Body observations (human input)

These are recorded Human Experience observations, not changes to the experimental support cases, sensory-expression dataset, term links, or product evidence.

| Reproduced observation             | Human-described result                                                       | Existing representative case             | Follow-up note                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 短く動いて、ピタッと止める         | 今回の動きからは、無理なく対応できる日本酒の言葉はまだ見つかりませんでした。 | `body-short-abrupt-to-kire-product`      | The current fixture reaches `clean-fade` → `kire`; retain this contrast for Human Experience review without changing the support rule. |
| ゆっくり長めに動いて、徐々に止める | 飲み込んだ後に広がり続く感覚 / あと味                                        | `body-lingering-gradual-expression-only` | The current fixture stops at `soft-settle`; record the observed `atoaji` wording without promoting it to a mapping.                    |
| 両手などを外側へ広げる             | 飲み込んだ後に広がり続く感覚 / あと味                                        | `body-expanding-unmapped-expression`     | The current fixture returns unmapped `spreading-outward`; do not infer an `atoaji` link from this observation.                         |
| 左右に何度か大きく揺れる           | 飲み込んだ後に味わいが続く感覚 / あと味                                      | `body-lateral-repeated-broad-no-nojun`   | The current fixture returns unmapped `wavering-continuous`; do not promote this observation or reintroduce a `nojun` shortcut.         |
| 速い動きを続ける                   | 今回の動きからは、無理なく対応できる日本酒の言葉はまだ見つかりませんでした。 | `body-sustained-fast-unmapped`           | This aligns with the current unmapped fixture outcome.                                                                                 |
| 短く急に止めつつ、同時に外へ広げる | 飲み込んだ後に広がり続く感覚 / あと味                                        | `body-short-abrupt-expanding-ambiguous`  | The current fixture remains `ambiguous-mixed`; record the observation without resolving the ambiguity.                                 |
| ほぼ動かない                       | 飲み込んだ後に残る感覚が続く / あと味                                        | `body-insufficient-movement`             | The current fixture remains `insufficient-expression`; no expression or term link is created from this observation.                    |

### Recorded Voice observations (human input)

These are recorded Human Experience observations, not changes to the experimental support cases, sensory-expression dataset, term links, or product evidence.

| Reproduced observation                                                        | Human-described result             | Existing representative case        | Follow-up note                                                                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Voice held for about one second or more, then weakened at the end             | 声の終わり方が徐々に消えていく感じ | `voice-long-fading-expression-only` | Compare the observed wording with the current `soft-settle` fixture result during a later Human Experience review.                 |
| Voice held for about one second or more, with intensity maintained to the end | 余韻が残る感じ                     | `voice-long-maintained-unmapped`    | The current fixture is intentionally unmapped; this observation is recorded without promoting it to an expression or term link.    |
| Almost no voice / extremely short voice                                       | 短く終わる感じ                     | `voice-insufficient-observation`    | The current fixture returns `insufficient-expression`; this wording is recorded without creating a new expression or feature rule. |

Overall Human Experience Gate (human-owned):

- [ ] The flow from observation through expression and vocabulary feels coherent.
- [ ] Intentionally unmapped outcomes look understandable rather than broken.
- [ ] Products explain the evidence that supports their appearance.
- [ ] The demo has sufficient term/product variety without fake certainty.
- [ ] No path implies that taste has been measured or detected.
- [ ] Remaining gaps are classified by a human as acceptable follow-up or blocker for #34.

## Automated boundary

The representative-case tests assert only stable IDs, support outcomes, approved-link behavior, and explicit product renderability. They do not assert that wording is natural or that a human should keep, revise, or reject any case.

## Follow-up candidates

- Human review of whether `wavering-continuous` and `wave-like` warrant separate beginner-facing presentation.
- Human review of limited Voice interpretation usefulness before expanding Voice support.
- Product/current-availability work if a current renderable `marui` product is needed; no evidence is invented here.
