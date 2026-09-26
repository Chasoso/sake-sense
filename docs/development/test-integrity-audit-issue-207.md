# Issue #207 test-integrity audit

監査日: 2026-09-26

この記録は、テストを green に見せるために production behavior、assertion、fixture、snapshot、coverage gate を不当に緩めていないかを、現行 `main` 相当のコードと関連履歴について確認した結果です。

## 監査範囲

- Vitest unit test、V8 coverage 設定、threshold、除外設定
- Admin / Gesture / scroll-reset Playwright E2E と mock API
- Admin visual regression、snapshot path、pixel threshold、mask、更新履歴
- production smoke の frontend / public API / Admin CORS / unauthenticated protection
- data-platform handler / repository / migration の deterministic test
- CI workflow の実行条件、failure suppression、skip、retry、timeout
- test-only、snapshot-only、coverage-only、workflow-only の関連履歴

## Findings

### Resolved — visual baseline の cross-platform 差分許容

- Area: `tests/e2e/admin-visual.spec.ts`, `playwright.visual.config.ts`, `docs/development/validation-policy.md`
- Evidence: `1934dcf` で別OS由来の snapshot 名を共通名へ移し、`4228844` で `maxDiffPixelRatio` を 5% に設定。その後 `f59b5c8` で 3.5% へ下げ、`69f2244` で per-pixel `threshold: 0.35` を追加している。現行baselineはCIと異なるOSで生成されたことがドキュメントに明記されている。
- False-green risk: 監査前は、低頻度の小さなレイアウト差分や文字の欠落が、既知のfont rasterization差分に埋もれる可能性があった。
- Production behavior: likely correct。visual gateは大きな幅崩れ、wrapping、主要control欠落を検知するが、pixel-levelの厳密性は限定的。
- Action: fixed in this PR。CI run `36236383405` のUbuntu 24.04 / Playwright Chromiumで3枚を再生成し、既存PNGとSHA-256が一致することを確認した。`maxDiffPixelRatio` を `0.035` から `0.01`、per-pixel `threshold` を `0.35` から `0.1` へ変更した。baseline更新手順と同一環境要件をvalidation policyへ明記した。

### Low — Gesture calibration fixture のCI安定化

- Area: `tests/e2e/gesture-calibration.spec.ts`
- Evidence: `e608ea8` で smooth fixture のx間隔を30から20へ変更し、CIのpointer timingでも reviewed smooth-flow boundary 内に入るようにしている。production codeは変更されていない。
- False-green risk: fixtureの入力分布が実利用入力を十分に代表しない場合、分類境界の回帰を見逃す可能性がある。
- Production behavior: likely correct。fixtureはproductionの既存support-caseを直接通り、候補分布とsupport-case coverageも検証している。
- Action: no change needed。別fixtureを追加する場合も、production boundaryをテスト側で再実装せず、実pointer pathとdomain unit testを使う。

### Informational — Admin E2E mock の未定義route

- Area: `tests/e2e/admin.spec.ts`
- Evidence: mock helperは未使用routeを404で返す。各テストは必要なGET/POST/PATCHを明示的に確認しており、payloadのID、method、主要表示をassertしている。
- False-green risk: optionalな追加fetchが404を許容する実装になった場合、mockだけでは見逃す可能性がある。
- Production behavior: likely correct。handlerのroute/method、allowlist、validationは `backend/data-platform/src/handlers.test.mjs` でも直接検証されている。
- Action: follow-up recommended。API contract変更時はmockに未定義route検知を追加し、不要な404許容を見逃さないようにする。

## No issue found

- Productionで使われるAdmin presentation helperは、`AdminApp.tsx` が `statusLabel`、`relationLabel`、`selectOptions`、`displayName` を直接利用しており、unit testだけのhelperにはなっていない。
- `accepted-variant` の表示は production / helper / test で `承認済み変形` に一致している。
- Vitest coverageはV8の実コードを対象とし、意味のあるapplication codeを除外していない。thresholdは lines 80%、branches 70%、functions 85%、statements 78%で、baselineより低い固定値を維持している。
- `test.skip`、`describe.skip`、`.todo`、`continue-on-error`、無条件のretryによるfailure suppressionは確認できなかった。CIの `if: always()` はcoverage artifact uploadだけで、テスト結果を成功扱いにするものではない。
- Admin E2Eは実AWS/Cognitoへ接続せず、作成はPOST、編集はPATCH、detailはID付きGETを使う。backend unit test側でもserver-generated ID、allowlist、published-only、evidence参照制約を検証している。
- production smokeはwriteを行わず、frontend、public API、Admin preflightのallow-origin/methods/headers、unauthenticated Admin protectionを確認する。OPTIONSにJWT bypassを追加していない。
- CIは `npm run validate`、Gesture、scroll-reset、Admin、visual E2Eを実行しており、作成しただけで実行されないテストは確認できなかった。
- `scripts/check-cloudformation-change-set.mjs` のRemove例外は `AdminOptionsRoute` に限定され、replacementや他リソース削除のblockを維持している。

## Git history reviewed

重点確認したcommit:

- `1934dcf` — visual snapshot pathをOS非依存名へ変更。baselineの生成OS差分を解消したものではないため、上記visual follow-upを記録。
- `4228844` — visual差分許容を5%へ変更。
- `69f2244` — per-pixel antialiasing thresholdを追加。
- `f59b5c8` — aggregate visual ceilingを3.5%へ変更。
- `e608ea8` — Gesture smooth fixtureをCI timingに合わせて安定化。
- `3cd9cdd` — Admin locatorをstrictなrole/name assertionへ修正。
- `5278220` — secret scanner誤検知を避けるtest token名の変更。
- `63ff3a6` — fixture-specific Gesture boundaryをproduction側から削除し、unit/E2E入力を更新。

上記のうち、production変更を伴わないtest-only変更は確認したが、現時点で「期待値だけを変更してproduction bugを隠した」と断定できるものはなかった。

## Conclusion

今回の監査で確認したvisual false-green riskは、CI同一環境でのbaseline再生成、差分閾値の厳格化、deterministicな再生成手順の文書化で解消した。未定義Admin mock route検知は引き続き低優先度のfollow-upとする。
