import { useEffect, useMemo, useState } from "react";
import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import {
  createSyntheticWavePath,
  type SyntheticWavePoint,
  type VoiceFeatures,
} from "../../domain/voice";
import {
  getBodyDisplayWords,
  getBodySkeletonGeometry,
  getBodyDissolveOpacity,
  getBodyDissolveScale,
  getBodyLightProgress,
  getBodyTransformProgress,
  getTransformProgress,
  getTransformStage,
  getVoiceIntermediateWords,
  windowProgress,
  type TransformStage,
} from "./expression-transform";

type ExpressionTransformProps =
  | {
      mode: "body";
      features: BodyMovementFeatures;
      frames: BodyPoseFrame[];
      presentation?: "body-screen";
      decorative?: boolean;
      waveHistory?: never;
      voiceFeatures?: never;
    }
  | {
      mode: "voice";
      features: VoiceFeatures;
      waveHistory: SyntheticWavePoint[];
      frames?: never;
      voiceFeatures?: never;
      decorative?: boolean;
    };

function stageCopy(mode: "body" | "voice", stage: TransformStage): string {
  if (stage === 0) return mode === "body" ? "あなたの動きから" : "あなたの声から";
  if (stage === 1) return "輪郭をたどる";
  if (stage === 2) return "感覚の形へ";
  return "ことばの入口へ";
}

export function ExpressionTransform(props: ExpressionTransformProps) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    const tick = (timestamp: number) => {
      setElapsed(Math.max(timestamp - startedAt, 0));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const bodyScreen = props.mode === "body" && props.presentation === "body-screen";
  const stage = getTransformStage(elapsed);
  const progress = bodyScreen ? getBodyTransformProgress(elapsed) : getTransformProgress(elapsed);
  const words = useMemo(
    () =>
      props.mode === "body"
        ? getBodyDisplayWords(props.features)
        : getVoiceIntermediateWords(props.features),
    [props.mode, props.features],
  );
  const bodySkeleton = props.mode === "body" ? getBodySkeletonGeometry(props.frames) : null;
  const voicePath = props.mode === "voice" ? createSyntheticWavePath(props.waveHistory) : "";
  const bodyLightProgress = getBodyLightProgress(progress);
  const bodyOpacity = getBodyDissolveOpacity(progress);
  const bodyScale = getBodyDissolveScale(progress);
  const bodyWordsOpacity = windowProgress(progress, 0.48, 0.82);
  const voiceOpacity = Math.min(1, 0.45 + progress * 0.4);

  return (
    <section
      className={`expression-transform expression-transform--${props.mode}${bodyScreen ? " expression-transform--body-screen" : ""}`}
      data-stage={stage}
      aria-busy="true"
      aria-hidden={props.decorative}
      aria-labelledby={`${props.mode}-transform-title`}
    >
      <div className="expression-transform__heading">
        {bodyScreen && (
          <p className="expression-transform__body-screen-copy" aria-live="polite">
            動きが、ことばへ変わっています
          </p>
        )}
        <span className="eyebrow">Sake Sense</span>
        <h2 id={`${props.mode}-transform-title`}>表現が、ことばへ近づいています</h2>
        <p aria-live="polite">{stageCopy(props.mode, stage)}</p>
      </div>
      <div className={props.mode === "body" ? "expression-transform__body-visual" : undefined}>
        <div className="expression-transform__visual" aria-hidden="true">
          {props.mode === "body" ? (
            <svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMid meet" role="presentation">
              <circle
                className="expression-transform__body-light"
                cx="160"
                cy="80"
                r="25"
                style={{
                  opacity: 0.12 + bodyLightProgress * 0.58,
                  transform: `scale(${0.82 + bodyLightProgress * 0.24})`,
                }}
              />
              <g
                className="expression-transform__body-dissolve"
                transform={`translate(160 80) scale(${bodyScale}) translate(-160 -80)`}
                style={{ opacity: bodyOpacity }}
              >
                <path
                  className="expression-transform__body-skeleton"
                  d={bodySkeleton?.skeletonPath}
                />
                {bodySkeleton?.skeletonPoints.map((point, index) => (
                  <circle
                    className="expression-transform__body-joint"
                    cx={point.x}
                    cy={point.y}
                    key={`${point.x}-${point.y}-${index}`}
                    r="3.5"
                  />
                ))}
              </g>
            </svg>
          ) : (
            <svg viewBox="0 0 320 64" role="presentation">
              <path
                className="expression-transform__abstract-line"
                d={voicePath || "M 0 32 L 320 32"}
                style={{ opacity: voiceOpacity }}
              />
              <circle
                className="expression-transform__pulse"
                cx="160"
                cy="32"
                r={10 + progress * 4}
                style={{ opacity: voiceOpacity * 0.65 }}
              />
            </svg>
          )}
        </div>
        {props.mode === "body" ? (
          <ul
            className="expression-transform__words expression-transform__words--body"
            aria-label="表現から見えている特徴"
          >
            {words.slice(0, 2).map((word, index) => (
              <li
                className="expression-transform__body-word"
                key={word}
                data-visible={bodyWordsOpacity > 0.01}
                style={{
                  opacity: bodyWordsOpacity,
                  left: `${18 + (index % 2) * 50}%`,
                  top: `${18 + index * 22}%`,
                }}
              >
                {word}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {props.mode === "voice" ? (
        <ul className="expression-transform__words" aria-label="表現から見えている特徴">
          {words.map((word) => (
            <li
              key={word}
              data-visible={bodyWordsOpacity > 0.01}
              style={{ opacity: bodyWordsOpacity }}
            >
              {word}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="expression-transform__assistive-status" aria-live="polite">
        {stage < 3 ? "表現をたどっています…" : "もうすぐ結果が表示されます…"}
      </p>
    </section>
  );
}
