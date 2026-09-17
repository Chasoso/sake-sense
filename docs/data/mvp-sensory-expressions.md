# MVP beginner-friendly sensory expressions

Issue #46 keeps beginner-friendly sensory expressions separate from the source-backed sake vocabulary in [MVP sake vocabulary](mvp-sake-vocabulary.md). An expression is experimental, reviewable language for describing an impression; it is not a dictionary definition and does not measure or determine sake flavour.

The current pool contains 15 expressions and two separate system interpretation states. This is a candidate pool, not a permanently fixed count: Human Experience review may combine or remove expressions.

## Two independent statuses

`expressionStatus` says whether an expression is normally available: `active`, `experimental`, `reference-only`, or `deprecated`.

`termLinkStatus` says whether its relationship to a curated sake term is settled: `approved`, `candidate`, or `unmapped`. Active does not mean approved. Candidate links are retained for review but do not produce normal downstream term candidates. `unmapped` is a normal, useful result.

## Active expressions

| ID                   | Display text                       | Term link          |
| -------------------- | ---------------------------------- | ------------------ |
| lingering-after-feel | 余韻が残る感じ                     | approved: atoaji   |
| clean-fade           | すっと引いていく感じ               | approved: kire     |
| smooth-flow          | ひっかかりなく、なめらかに続く感じ | approved: nameraka |
| rounded-enveloping   | 角がなく、丸く包まれる感じ         | approved: marui    |
| soft-settle          | ゆっくり落ち着いていく感じ         | candidate: atoaji  |
| wavering-continuous  | ゆらぎながら続く感じ               | unmapped           |
| spreading-outward    | 外へほどけていく感じ               | unmapped           |
| pulsing-strength     | 強くなったり弱くなったりする感じ   | unmapped           |
| wave-like            | 波のように行ったり来たりする感じ   | unmapped           |

`smooth-flow` describes continuity and low roughness; `rounded-enveloping` describes low angularity and an enveloping sensation. They intentionally remain different. Likewise, `lingering-after-feel` is persistence, while `clean-fade` is quick, clean disappearance.

## Experimental candidates

`quick-change`, `compact-stop`, `continuous-gentle`, `sliding-smooth`, `rounded-soft`, and `slowly-fading` are comparison candidates. Their links are not approved. In particular, `slowly-fading` deliberately has no candidate term IDs until a human review can distinguish its relationship to `atoaji` and `kire`.

## System interpretation states

`ambiguous-mixed` and `insufficient-expression` are UI/bridge interpretation states, not sensory expressions. They are held in a separate data file and cannot be returned as ordinary expression candidates.

## Scope boundary

Issue #46 defines expression content and term-link status only. Issue #47 decides whether any observable Body or Voice feature can support selecting an expression. Existing local fixture routes are legacy compatibility behavior, use expression IDs for display text, and return no sake-term candidates.

Only selectable dictionary terms can be linked by this dataset. The reference-only terms `sanmi`, `umami`, `amami`, `tanrei`, and `nojun` are valid vocabulary, but not normal expression candidates. Adding or promoting an expression requires Human semantic and UX review.
