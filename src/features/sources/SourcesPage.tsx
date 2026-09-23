import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  DEFAULT_IMAGE_SOURCES,
  DEFAULT_PRODUCT_SOURCES,
  DEFAULT_TERMINOLOGY_SOURCES,
  type DisplaySource,
} from "./source-aggregation";

function sourceTypeLabel(source: DisplaySource): string {
  if (source.sourceType === "image-provenance") return "画像出典";
  if (source.sourceType === "official-product-page") return "公式商品情報";
  if (source.sourceType === "association") return "公的・業界団体の公開情報";
  if (source.sourceType === "term-reference") return "関連する公開資料";
  if (source.sourceType?.includes("government")) return "公的資料";
  if (source.sourceType?.includes("institutional")) return "公的機関の資料";
  return "公開情報";
}

function SourceList({ sources }: { sources: ReadonlyArray<DisplaySource> }) {
  return (
    <div className="sources-page__list">
      {sources.map((source) => (
        <article className="sources-page__card" key={source.key}>
          <p className="sources-page__source-name">{source.sourceName}</p>
          {source.title && <h3>{source.title}</h3>}
          <dl className="sources-page__metadata">
            <div>
              <dt>種類</dt>
              <dd>{sourceTypeLabel(source)}</dd>
            </div>
            {source.reviewedAt && (
              <div>
                <dt>確認日</dt>
                <dd>{source.reviewedAt}</dd>
              </div>
            )}
            {source.imageUsageStatus && (
              <div>
                <dt>画像の扱い</dt>
                <dd>
                  再利用可否は未確認（
                  {source.imageUsageStatus === "needs-review" ? "確認中" : source.imageUsageStatus}
                  ）
                </dd>
              </div>
            )}
          </dl>
          <a
            className="sources-page__link"
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            出典ページを開く
            <ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
  );
}

export function SourcesPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="experience-screen sources-page" aria-labelledby="sources-page-title">
      <nav className="experience-screen__nav" aria-label="画面の移動">
        <button className="icon-text-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>戻る</span>
        </button>
        <span className="experience-screen__brand">Sake Sense</span>
      </nav>

      <header className="experience-screen__header sources-page__header">
        <p className="eyebrow">Sake Sense</p>
        <h1 id="sources-page-title">出典・情報源</h1>
        <p>このアプリで参照している用語や石川県の日本酒情報を、元の資料から確認できます。</p>
      </header>

      <section className="sources-page__boundary" aria-labelledby="sources-boundary-title">
        <h2 id="sources-boundary-title">情報の見方</h2>
        <p>日本酒用語や商品情報は、公的資料や公式情報を参照しています。</p>
        <p>
          動きや声から日本酒表現へつなぐ部分は、Sake
          Sense独自の実験的な解釈です。動きや声から客観的な味を科学的に検出するものではありません。
        </p>
        <p>
          表示される商品は根拠のあるデータ上のつながりであり、個人向けのおすすめや品質ランキングではありません。
        </p>
      </section>

      <section className="sources-page__section" aria-labelledby="terminology-sources-title">
        <h2 id="terminology-sources-title">日本酒用語・官能評価用語</h2>
        <p className="sources-page__section-copy">
          用語の説明や官能評価の資料として参照している公開情報です。
        </p>
        <SourceList sources={DEFAULT_TERMINOLOGY_SOURCES} />
      </section>

      <section className="sources-page__section" aria-labelledby="product-sources-title">
        <h2 id="product-sources-title">石川県の日本酒・酒蔵 / 商品情報</h2>
        <p className="sources-page__section-copy">
          商品や酒蔵の情報を確認できる公開ページです。同じ出典はまとめて表示しています。
        </p>
        <SourceList sources={DEFAULT_PRODUCT_SOURCES} />
      </section>

      {DEFAULT_IMAGE_SOURCES.length > 0 && (
        <section className="sources-page__section" aria-labelledby="image-sources-title">
          <h2 id="image-sources-title">画像出典</h2>
          <p className="sources-page__section-copy">
            商品情報の出典とは別に、画像の出典ページを示しています。掲載されている画像の再利用可否を意味するものではありません。
          </p>
          <SourceList sources={DEFAULT_IMAGE_SOURCES} />
        </section>
      )}

      <footer className="experience-screen__footer">
        出典は確認時点の情報です。外部ページの内容は変更される場合があります。
      </footer>
    </main>
  );
}
