import { BookOpen, Mic, PenLine, PersonStanding } from "lucide-react";
import { useState } from "react";
import { BodyExperiment } from "../body/BodyExperiment";
import { GestureExperiment } from "./GestureExperiment";
import { VoiceExperiment } from "./VoiceExperiment";
import logoHorizontal from "../../assets/brand/logo-horizontal.png";
import heroSakeCup from "../../assets/brand/hero-sake-cup.png";
import { SourcesPage } from "../sources/SourcesPage";
import { useScreenScrollReset } from "./use-screen-scroll-reset";

export function ExperimentModes() {
  const [mode, setMode] = useState<"start" | "body" | "voice" | "gesture" | "sources">("start");
  useScreenScrollReset(mode);

  if (mode === "sources") {
    return <SourcesPage onBack={() => setMode("start")} />;
  }

  if (mode === "start") {
    return (
      <main className="start-screen" aria-labelledby="start-title">
        <header className="start-screen__header">
          <img className="brand-logo" src={logoHorizontal} alt="Sake Sense" />
          <span className="start-screen__mark">味わいの入口</span>
        </header>
        <section className="start-screen__hero">
          <div className="start-screen__copy">
            <p className="eyebrow">Sake Sense</p>
            <h1 id="start-title">
              この味、どう
              <span className="mobile-only-break">
                <br />
              </span>
              感じましたか？
            </h1>
            <p className="start-screen__lead">
              言葉にしなくても大丈夫です。感じたことを、身体や声、指の動きで自由に表現してみましょう。
            </p>
            <div className="start-screen__actions" aria-label="表現方法を選ぶ">
              <div className="start-screen__primary-actions">
                <button
                  className="button button--primary"
                  type="button"
                  data-mode="body"
                  onClick={() => setMode("body")}
                >
                  <PersonStanding size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>体で表現する</span>
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  data-mode="voice"
                  onClick={() => setMode("voice")}
                >
                  <Mic size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>声で表現する</span>
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  data-mode="gesture"
                  onClick={() => setMode("gesture")}
                >
                  <PenLine size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>指で表現する</span>
                </button>
              </div>
              <div className="start-screen__secondary-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  data-mode="sources"
                  onClick={() => setMode("sources")}
                >
                  <BookOpen size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>出典・情報源</span>
                </button>
              </div>
            </div>
          </div>
          <div className="start-screen__visual" aria-hidden="true">
            <img src={heroSakeCup} alt="" />
          </div>
        </section>
        <p className="start-screen__footer">表現する → 振り返る → 味わいの言葉へ</p>
      </main>
    );
  }

  if (mode === "body") {
    return <BodyExperiment onFallback={() => setMode("voice")} onBack={() => setMode("start")} />;
  }
  if (mode === "voice") {
    return <VoiceExperiment onBack={() => setMode("start")} />;
  }
  return <GestureExperiment onBack={() => setMode("start")} />;
}
