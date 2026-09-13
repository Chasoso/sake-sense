# Sake Sense Visual Identity

このドキュメントは、Sake Sense の Visual Identity と UI 表現の基準を定義する正本です。

Sake Sense は、AIそのものを前面に出すサービスではありません。
主役は、ユーザー自身の感覚・身体表現・声・そこから生まれる発見です。

デザインでは、**日本酒らしさを直接的な和風装飾で表現するのではなく、静けさ、余白、自然な素材感、感覚の余韻**によって伝えます。

---

## 1. Brand Concept

### Core message

**日本酒の味を、身体と言葉でたどる。**

Sake Sense は、日本酒の味をうまく言葉にできない人でも、身体の動きや声などから自分なりの感覚を表現し、その感覚を日本酒の言葉へ少しずつつなげていくための体験です。

### Supporting ideas

- 言葉にしなくてもよい
- 感じたことから始める
- 正解を押し付けない
- 無理に日本酒語へ変換しない
- AIは主役ではなく、必要な場合だけ裏側で橋渡しを助ける
- 実在する日本酒との接続では、出典と根拠を大切にする

### Tone

- 静か
- 親しみやすい
- 現代的
- 少し余韻がある
- 技術感を前面に出しすぎない
- 和風すぎない

目指すのは、**酒蔵の試飲スペースや小さなギャラリーに置かれていても違和感のないUI**です。

---

## 2. Design Principles

### 2.1 Natural

生成り、墨色、深緑、金茶など、落ち着いた自然色を使います。

強いネオン、青紫グラデーション、発光表現など、典型的なAIサービスを想起させる表現は避けます。

### 2.2 Space

情報をカードの中へ詰め込みすぎず、余白を残します。

1画面の中で、ユーザーが次に見るべき場所を明確にします。

### 2.3 Discovery

結果をすべて一度に見せるのではなく、

**表現する → 振り返る → 感覚を見つける → 日本酒の言葉へつなぐ → 実在酒で確かめる**

という流れで、少しずつ発見できる構成を優先します。

### 2.4 Human first

ユーザーに見せる言葉は、人が自然に理解できる表現を優先します。

以下のような内部用語は、通常UIでは表示しません。

- EXP-xxx
- fixture
- provider
- candidateTermIds
- unmappedFeatures
- raw feature IDs
- raw JSON
- threshold
- internal confidence value

必要な場合は、Developer details などに隔離します。

### 2.5 Not AI-looking

以下のような典型的な「AIっぽい」表現は避けます。

- 大きすぎる pill button
- 強い角丸
- チャットUI
- ネオンカラー
- 青紫グラデーション
- glassmorphism
- 光沢の強いカード
- AIを想起させる星・スパークルの乱用
- 「AIが判断しました」を主役にする表現

---

## 3. Color System

### Primary palette

| Token               | Color     | Usage                       |
| ------------------- | --------- | --------------------------- |
| Background / Kinari | `#F9F7F2` | ページ背景、余白            |
| Ink                 | `#2B2B2B` | 見出し、本文、UIアイコン    |
| Deep Green          | `#556B56` | Primary CTA、主要アクセント |
| Gold / Kincha       | `#C9A96A` | 小さな強調、装飾、区切り    |
| Mist                | `#E7E3DC` | 枠線、区切り、薄い背景      |
| Soft Surface        | `#F1EDE6` | タグ、補助背景              |

### Color usage rules

- Primary CTA は Deep Green を基本とする
- Gold は小さなアクセントとして使う
- Gold を大面積に使いすぎない
- 黒背景を基本テーマにしない
- 警告やエラー以外で赤を強く使わない
- テキストコントラストを優先する

---

## 4. Typography

### Japanese headings

推奨:

- Noto Serif JP
- Hiragino Mincho ProN
- Yu Mincho

見出しでは明朝体を使い、静けさと余韻を出します。

### Japanese body / UI

推奨:

- Noto Sans JP
- Hiragino Kaku Gothic ProN
- Yu Gothic

本文や操作UIでは読みやすさを優先します。

### Latin / Numbers

推奨:

- Inter

### Rules

- 大見出しは明朝
- 本文、ボタン、ナビゲーションはゴシック
- 英字ラベルを多用しない
- `03 · BRIDGE, NOT VERDICT` のような内部的・演出的な英字見出しは通常画面では避ける
- 日本語だけで意味が伝わる場合は日本語を優先する

---

## 5. Corner Radius

角丸は**少しだけ**使います。

強いpill感を避け、道具としての明確な輪郭を残します。

### Recommended values

```css
--radius-xs: 3px;
--radius-button: 5px;
--radius-card: 7px;
--radius-large-frame: 10px;
```

### Rules

- 通常ボタン: `5px`
- カード: `7px`
- 大きな画面コンテナ: 最大 `10px`
- タグは必要に応じて `3px` 程度
- ボタンを完全なpill形状にしない

---

## 6. Buttons

### Primary

- Deep Green background
- White text
- Small radius
- 1つの画面にPrimary CTAは原則1つ

例:

- 体で表現する
- この動きから言葉を探す
- この言葉を日本酒で確かめる

### Secondary

- Transparent / light background
- Thin border
- Ink / Green text

例:

- 声で表現する
- もう一度やってみる

### Button wording

「処理する」「解析する」などシステム中心の言葉ではなく、ユーザー行動を表す動詞を使います。

Good:

- 体で表現する
- 声で表現する
- 言葉を探す
- もう一度やってみる
- 日本酒で確かめる

Avoid:

- 実行
- Submit
- Analyze
- AIで判定
- Generate

---

## 7. Cards and Containers

カードは情報を整理するために必要な場合だけ使います。

カードを縦に何枚も連続させ、内部処理をそのまま表示する構成は避けます。

### Prefer

- 余白
- 罫線
- 見出しの階層
- まとまりのある1つのブロック

### Avoid

- すべてのステップを同じカードにする
- Step 01 / Step 02 / Step 03 を大量に並べる
- 結果がない空カードを残す
- 同じ内容を複数カードで繰り返す

---

## 8. Brand Raster Assets

ブランド表現に必要な、写真・水彩・紙質感・有機的な装飾はラスター画像として保持します。

これらは生成AIやCodexでSVGとして再描画しません。
**approved Visual Identity の見た目を保つことを優先し、PNG / WebP を正規アセットとして扱います。**

### Required raster assets

推奨配置:

```text
src/assets/brand/
```

### Logo assets

- `logo-main.png`
  - メインロゴ
  - ホーム、ブランド紹介、OGイメージ等
- `logo-horizontal.png`
  - 横長ヘッダー向け
- `logo-mark.png`
  - ロゴマーク単体
  - favicon / compact header の元素材

### Background / decorative assets

- `bg-mountain-wash.png`
  - 淡い山並み
  - section background / hero accent
- `bg-paper-texture.png`
  - 紙質感
  - 強く見せず低opacityで使用
- `bg-shadow-leaves.png`
  - 葉の影
  - 写真・背景の補助
- `decor-brush-stroke.png`
  - 金茶の筆跡
- `decor-wash-circle.png`
  - 水彩円
- `decor-wave-lines.png`
  - 波・余韻を感じる線
- `decor-rice-stalk.png`
  - 稲穂
  - 小さなアクセントとして限定使用

### Photography

- `hero-sake-cup.png`
  - 酒器のHero image
- `branch-blossom.png`
  - 補助写真
  - 必須ではなく、必要な画面だけで使用

### Raster asset rules

- 装飾はコンテンツを邪魔しない
- 背景として使う場合はopacityを抑える
- 同一画面で複数の装飾モチーフを競合させない
- 写真と水彩・筆跡を過剰に混在させない
- 稲穂や筆跡を「和風らしさ」のためだけに大量配置しない
- UI操作アイコンをPNGで作らない

---

## 9. UI Icons

### Policy

通常のUIアイコンは、生成PNGや自作の複雑なSVGではなく、**一貫した既存アイコンライブラリ**を使用します。

第一候補:

**Lucide / lucide-react**

理由:

- 線画の統一感がある
- Sake Sense の静かで現代的なVisual Identityと相性がよい
- SVGベースで高解像度
- 色・サイズ・strokeをCSS/propsで統一できる
- Codexが扱いやすい
- 自作SVGの品質差を避けられる

### Recommended Lucide icons

| Purpose          | Lucide icon        |
| ---------------- | ------------------ |
| Home             | `House`            |
| Body expression  | `PersonStanding`   |
| Voice expression | `Mic`              |
| Sake / explore   | `Search` or `Wine` |
| Learn            | `BookOpen`         |
| Settings         | `Settings`         |
| Camera           | `Camera`           |
| Replay / Play    | `Play`             |
| Retry            | `RotateCcw`        |
| Back             | `ArrowLeft`        |
| Forward / CTA    | `ArrowRight`       |
| Close            | `X`                |
| External link    | `ExternalLink`     |
| Expand details   | `ChevronDown`      |

### Icon sizing

推奨:

```text
Navigation: 20–22px
Button: 18–20px
Inline / Supporting: 16–18px
```

### Icon colors

Default:

```css
color: #2b2b2b;
```

Primary CTA:

```css
color: #ffffff;
```

Secondary accent:

```css
color: #556b56;
```

### Stroke

Lucide defaultを基準にしつつ、画面内で統一します。

例:

```tsx
<PersonStanding size={20} strokeWidth={1.8} />
```

### Important rule

アイコン単体で意味を伝えようとしません。

特に、

- 体で表現する
- 声で表現する
- 日本酒を探す

などの主要操作では、**日本語ラベルとアイコンを必ずセット**で使います。

---

## 10. Feature Representation

身体表現の特徴については、専用画像アイコンを大量に作りません。

例:

- 長く続く
- 繰り返す
- 大きく動く
- 中心へ縮む
- 横方向
- 上方向

これらは基本的に、

**短い日本語ラベル + 控えめなタグ**

で表示します。

必要な場合のみ、Lucideの単純な補助アイコンを使用します。

### Avoid

- `feature-long.png`
- `feature-repeat.png`
- `feature-large.png`

のような専用ラスターアイコンを増やすこと。

理由:

- Visual Identityのノイズになる
- 意味が一意に伝わりにくい
- 専用画像の保守コストが高い
- テキストの方が正確

---

## 11. Decorative Elements

装飾は、日本酒の伝統を直接的に説明するためではなく、画面全体に自然な余韻を与えるために使います。

利用可能なモチーフ:

- 淡い水彩
- 薄墨
- 筆跡
- 波線
- 稲穂
- 山のレイヤー
- 酒器
- 柔らかな自然光や影

### Rules

- 装飾はコンテンツを邪魔しない
- 背景に強い写真を常時置かない
- 写真とUIを競合させない
- 稲穂・筆跡を過剰に使わない
- 「和風」記号の寄せ集めにしない

---

## 12. UX Direction

### One screen, one primary purpose

各画面で、ユーザーが次にすべきことを1つに絞ります。

例:

### Start

**この味、どう感じましたか？**

Primary:

- 体で表現する

Secondary:

- 声で表現する

### Capture

**この味を、体でやってみてください。**

Primary:

- 表現を開始 / 終了

### Review

**こんな動きでした**

- Replay
- 2〜4個の特徴
- この動きから言葉を探す

### Sensory result

**この動きから見えた感覚**

- 初心者向けの感覚表現
- 日本酒の言葉がある場合のみ表示

### Sake exploration

日本酒語候補が存在する場合のみ、実在する石川の日本酒を表示します。

---

## 13. Result Screen Information Architecture

結果画面では、内部処理をそのまま表示しません。

基本構造:

1. **あなたの動き**
   - Replay
   - 特徴的な2〜4個の観測結果

2. **この動きから見えた感覚**
   - 初心者向けの感覚表現

3. **日本酒の言葉で言うと**
   - 候補がある場合のみ表示

4. **この言葉を実際の日本酒で確かめる**
   - provenance-backedな候補がある場合のみ表示

候補がない場合は、空のStepを表示せず、その時点で自然に終了します。

例:

> 今回の動きからは、無理なく対応できる日本酒の言葉はまだ見つかりませんでした。
> 別の動きでも試してみましょう。

---

## 14. Developer Information

通常UIから隠すもの:

- provider kind
- fixture / fallback
- raw BodyMovementFeatures
- thresholds
- semantic bridge raw response
- candidate term IDs
- unmapped feature IDs
- raw JSON

必要な場合:

```text
開発者向け詳細
```

という折りたたみ領域の中だけに表示します。

---

## 15. AI Presentation

Sake Senseでは、AIをブランドの中心に置きません。

### When no real AI is used

ユーザー向け画面では、

- AIが解釈した
- AIが判定した

とは表示しません。

fixture / deterministic logic などの内部実装も通常UIでは表示しません。

### When AI is used in the future

AIの役割は、

**身体表現や声を、感覚表現へ橋渡しすること**

です。

AIは:

- 味を測定しない
- 味を客観的に判定しない
- 好みを決めつけない
- 推薦ランキングを作らない
- 人格や感情を推定しない

Preferred framing:

> 身体表現から、言葉への橋渡しをしています。

Avoid:

> AIがあなたの味覚を判定しました。

---

## 16. Repository Structure

推奨構成:

```text
docs/
  design/
    visual-identity/
      README.md
      prototype.html
      styleboard-main.png
      styleboard-assets.png

src/
  assets/
    brand/
      logo-main.png
      logo-horizontal.png
      logo-mark.png
      hero-sake-cup.png
      branch-blossom.png
      bg-mountain-wash.png
      bg-paper-texture.png
      bg-shadow-leaves.png
      decor-brush-stroke.png
      decor-wash-circle.png
      decor-wave-lines.png
      decor-rice-stalk.png
```

UIアイコンは画像ファイルとして保存せず、原則として `lucide-react` から利用します。

---

## 17. Source of Truth

Visual Identityの参照優先順位:

1. `README.md`
   - 原則・ルール・デザイントークンの正本

2. `prototype.html`
   - 実装時の具体的なUIリファレンス

3. `styleboard-main.png`
   - Art Direction / 雰囲気の参照

4. `styleboard-assets.png`
   - ブランド素材・装飾の見た目の参照

5. `src/assets/brand/`
   - 実際にアプリで使用する承認済みラスター素材

画像だけを正本にしません。

Codexや開発者がUIを変更する場合は、まず `README.md` と `prototype.html` を確認してください。

---

## 18. Implementation Notes

Visual Identityを実装するときは、以下を優先します。

- CSS custom propertiesでデザイントークンを定義
- 角丸値を共通化
- 色を直接ハードコードしすぎない
- 通常UIアイコンは `lucide-react` を利用
- ブランド装飾は承認済みRaster Assetsを利用
- Codexに複雑なブランドSVGを新規生成させない
- responsive/mobile-firstを維持
- accessibilityを犠牲にしない
- hoverだけに意味を依存させない
- focus stateを必ず持たせる
- sufficient contrastを維持する
- decorative imageには必要に応じて `aria-hidden="true"` を使用
- 情報を持つ画像には適切なaltを設定

---

## 19. Do / Don't

### Do

- 生成り背景
- 墨色の文字
- 深緑のPrimary CTA
- 金茶の小さな強調
- 小さな角丸
- 明朝見出し + ゴシック本文
- 余白を大きく取る
- 一画面一目的
- Replayを結果画面の中心にする
- 日本語中心の自然な文言
- 候補がない状態も自然な結果として扱う
- ブランド画像は承認済みラスター素材を使う
- 操作アイコンはLucideで統一する

### Don't

- 黒背景中心
- AI風のネオン
- 青紫グラデーション
- 大きなpill button
- 強いglassmorphism
- カードの大量連続
- EXP番号を一般ユーザーへ見せる
- fixture/providerなどを一般ユーザーへ見せる
- 解析結果をraw feature名で表示する
- 日本酒語がないのに空の商品領域を見せる
- 「AIが判定した」と見せる
- 推薦順位や相性スコアを作る
- UIアイコンを生成PNGとして作る
- 複雑なブランドSVGをCodexに新規作成させる
- Featureごとの専用画像アイコンを大量に作る

---

## 20. Current Status

このVisual Identityは、Sake SenseのUI/UX再設計に向けた基準です。

現時点では、以下を確定方針として扱います。

- 温かい生成りベース
- 深緑 + 金茶アクセント
- 黒基調AIデモUIから脱却
- 小さな角丸
- 非pill型ボタン
- 日本語中心
- 技術情報はDeveloper detailsへ
- 「表現 → 振り返る → 言葉 → 日本酒」のUX
- AIではなくユーザー自身の感覚を主役にする
- ブランド素材はRaster Assetsとして保持する
- 通常UIアイコンはLucideを使用する
- 複雑な自作SVGを実装要件にしない

今後のUI改善では、この方針を起点に変更してください。
