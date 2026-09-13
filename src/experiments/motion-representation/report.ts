import { extractBodyMovementFeatures } from "../../domain/body";
import { createMotionSignature } from "./signature";
import { motionFixtures } from "./fixtures";
import type { BodyMovementFeatures } from "../../domain/body";
import type { MotionSignature } from "./types";

export type MotionComparison = {
  fixtureId: string;
  label: string;
  current: BodyMovementFeatures;
  signature: MotionSignature;
  intendedDifference: string;
};

function currentKey(features: BodyMovementFeatures): string {
  return [
    features.activeDurationMs > 1800 ? "long" : "short",
    features.motionShape.dominantDirection,
    features.motionShape.repetition,
    features.motionShape.participation,
    features.endingBehavior,
    features.spread >= 1.5 ? "broad" : "compact",
  ].join("|");
}

function signatureKey(signature: MotionSignature): string {
  return [
    signature.trajectory.pathShape,
    signature.trajectory.dominantDirection,
    Math.round(signature.trajectory.spatialExtent * 10),
    signature.dynamics.accelerationTendency,
    signature.rhythm.pauseCount,
    signature.rhythm.repetitionCount,
    signature.ending.shape,
    signature.bodyUsage.dominantJoints.join(","),
  ].join("|");
}

export function compareMotionRepresentations(): MotionComparison[] {
  return motionFixtures.map((fixture) => ({
    fixtureId: fixture.id,
    label: fixture.label,
    current: extractBodyMovementFeatures(fixture.frames),
    signature: createMotionSignature(fixture.frames),
    intendedDifference: fixture.intendedDifference,
  }));
}

export function summarizeCollisionCounts(comparisons = compareMotionRepresentations()) {
  const baselineKeys = comparisons.map(({ current }) => currentKey(current));
  const signatureKeys = comparisons.map(({ signature }) => signatureKey(signature));
  const unique = (keys: string[]) => new Set(keys).size;
  const baselineCollisions = comparisons.length - unique(baselineKeys);
  const signatureCollisions = comparisons.length - unique(signatureKeys);
  return {
    gestureCount: comparisons.length,
    baselineUnique: unique(baselineKeys),
    signatureUnique: unique(signatureKeys),
    baselineCollisions,
    signatureCollisions,
    recoveredDistinctions: Math.max(0, baselineCollisions - signatureCollisions),
  };
}

export function renderComparisonMarkdown(comparisons = compareMotionRepresentations()): string {
  const summary = summarizeCollisionCounts(comparisons);
  const rows = comparisons.map(({ label, current, signature, intendedDifference }) =>
    [
      label,
      `${current.motionShape.dominantDirection}/${current.motionShape.repetition}/${current.endingBehavior}`,
      `${signature.trajectory.pathShape}/${signature.dynamics.accelerationTendency}/${signature.rhythm.pauseCount}`,
      intendedDifference,
    ]
      .map((value) => String(value).replaceAll("|", "\\|"))
      .join(" | "),
  );
  return [
    "| Gesture | Current features | Motion Signature | Intended distinction |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
    `Baseline unique signatures: ${summary.baselineUnique}/${summary.gestureCount}`,
    `Motion Signature unique signatures: ${summary.signatureUnique}/${summary.gestureCount}`,
  ].join("\n");
}

export { currentKey, signatureKey };
