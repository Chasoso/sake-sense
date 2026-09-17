# Ishikawa sake MVP dataset v0.2

This is a curated, provenance-backed MVP dataset, not a catalog, ranking, or independent sensory assessment. It covers the 32-member Ishikawa Sake Brewers Association baseline reviewed in the Issue #48 Notion source of truth. A product without an allowed selectable-term reference is still a valid coverage record.

Machine-readable sources are [`ishikawa-breweries.v0.1.json`](../../src/domain/data/ishikawa-breweries.v0.1.json) and [`ishikawa-sake-sample.v0.1.json`](../../src/domain/data/ishikawa-sake-sample.v0.1.json). The legacy filename is retained for import compatibility; its data version is `0.2.0`.

## Matching policy

Normal product matching requires all of the following:

- a selectable #45 term (`atoaji`, `kire`, `nameraka`, or `marui`);
- an explicit structured term reference;
- `direct` or human-approved `accepted-variant` evidence;
- `regular` or `seasonal` availability; and
- reviewable provenance.

`weak`, `rejected`, reference-only, unknown-availability, and discontinued records are retained for audit but do not normally match. No free-text similarity is used. `余韻` is the approved variant for `atoaji`; `丸み`-family wording is the approved variant for `marui`; `まろやか` is explicitly rejected as `marui` evidence.

Image URLs are source metadata only. Every committed product is `imageUsageStatus: needs-review`; an image source page is not reuse permission. Only `allowed` would be normal-image-renderable.

## Existing five-product audit

- Retained/revised: 菊姫 加州菊酒 remains, but only direct `kire` is normally renderable; its `sanmi` reference is audit-only.
- Removed/deferred from normal matching: 菊姫 特撰純米・山廃純米の `nojun`, 菊姫吟醸の inferred `tanrei`, 天狗舞 山廃仕込純米酒の inferred `nojun` / `sanmi`.
- Replaced for the normal direct path: 天狗舞 超辛 純米酒 provides explicit `kire` evidence.

## Brewery coverage — 32 / 32

| Brewery    | Coverage status                     | Included product                   | Source quality / note                                       |
| ---------- | ----------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| 久世酒造店 | source-found-but-no-selectable-term | 能登路 能登復興 特別純米酒         | Association; availability unknown                           |
| 武内酒造店 | source-found-but-no-selectable-term | 御所泉 純米吟醸                    | Association                                                 |
| 中村酒造   | covered                             | 金澤中村屋 能登復興支援酒 純米吟醸 | Association; direct wording, availability unknown           |
| 福光屋     | covered                             | 加賀鳶 いかづち 一閃               | Official; direct `nameraka` / `kire`                        |
| やちや酒造 | covered                             | 加賀鶴 特別純米 ひやおろし         | Association; direct `nameraka`                              |
| 金谷酒造店 | covered                             | 高砂 純米 ひやおろし               | Association; direct `atoaji` / `kire`                       |
| 菊姫       | covered                             | 加州菊酒、純米ひやおろし           | Official; direct `kire`, accepted `marui`                   |
| 小堀酒造店 | covered                             | 萬歳楽 剱                          | Official; direct `kire`, accepted `atoaji`                  |
| 車多酒造   | covered                             | 天狗舞 超辛 純米酒                 | Official; direct `kire`                                     |
| 吉田酒造店 | covered                             | 手取川 山廃仕込 純米酒             | Official; direct `kire`                                     |
| 加越       | covered                             | 加賀ノ月 純米吟醸                  | Association; direct `atoaji`, availability unknown          |
| 鹿野酒造   | covered                             | 常きげん 純米吟醸 風神             | Official; direct `kire`                                     |
| 西出酒造   | covered                             | 春心 山廃つくり本醸造              | Official store; direct `kire`                               |
| 手塚酒造場 | insufficient-source                 | 菊鶴                               | Supplemental only; needs deeper source                      |
| 東酒造     | covered                             | 神泉 純米吟醸 ひやおろし           | Association; direct `atoaji`                                |
| 松浦酒造   | source-found-but-no-selectable-term | 獅子の里 純米酒 ひやおろし         | Association                                                 |
| 宮本酒造店 | source-found-but-no-selectable-term | 夢醸 純米 ひやおろし               | `まろやか` rejected for `marui`                             |
| 春成酒造店 | insufficient-source                 | 春山 鵜祭り 特別本醸造             | Supplemental only; needs deeper source                      |
| 鳥屋酒造   | source-found-but-no-selectable-term | 池月 本醸造                        | Official identity; no inference from やわらかい             |
| 布施酒造店 | source-found-but-no-selectable-term | 天平 三年古酒 鬼ころし七尾城       | Public source                                               |
| 御祖酒造   | source-found-but-no-selectable-term | ほまれ 純米 ひやおろし             | Reference-only acid/umami evidence                          |
| 数馬酒造   | source-found-but-no-selectable-term | 竹葉 純米酒 ミサキ                 | Association                                                 |
| 櫻田酒造   | source-found-but-no-selectable-term | 能登大慶 純米 ひやおろし           | Association                                                 |
| 清水酒造店 | covered                             | 奥能登輪島 千枚田                  | Official; direct `kire`                                     |
| 宗玄酒造   | source-found-but-no-selectable-term | 宗玄 純米 ひやおろし               | Reference-only `nojun` / `sanmi`                            |
| 鶴野酒造店 | covered                             | 谷泉 特別純米 ひやおろし           | Association; direct `kire`                                  |
| 中島酒造店 | covered                             | 百石酒屋のおやじの手造り           | Association; direct `kire`                                  |
| 中野酒造   | insufficient-source                 | 能登亀泉 上撰                      | Industry association; needs deeper source                   |
| 中納酒造   | covered                             | 黒松 若緑                          | Industry association; direct `atoaji`, availability unknown |
| 白藤酒造店 | insufficient-source                 | 純米酒 寧音                        | Association identity; needs deeper source                   |
| 日吉酒造店 | source-found-but-no-selectable-term | おれの酒 純米ひやおろし            | Association / official brand source                         |
| 松波酒造   | temporarily-unavailable             | 大江山 蔵出し純米酒                | Association; availability unknown                           |

## Selectable-term coverage

| Term       | Direct | Accepted variant | Weak/reference | Breweries                                                                | Limitation                                                        |
| ---------- | -----: | ---------------: | -------------: | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `atoaji`   |      5 |                1 |              0 | 中村、金谷、加越、東、中納、小堀                                         | Some direct sources have unknown availability                     |
| `kire`     |     13 |                0 |              0 | 中村、福光屋、金谷、菊姫、小堀、車多、吉田、鹿野、西出、清水、鶴野、中島 | Several sources are seasonal                                      |
| `nameraka` |      2 |                0 |              0 | 福光屋、やちや                                                           | Coverage intentionally remains small                              |
| `marui`    |      0 |                1 |     1 rejected | 菊姫                                                                     | Only approved 丸み wording is rendered; まろやか remains rejected |

## Source inventory and weak cases

Sources are embedded per product and are intentionally limited to official brewery pages/stores, Ishikawa Sake Brewers Association pages/PDFs, public Ishikawa tourism, industry association material, and the named supplemental databases where higher-quality product detail was unavailable.

Hand review remains required for 手塚酒造場、春成酒造店、中野酒造、白藤酒造店 and current post-earthquake availability in the Noto area. These gaps are recorded rather than force-filled.
