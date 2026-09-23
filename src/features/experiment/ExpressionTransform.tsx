import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import {
  BODY_HYBRID_CONTOUR_COLOR,
  BODY_HYBRID_CONTOUR_STYLE,
  POSE_GUIDANCE_COLOR,
  POSE_GUIDANCE_STYLES,
  type BodyHybridDisplaySnapshot,
} from "../body/body-pose-guidance";
import {
  createSyntheticWavePath,
  type SyntheticWavePoint,
  type VoiceFeatures,
} from "../../domain/voice";
import {
  getBodyDisplayWords,
  getBodyDissolveOpacity,
  getBodyAbsorbedPoint,
  getBodyLightProgress,
  getBodyTransformProgress,
  getTransformProgress,
  getTransformStage,
  getVoiceIntermediateWords,
  windowProgress,
  type TransformStage,
} from "./expression-transform";
import {
  getAspectPreservingTransform,
  projectNormalizedPointToViewport,
} from "../body/body-camera-cover";

type ExpressionTransformProps =
  | {
      mode: "body";
      features: BodyMovementFeatures;
      frames: BodyPoseFrame[];
      presentation?: "body-screen";
      decorative?: boolean;
      hybridSnapshot?: BodyHybridDisplaySnapshot | null;
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

function absorbedContourPath(contour: Array<{ x: number; y: number }>, progress: number): string {
  return contour
    .map((point, index) => {
      const absorbed = getBodyAbsorbedPoint(point, progress);
      return `${index === 0 ? "M" : "L"} ${absorbed.x.toFixed(1)} ${absorbed.y.toFixed(1)}`;
    })
    .concat("Z")
    .join(" ");
}

function projectBodyPoint(
  point: { x: number; y: number },
  transform: ReturnType<typeof getAspectPreservingTransform>,
): { x: number; y: number } {
  return projectNormalizedPointToViewport(point, transform);
}

export function ExpressionTransform(props: ExpressionTransformProps) {
  const [elapsed, setElapsed] = useState(0);
  const bodyHybridMaskId = useId().replace(/:/g, "");
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
  const bodyHybrid = props.mode === "body" ? props.hybridSnapshot : null;
  const bodyHybridTransform = bodyHybrid
    ? getAspectPreservingTransform(
        bodyHybrid.sourceWidth,
        bodyHybrid.sourceHeight,
        320,
        160,
        "contain",
      )
    : null;
  const bodyHybridOuterPath =
    bodyHybrid && bodyHybridTransform && bodyHybrid.outerContour.length > 1
      ? absorbedContourPath(
          bodyHybrid.outerContour.map((point) => projectBodyPoint(point, bodyHybridTransform)),
          progress,
        )
      : "";
  const bodyHybridStyle = POSE_GUIDANCE_STYLES["subtle-arms-torso-face"];
  const bodyHybridStyleVariables = {
    "--body-hybrid-contour-color": BODY_HYBRID_CONTOUR_COLOR,
    "--body-hybrid-guidance-color": POSE_GUIDANCE_COLOR,
    "--body-hybrid-body-opacity": bodyHybridStyle.opacity,
    "--body-hybrid-body-stroke-width": bodyHybridStyle.strokeWidth,
    "--body-hybrid-face-opacity": bodyHybridStyle.faceOpacity,
    "--body-hybrid-face-stroke-width": bodyHybridStyle.faceStrokeWidth,
    "--body-hybrid-outer-core-opacity": BODY_HYBRID_CONTOUR_STYLE.outerCoreOpacity,
    "--body-hybrid-outer-core-width": BODY_HYBRID_CONTOUR_STYLE.outerCoreStrokeWidth,
    "--body-hybrid-outer-glow-width": BODY_HYBRID_CONTOUR_STYLE.outerGlowWidthScale,
    "--body-hybrid-outer-glow-blur": `${BODY_HYBRID_CONTOUR_STYLE.glowBlurPx}px`,
    "--body-hybrid-outer-glow-opacity": BODY_HYBRID_CONTOUR_STYLE.outerGlowOpacity,
    "--body-hybrid-inner-opacity": BODY_HYBRID_CONTOUR_STYLE.innerOpacity,
    "--body-hybrid-inner-width": BODY_HYBRID_CONTOUR_STYLE.innerStrokeWidth,
  } as CSSProperties;
  const voicePath = props.mode === "voice" ? createSyntheticWavePath(props.waveHistory) : "";
  const bodyLightProgress = getBodyLightProgress(progress);
  const bodyOpacity = getBodyDissolveOpacity(progress);
  const bodyWordsOpacity = windowProgress(progress, 0.48, 0.82);
  const voiceOpacity = Math.min(1, 0.45 + progress * 0.4);

  return (
    <section
      className={`expression-transform expression-transform--${props.mode}${bodyScreen ? " expression-transform--body-screen" : ""}`}
      data-stage={stage}
      aria-busy="true"
      aria-hidden={props.decorative}
      aria-labelledby={`${props.mode}-transform-title`}
      style={props.mode === "body" ? bodyHybridStyleVariables : undefined}
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
              {bodyHybridOuterPath && (
                <defs>
                  <mask
                    id={bodyHybridMaskId}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width="320"
                    height="160"
                  >
                    <rect width="320" height="160" fill="white" />
                    <path d={bodyHybridOuterPath} fill="black" />
                  </mask>
                </defs>
              )}
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
              <g className="expression-transform__body-dissolve" style={{ opacity: bodyOpacity }}>
                {bodyHybrid ? (
                  <>
                    {bodyHybridOuterPath && (
                      <path
                        className="expression-transform__body-hybrid-outer-glow"
                        d={bodyHybridOuterPath}
                        mask={`url(#${bodyHybridMaskId})`}
                      />
                    )}
                    {bodyHybridOuterPath && (
                      <path
                        className="expression-transform__body-hybrid-outer"
                        d={bodyHybridOuterPath}
                      />
                    )}
                    {bodyHybrid.innerContours.map((contour, index) =>
                      contour.length > 1 ? (
                        <path
                          className="expression-transform__body-hybrid-inner"
                          d={absorbedContourPath(
                            contour.map((point) => projectBodyPoint(point, bodyHybridTransform!)),
                            progress,
                          )}
                          key={`inner-${index}`}
                        />
                      ) : null,
                    )}
                    {bodyHybrid.poseCurves.map(({ from, control, to, kind }, index) => {
                      const start = getBodyAbsorbedPoint(
                        projectBodyPoint(from, bodyHybridTransform!),
                        progress,
                      );
                      const bend = getBodyAbsorbedPoint(
                        projectBodyPoint(control, bodyHybridTransform!),
                        progress,
                      );
                      const end = getBodyAbsorbedPoint(
                        projectBodyPoint(to, bodyHybridTransform!),
                        progress,
                      );
                      return (
                        <path
                          className={`expression-transform__body-hybrid-${kind}`}
                          d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${bend.x.toFixed(1)} ${bend.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
                          key={`pose-${kind}-${index}`}
                        />
                      );
                    })}
                  </>
                ) : null}
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
