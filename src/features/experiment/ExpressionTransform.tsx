import { useEffect, useMemo, useState } from "react";
import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import {
  createSyntheticWavePath,
  type SyntheticWavePoint,
  type VoiceFeatures,
} from "../../domain/voice";
import {
  getBodyIntermediateWords,
  getBodyTrailGeometry,
  getBodyVisualModel,
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
      waveHistory?: never;
      voiceFeatures?: never;
    }
  | {
      mode: "voice";
      features: VoiceFeatures;
      waveHistory: SyntheticWavePoint[];
      frames?: never;
      voiceFeatures?: never;
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

  const stage = getTransformStage(elapsed);
  const progress = getTransformProgress(elapsed);
  const words = useMemo(
    () =>
      props.mode === "body"
        ? getBodyIntermediateWords(props.features)
        : getVoiceIntermediateWords(props.features),
    [props.mode, props.features],
  );
  const bodyTrail = props.mode === "body" ? getBodyTrailGeometry(props.frames) : null;
  const bodyVisual = props.mode === "body" ? getBodyVisualModel(props.features) : null;
  const voicePath = props.mode === "voice" ? createSyntheticWavePath(props.waveHistory) : "";
  const skeletonProgress = 1 - windowProgress(progress, 0, 0.3);
  const sharpTrailProgress = windowProgress(progress, 0.05, 0.55);
  const softTrailProgress = windowProgress(progress, 0.2, 0.8);
  const mistProgress = windowProgress(progress, 0.35, 1);
  const bodyWordsOpacity = windowProgress(progress, 0.68, 1);
  const voiceOpacity = Math.min(1, 0.45 + progress * 0.4);

  return (
    <section
      className={`expression-transform expression-transform--${props.mode}`}
      data-stage={stage}
      data-direction={bodyVisual?.direction}
      data-expansion={bodyVisual?.expansion}
      data-ending={bodyVisual?.ending}
      aria-busy="true"
      aria-labelledby={`${props.mode}-transform-title`}
    >
      <div className="expression-transform__heading">
        <span className="eyebrow">Sake Sense</span>
        <h2 id={`${props.mode}-transform-title`}>表現が、ことばへ近づいています</h2>
        <p aria-live="polite">{stageCopy(props.mode, stage)}</p>
      </div>
      <div className={props.mode === "body" ? "expression-transform__body-visual" : undefined}>
        <div className="expression-transform__visual" aria-hidden="true">
          {props.mode === "body" ? (
            <svg viewBox="0 0 320 160" role="presentation">
              <path
                className="expression-transform__body-skeleton"
                d={bodyTrail?.skeletonPath}
                style={{ opacity: skeletonProgress }}
              />
              {bodyTrail?.skeletonPoints.map((point, index) => (
                <circle
                  className="expression-transform__body-joint"
                  cx={point.x}
                  cy={point.y}
                  key={`${point.x}-${point.y}-${index}`}
                  r="3.5"
                  style={{ opacity: skeletonProgress }}
                />
              ))}
              <path
                className="expression-transform__body-trail--primary"
                d={bodyTrail?.primaryPath}
                style={{
                  opacity: sharpTrailProgress * (1 - mistProgress * 0.35),
                  strokeWidth: 2 + sharpTrailProgress * 2,
                }}
              />
              <path
                className="expression-transform__body-trail--secondary"
                d={bodyTrail?.leftWristPath}
                style={{
                  opacity: softTrailProgress * 0.34,
                  transform: `translate(${bodyVisual?.softOffset.x ?? 0}px, ${bodyVisual?.softOffset.y ?? 0}px)`,
                }}
              />
              <path
                className="expression-transform__body-trail--secondary"
                d={bodyTrail?.rightWristPath}
                style={{
                  opacity: softTrailProgress * 0.34,
                  transform: `translate(${-(bodyVisual?.softOffset.x ?? 0)}px, ${-(bodyVisual?.softOffset.y ?? 0)}px)`,
                }}
              />
              <path
                className="expression-transform__body-trail--secondary"
                d={bodyTrail?.centerPath}
                style={{
                  opacity: softTrailProgress * 0.22,
                  transform: `translate(${(bodyVisual?.softOffset.x ?? 0) * 0.5}px, ${(bodyVisual?.softOffset.y ?? 0) * 0.5}px)`,
                }}
              />
              <path
                className="expression-transform__body-trail--soft"
                d={bodyTrail?.primaryPath}
                style={{
                  opacity: softTrailProgress * 0.58,
                  strokeWidth: 5 + softTrailProgress * 5,
                  transform: `translate(${bodyVisual?.softOffset.x ?? 0}px, ${bodyVisual?.softOffset.y ?? 0}px) scale(${1 + (bodyVisual?.trailSpread ?? 1) * progress * 0.04})`,
                }}
              />
              <path
                className="expression-transform__body-trail--mist"
                d={bodyTrail?.primaryPath}
                style={{
                  opacity: mistProgress * (0.32 - (bodyVisual?.endingFade ?? 0) * 0.16),
                  strokeWidth: 10 + mistProgress * 8,
                  transform: `translate(${(bodyVisual?.softOffset.x ?? 0) * 1.7}px, ${(bodyVisual?.softOffset.y ?? 0) * 1.7}px) scale(${1 + (bodyVisual?.trailSpread ?? 1) * 0.08})`,
                }}
              />
              {[-1, 1].map((offset) => (
                <path
                  className="expression-transform__body-trail--echo"
                  d={bodyTrail?.primaryPath}
                  key={offset}
                  style={{
                    opacity: mistProgress * (bodyVisual?.echoStrength ?? 0.06),
                    transform: `translate(${offset * 8}px, ${offset * -6}px)`,
                  }}
                />
              ))}
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
            {words.slice(0, 3).map((word, index) => (
              <li
                className="expression-transform__body-word"
                key={word}
                data-visible={bodyWordsOpacity > 0.01}
                style={{
                  opacity: bodyWordsOpacity,
                  transitionDelay: `${index * 120}ms`,
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
