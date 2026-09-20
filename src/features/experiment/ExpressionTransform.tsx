import { useEffect, useMemo, useState } from "react";
import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import {
  createSyntheticWavePath,
  type SyntheticWavePoint,
  type VoiceFeatures,
} from "../../domain/voice";
import {
  getBodyIntermediateWords,
  getBodyVisualModel,
  getTransformStage,
  getVoiceIntermediateWords,
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

function bodyTrajectoryPath(frames: BodyPoseFrame[]): string {
  const points = frames
    .map((frame) => {
      const left = frame.landmarks[15];
      const right = frame.landmarks[16];
      if (!left && !right) return null;
      const x = left && right ? (left.x + right.x) / 2 : (left ?? right)!.x;
      const y = left && right ? (left.y + right.y) / 2 : (left ?? right)!.y;
      return { x: Math.min(Math.max(x, 0), 1) * 320, y: Math.min(Math.max(y, 0), 1) * 160 };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
  if (!points.length) return "M 24 80 L 296 80";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function bodySkeletonPath(frames: BodyPoseFrame[]): string {
  const frame = frames[Math.floor(frames.length / 2)] ?? frames[0];
  if (!frame) return "M 120 48 L 200 48 M 160 48 L 160 116 M 120 48 L 92 108 M 200 48 L 228 108";
  const point = (index: number) => {
    const landmark = frame.landmarks[index];
    return landmark ? `${(landmark.x * 320).toFixed(1)} ${(landmark.y * 160).toFixed(1)}` : null;
  };
  const shoulderLeft = point(11);
  const shoulderRight = point(12);
  const wristLeft = point(15);
  const wristRight = point(16);
  const lines = [
    shoulderLeft && shoulderRight ? `M ${shoulderLeft} L ${shoulderRight}` : null,
    shoulderLeft && wristLeft ? `M ${shoulderLeft} L ${wristLeft}` : null,
    shoulderRight && wristRight ? `M ${shoulderRight} L ${wristRight}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join(" ") : "M 120 48 L 200 48 M 160 48 L 160 116";
}

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
  const words = useMemo(
    () =>
      props.mode === "body"
        ? getBodyIntermediateWords(props.features)
        : getVoiceIntermediateWords(props.features),
    [props.mode, props.features],
  );
  const bodyPath = props.mode === "body" ? bodyTrajectoryPath(props.frames) : "";
  const skeletonPath = props.mode === "body" ? bodySkeletonPath(props.frames) : "";
  const bodyVisual = props.mode === "body" ? getBodyVisualModel(props.features) : null;
  const voicePath = props.mode === "voice" ? createSyntheticWavePath(props.waveHistory) : "";

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
      <div className="expression-transform__visual" aria-hidden="true">
        {props.mode === "body" ? (
          <svg viewBox="0 0 320 160" role="presentation">
            <path className="expression-transform__skeleton" d={skeletonPath} />
            <path className="expression-transform__trajectory" d={bodyPath} />
            <path className="expression-transform__abstract-line" d={bodyVisual?.abstractPath} />
            {Array.from({ length: bodyVisual?.repetitionCount ?? 1 }, (_, index) => (
              <path
                className="expression-transform__abstract-repeat"
                d={bodyVisual?.abstractPath}
                key={index}
                style={{
                  transform: `translate(${index * 8 - ((bodyVisual?.repetitionCount ?? 1) - 1) * 4}px, ${index % 2 ? 7 : -7}px)`,
                }}
              />
            ))}
          </svg>
        ) : (
          <svg viewBox="0 0 320 64" role="presentation">
            <path
              className="expression-transform__abstract-line"
              d={voicePath || "M 0 32 L 320 32"}
            />
            <circle className="expression-transform__pulse" cx="160" cy="32" r="12" />
          </svg>
        )}
      </div>
      <ul className="expression-transform__words" aria-label="表現から見えている特徴">
        {words.map((word) => (
          <li key={word} data-visible={stage >= 3}>
            {word}
          </li>
        ))}
      </ul>
      <p className="expression-transform__assistive-status" aria-live="polite">
        {stage < 3 ? "表現をたどっています…" : "もうすぐ結果が表示されます…"}
      </p>
    </section>
  );
}
