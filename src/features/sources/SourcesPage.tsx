import { ArrowLeft, ExternalLink } from "lucide-react";
import { getProductSources, getTerminologySources, type DisplaySource } from "./source-aggregation";
import { ExperienceBrand } from "../experiment/ExperienceBrand";

function SourceList({ sources }: { sources: ReadonlyArray<DisplaySource> }) {
  return (
    <div className="sources-page__list">
      {sources.map((source) => (
        <article className="sources-page__card" key={source.key}>
          <p className="sources-page__source-name">{source.sourceName}</p>
          {source.title && <h3>{source.title}</h3>}
          <dl className="sources-page__metadata">
            {source.reviewedAt && (
              <div>
                <dt>確認日</dt>
                <dd>{source.reviewedAt}</dd>
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
        <ExperienceBrand />
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
        <SourceList sources={getTerminologySources()} />
      </section>

      <section className="sources-page__section" aria-labelledby="product-sources-title">
        <h2 id="product-sources-title">石川県の日本酒・酒蔵 / 商品情報</h2>
        <p className="sources-page__section-copy">商品や酒蔵の情報を確認できる公開ページです。</p>
        <SourceList sources={getProductSources()} />
      </section>

      <footer className="experience-screen__footer">
        出典は確認時点の情報です。外部ページの内容は変更される場合があります。
      </footer>
    </main>
  );
}
