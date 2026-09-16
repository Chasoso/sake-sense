# MVP sake vocabulary (Issue #45)

This is a small, provisional vocabulary baseline for Sake Sense. It was re-audited against public institutional material; it is not an authoritative or scientific mapping from a person's movement or voice to sake terminology.

## Vocabulary result

### Selectable by the current semantic bridge

- `atoaji` — あと味
- `kire` — きれ
- `nameraka` — なめらか
- `marui` — まるい

### Reference-only

- `sanmi` — 酸味
- `umami` — うま味
- `amami` — 甘味
- `tanrei` — 淡麗
- `nojun` — 濃醇

Reference-only does not mean incorrect. These are retained source-backed terms, but the current Body/Voice bridge must not offer them as ordinary candidate IDs.

### Deferred

`甘口` and `辛口` are deliberately not dictionary entries in this MVP. Their perceived relationship to sugar, acidity, alcohol, and other factors needs human semantic review before a future vocabulary change.

## Source-aligned structure

The dictionary uses a small `sourceCategory` plus an optional `parentTermId`; it does not turn categories into a generic ontology.

- `basic-taste`: 酸味、うま味、甘味
- `mouthfeel-stimulus`: まるい — the low-stimulation side of mouthfeel
- `mouthfeel-texture`: なめらか — texture/fineness and tongue feel
- `aftertaste`: あと味, with `きれ` as its child (`kire.parentTermId = atoaji`)
- `concentration-body`: 淡麗、濃醇

`きれ` is the canonical display term. “切れが良い” is permitted as beginner-facing explanatory language, not as the canonical dictionary label. `まるい` and `なめらか` remain separate concepts: the former concerns low stimulation/roundness and the latter texture/fineness.

## Retired dictionary shortcuts

The earlier dictionary's `weight`, `shape`, and `duration` fields were experimental implementation dimensions, not an authoritative sake terminology system. They are not retained in the source-backed dictionary. In particular, this dictionary does not assert:

- `weight: light -> 淡麗` or `weight: heavy -> 濃醇`
- `shape: sharp -> 酸味`
- `shape: round -> まるい / なめらか`
- a duration-only definition of あと味 or きれ

Observable Body/Voice fields remain observations. They are passed to the experimental bridge without a deterministic gesture/voice-to-sake-term mapping. A bridge response with no candidates (`unmapped`) is a valid, expected result.

The pre-existing `すっ / すっと -> kire` and `じわ -> atoaji` text path remains only as an explicitly legacy experimental compatibility path in `runLocalExperiment()`. It is neither source-backed dictionary meaning nor the #46 expression dataset, and it must be replaceable by that later work.

## Provenance and future changes

Every retained term has a concise definition, source name/type/URL, and transformation note in `src/domain/data/sensory-dictionary.v0.1.json`. The primary sources reviewed are:

- [酒類総合研究所: 清酒の香味に関する品質評価用語及び標準見本](https://www.nrib.go.jp/data/seikoumi.html)
- [酒類総合研究所: Japanese Sake Essentials — Sensory Evaluation Terms](https://www.nrib.go.jp/English/sake_info/sake-essentials/sensory-evaluation-terms/)
- [国税庁: きき酒用語掲載資料](https://www.nta.go.jp/taxes/sake/hambai/moderutekisuto/pdf/r05_07_07.pdf)

Future terms, status promotions, aliases, and relationships require human semantic review plus a reviewable source. #46 owns beginner-friendly expression data, #47 owns observable feature support cases, and #48 owns product-data expansion; this dictionary must not silently pre-decide those layers.

## Audit record

The prior eight entries were audited rather than accepted as-is. `atoaji`, `kire`, `nameraka`, `marui`, `sanmi`, `umami`, `tanrei`, and `nojun` were retained with revised categories/statuses and without nonverbal candidates or old dimensions. `amami` was added as source-backed reference-only vocabulary. Former everyday/nonverbal candidate lists and dimension mappings are historical experimental data, not provenance for dictionary meaning; downstream bridge access now derives only from `vocabularyStatus: selectable`.
