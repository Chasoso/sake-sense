import { extractBodyMovementFeatures, type BodyMovementFeatures } from "../../domain/body";
import { buildSensoryBridgeInput, type SensoryBridgeInput } from "../../domain/sensory-bridge";
import { createMotionSignature } from "./signature";
import { describeMotion } from "./descriptors";
import { motionFixtures } from "./fixtures";
import type { ExtendedMotionDescriptors, MotionSignature } from "./types";

const KNOWN_UNOBSERVABLE_FIXTURE_IDS = new Set(["fingertip-only-lateral"]);

export type MotionComparison = {
  fixtureId: string;
  label: string;
  current: BodyMovementFeatures;
  coarse: SensoryBridgeInput;
  extended: ExtendedMotionDescriptors;
  signature: MotionSignature;
  intendedDifference: string;
};

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function coarseKey(input: SensoryBridgeInput): string {
  return [
    input.duration,
    input.ending,
    input.expansion,
    input.direction,
    input.repetition,
    input.participation,
    input.spread,
    input.speed,
  ].join("|");
}

function fullCurrentKey(features: BodyMovementFeatures): string {
  return JSON.stringify({
    frameCount: features.frameCount,
    captureDurationMs: quantize(features.captureDurationMs, 250),
    activeDurationMs: quantize(features.activeDurationMs, 250),
    totalMovement: quantize(features.totalMovement, 0.05),
    averageSpeed: quantize(features.averageSpeed, 0.0001),
    peakSpeed: quantize(features.peakSpeed, 0.0001),
    hasSustainedFastMovement: features.hasSustainedFastMovement === true,
    spread: quantize(features.spread, 0.1),
    hasMeaningfulMovement: features.hasMeaningfulMovement,
    activeJointCount: features.activeJointCount,
    endingSpeedRatio: quantize(features.endingSpeedRatio, 0.1),
    endingBehavior: features.endingBehavior,
    motionShape: features.motionShape,
  });
}

function extendedKey(descriptors: ExtendedMotionDescriptors): string {
  return JSON.stringify({
    durationMs: quantize(descriptors.durationMs, 250),
    trajectory: {
      ...descriptors.trajectory,
      pathComplexity: quantize(descriptors.trajectory.pathComplexity, 0.5),
      spatialExtent: quantize(descriptors.trajectory.spatialExtent, 0.1),
    },
    dynamics: {
      ...descriptors.dynamics,
      meanSpeed: quantize(descriptors.dynamics.meanSpeed, 0.0001),
      peakSpeed: quantize(descriptors.dynamics.peakSpeed, 0.0001),
      speedVariation: quantize(descriptors.dynamics.speedVariation, 0.25),
      smoothness: quantize(descriptors.dynamics.smoothness, 0.1),
    },
    rhythm: {
      ...descriptors.rhythm,
      temporalRegularity: quantize(descriptors.rhythm.temporalRegularity, 0.1),
      intervalVariation: quantize(descriptors.rhythm.intervalVariation, 0.25),
    },
    bodyUsage: {
      ...descriptors.bodyUsage,
      leftRightAsymmetry: quantize(descriptors.bodyUsage.leftRightAsymmetry, 0.1),
      symmetry: quantize(descriptors.bodyUsage.symmetry, 0.1),
      participationExtent: quantize(descriptors.bodyUsage.participationExtent, 0.1),
    },
    ending: {
      ...descriptors.ending,
      finalAmplitude: quantize(descriptors.ending.finalAmplitude, 0.1),
      decayDurationMs: quantize(descriptors.ending.decayDurationMs, 250),
    },
  });
}

function signatureKey(signature: MotionSignature): string {
  return JSON.stringify({
    trajectory: {
      ...signature.trajectory,
      pathComplexity: quantize(signature.trajectory.pathComplexity, 0.5),
      spatialExtent: quantize(signature.trajectory.spatialExtent, 0.2),
    },
    dynamics: {
      accelerationTendency: signature.dynamics.accelerationTendency,
      speedVariation: quantize(signature.dynamics.speedVariation, 0.25),
      smoothness: quantize(signature.dynamics.smoothness, 0.1),
    },
    rhythm: signature.rhythm,
    bodyUsage: {
      dominantJoints: signature.bodyUsage.dominantJoints,
      leftRightAsymmetry: quantize(signature.bodyUsage.leftRightAsymmetry, 0.1),
      participationExtent: quantize(signature.bodyUsage.participationExtent, 0.1),
    },
    ending: {
      shape: signature.ending.shape,
      finalAmplitude: quantize(signature.ending.finalAmplitude, 0.1),
      decayDurationMs: quantize(signature.ending.decayDurationMs, 250),
    },
    phases: signature.phases.map((phase) => phase.label),
  });
}

function collisionPairs(
  comparisons: MotionComparison[],
  key: (comparison: MotionComparison) => string,
) {
  const pairs: Array<{ left: string; right: string }> = [];
  for (let left = 0; left < comparisons.length; left += 1) {
    for (let right = left + 1; right < comparisons.length; right += 1) {
      if (key(comparisons[left]) === key(comparisons[right])) {
        pairs.push({ left: comparisons[left].fixtureId, right: comparisons[right].fixtureId });
      }
    }
  }
  return pairs;
}

function uniqueCount(
  comparisons: MotionComparison[],
  key: (comparison: MotionComparison) => string,
): number {
  return new Set(comparisons.map(key)).size;
}

export function compareMotionRepresentations(): MotionComparison[] {
  return motionFixtures.map((fixture) => {
    const current = extractBodyMovementFeatures(fixture.frames);
    return {
      fixtureId: fixture.id,
      label: fixture.label,
      current,
      coarse: buildSensoryBridgeInput(current),
      extended: describeMotion(fixture.frames),
      signature: createMotionSignature(fixture.frames),
      intendedDifference: fixture.intendedDifference,
    };
  });
}

export function summarizeCollisionCounts(comparisons = compareMotionRepresentations()) {
  const levels = {
    coarse: collisionPairs(comparisons, (comparison) => coarseKey(comparison.coarse)),
    fullCurrent: collisionPairs(comparisons, (comparison) => fullCurrentKey(comparison.current)),
    extended: collisionPairs(comparisons, (comparison) => extendedKey(comparison.extended)),
    motionSignature: collisionPairs(comparisons, (comparison) =>
      signatureKey(comparison.signature),
    ),
  };
  const recoveredObservableDistinctions = levels.coarse.filter((pair) => {
    const observable =
      !KNOWN_UNOBSERVABLE_FIXTURE_IDS.has(pair.left) &&
      !KNOWN_UNOBSERVABLE_FIXTURE_IDS.has(pair.right);
    return (
      observable &&
      !levels.motionSignature.some(
        (signaturePair) => signaturePair.left === pair.left && signaturePair.right === pair.right,
      )
    );
  }).length;
  return {
    fixtureCount: comparisons.length,
    coarseUnique: uniqueCount(comparisons, (comparison) => coarseKey(comparison.coarse)),
    fullCurrentUnique: uniqueCount(comparisons, (comparison) => fullCurrentKey(comparison.current)),
    extendedUnique: uniqueCount(comparisons, (comparison) => extendedKey(comparison.extended)),
    motionSignatureUnique: uniqueCount(comparisons, (comparison) =>
      signatureKey(comparison.signature),
    ),
    knownUnobservableFixtureCount: comparisons.filter(({ fixtureId }) =>
      KNOWN_UNOBSERVABLE_FIXTURE_IDS.has(fixtureId),
    ).length,
    recoveredObservableDistinctions,
    collisionPairs: levels,
  };
}

export function renderComparisonMarkdown(comparisons = compareMotionRepresentations()): string {
  const summary = summarizeCollisionCounts(comparisons);
  const rows = comparisons.map(({ label, coarse, current, signature, intendedDifference }) =>
    [
      label,
      `${coarse.duration}/${coarse.ending}/${coarse.direction}/${coarse.repetition}/${coarse.participation}/${coarse.spread}/${coarse.speed}`,
      `${current.motionShape.dominantDirection}/${current.endingBehavior}`,
      `${signature.trajectory.pathShape}/${signature.dynamics.accelerationTendency}/${signature.rhythm.pauseCount}`,
      intendedDifference,
    ]
      .map((value) => String(value).replaceAll("|", "\\|"))
      .join(" | "),
  );
  return [
    "| Gesture | Coarse contract | Full current | Motion Signature | Intended distinction |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
    `Fixture count: ${summary.fixtureCount}`,
    `Coarse contract unique: ${summary.coarseUnique}/${summary.fixtureCount}`,
    `Full BodyMovementFeatures unique: ${summary.fullCurrentUnique}/${summary.fixtureCount}`,
    `Extended descriptor unique: ${summary.extendedUnique}/${summary.fixtureCount}`,
    `Motion Signature unique: ${summary.motionSignatureUnique}/${summary.fixtureCount}`,
    `Known-unobservable fixtures: ${summary.knownUnobservableFixtureCount}`,
    `Recovered observable distinctions: ${summary.recoveredObservableDistinctions}`,
  ].join("\n");
}

export { coarseKey, extendedKey, fullCurrentKey, signatureKey };
