import { Mic, PersonStanding } from "lucide-react";
import { useState } from "react";
import { BodyExperiment } from "../body/BodyExperiment";
import { Experiment } from "./Experiment";
import logoHorizontal from "../../assets/brand/logo-horizontal.png";
import heroSakeCup from "../../assets/brand/hero-sake-cup.png";

export function ExperimentModes() {
  const [mode, setMode] = useState<"start" | "body" | "voice">("start");

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
              言葉にしなくても大丈夫です。感じたことを、身体や声で自由に表現してみましょう。
            </p>
            <div className="start-screen__actions" aria-label="表現方法を選ぶ">
              <button
                className="button button--primary"
                type="button"
                onClick={() => setMode("body")}
              >
                <PersonStanding size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>体で表現する</span>
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setMode("voice")}
              >
                <Mic size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>声で表現する</span>
              </button>
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

  return mode === "body" ? (
    <BodyExperiment onFallback={() => setMode("voice")} onBack={() => setMode("start")} />
  ) : (
    <Experiment onBack={() => setMode("start")} />
  );
}
