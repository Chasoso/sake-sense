import { useState } from "react";
import { BodyExperiment } from "../body/BodyExperiment";
import { Experiment } from "./Experiment";

export function ExperimentModes() {
  const [mode, setMode] = useState<"body" | "exp-002">("body");

  return (
    <>
      <nav className="experiment-mode-switch" aria-label="実験を選ぶ">
        <button
          className={mode === "body" ? "experiment-mode-switch__active" : ""}
          type="button"
          onClick={() => setMode("body")}
        >
          EXP-003 · 体で表現する
        </button>
        <button
          className={mode === "exp-002" ? "experiment-mode-switch__active" : ""}
          type="button"
          onClick={() => setMode("exp-002")}
        >
          EXP-002 · 声と指で表現する
        </button>
      </nav>
      {mode === "body" ? <BodyExperiment onFallback={() => setMode("exp-002")} /> : <Experiment />}
    </>
  );
}
