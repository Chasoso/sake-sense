import { normalizeMotionSequence, JOINTS } from "./normalize";
import type {
  ExtendedMotionDescriptors,
  MotionJoint,
  MotionPoint,
  NormalizedMotionFrame,
  MotionPhase,
} from "./types";
import type { BodyPoseFrame } from "../../domain/body";

const EPSILON = 0.000001;

function distance(a: MotionPoint, b: MotionPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function variation(values: number[]): number {
  if (!values.length) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2))) / Math.max(mean, EPSILON);
}

function wristPath(frame: NormalizedMotionFrame): MotionPoint {
  const left = frame.joints.leftWrist;
  const right = frame.joints.rightWrist;
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function pathPoints(frames: NormalizedMotionFrame[]): MotionPoint[] {
  return frames.map(wristPath);
}

function segmentValues(frames: NormalizedMotionFrame[]): {
  distances: number[];
  durations: number[];
  speeds: number[];
} {
  const points = pathPoints(frames);
  const distances: number[] = [];
  const durations: number[] = [];
  const speeds: number[] = [];
  for (let index = 1; index < frames.length; index += 1) {
    const duration = Math.max(frames[index].tMs - frames[index - 1].tMs, 0);
    if (!duration) continue;
    const movement = distance(points[index - 1], points[index]);
    distances.push(movement);
    durations.push(duration);
    speeds.push(movement / duration);
  }
  return { distances, durations, speeds };
}

function direction(
  points: MotionPoint[],
): ExtendedMotionDescriptors["trajectory"]["dominantDirection"] {
  if (points.length < 2) return "still";
  const start = points[0];
  const end = points.at(-1)!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.hypot(dx, dy) < 0.04) return "still";
  if (Math.abs(dx) >= Math.abs(dy) * 1.25) return dx > 0 ? "right" : "left";
  if (Math.abs(dy) >= Math.abs(dx) * 1.25) return dy > 0 ? "down" : "up";
  return "mixed";
}

function reversalCount(points: MotionPoint[]): number {
  let count = 0;
  let previousSign = 0;
  for (let index = 1; index < points.length; index += 1) {
    const delta = points[index].x - points[index - 1].x;
    const sign = Math.abs(delta) > 0.02 ? Math.sign(delta) : 0;
    if (sign && previousSign && sign !== previousSign) count += 1;
    if (sign) previousSign = sign;
  }
  return count;
}

function pathShape(
  points: MotionPoint[],
  pathLength: number,
): ExtendedMotionDescriptors["trajectory"]["pathShape"] {
  if (points.length < 3 || pathLength < 0.04) return "straight";
  const displacement = distance(points[0], points.at(-1)!);
  const reversals = reversalCount(points);
  const closure = distance(points[0], points.at(-1)!) / Math.max(pathLength, EPSILON);
  if (reversals >= 2 && closure > 0.35) return "oscillating";
  if (closure < 0.35 && pathLength > 0.2) return "circular";
  if (displacement / pathLength > 0.82) return "straight";
  if (reversals >= 3) return "irregular";
  return "curved";
}

function accelerationTendency(
  speeds: number[],
): ExtendedMotionDescriptors["dynamics"]["accelerationTendency"] {
  if (speeds.length < 3) return "stable";
  const first = average(speeds.slice(0, Math.max(1, Math.floor(speeds.length / 3))));
  const last = average(speeds.slice(-Math.max(1, Math.floor(speeds.length / 3))));
  if (last > first * 1.25) return "accelerating";
  if (first > last * 1.25) return "decelerating";
  const middle = average(speeds);
  return variation(speeds) > 0.45 && Math.abs(middle - first) > middle * 0.2 ? "mixed" : "stable";
}

function dominantJoints(frames: NormalizedMotionFrame[]): MotionJoint[] {
  const movement = new Map<MotionJoint, number>(JOINTS.map((joint) => [joint, 0]));
  for (let index = 1; index < frames.length; index += 1) {
    JOINTS.forEach((joint) => {
      movement.set(
        joint,
        movement.get(joint)! +
          distance(frames[index - 1].joints[joint], frames[index].joints[joint]),
      );
    });
  }
  const ordered = [...movement.entries()].sort((left, right) => right[1] - left[1]);
  const maximum = ordered[0]?.[1] ?? 0;
  return ordered
    .filter(([, value]) => value >= maximum * 0.7 && value > 0.03)
    .slice(0, 3)
    .map(([joint]) => joint);
}

function phases(
  frames: NormalizedMotionFrame[],
  speeds: number[],
): { pauseCount: number; boundaries: number[] } {
  const peak = Math.max(...speeds, 0);
  const pauseIndices = speeds
    .map((speed, index) => (peak > 0 && speed <= peak * 0.12 ? index + 1 : -1))
    .filter((index) => index >= 0);
  const boundaries = [...new Set([0, ...pauseIndices, frames.length - 1])].sort((a, b) => a - b);
  return { pauseCount: pauseIndices.length ? 1 : 0, boundaries };
}

export function describeMotion(frames: BodyPoseFrame[]): ExtendedMotionDescriptors {
  const normalized = normalizeMotionSequence(frames);
  const points = pathPoints(normalized);
  const { distances, durations, speeds } = segmentValues(normalized);
  const pathLength = distances.reduce((sum, value) => sum + value, 0);
  const peakSpeed = Math.max(...speeds, 0);
  const meanSpeed = average(speeds);
  const extent = points.length ? Math.max(...points.map((point) => distance(points[0], point))) : 0;
  const { pauseCount, boundaries } = phases(normalized, speeds);
  const intervals = boundaries
    .slice(1)
    .map((boundary, index) => normalized[boundary].tMs - normalized[boundaries[index]].tMs);
  const leftMovement = normalized
    .slice(1)
    .reduce(
      (sum, frame, index) =>
        sum + distance(normalized[index].joints.leftWrist, frame.joints.leftWrist),
      0,
    );
  const rightMovement = normalized
    .slice(1)
    .reduce(
      (sum, frame, index) =>
        sum + distance(normalized[index].joints.rightWrist, frame.joints.rightWrist),
      0,
    );
  const amplitudes = points.map((point) => distance(points[0], point));
  const firstAmplitude = average(
    amplitudes.slice(0, Math.max(1, Math.floor(amplitudes.length / 3))),
  );
  const lastAmplitude = average(amplitudes.slice(-Math.max(1, Math.floor(amplitudes.length / 3))));
  const finalSpeeds = speeds.slice(-Math.max(1, Math.floor(speeds.length / 4)));
  const initialSpeed = average(speeds.slice(0, Math.max(1, Math.floor(speeds.length / 4))));
  const finalSpeed = average(finalSpeeds);
  const endingShape =
    finalSpeed < initialSpeed * 0.35
      ? "gradual"
      : finalSpeed > initialSpeed * 0.75
        ? "abrupt"
        : "sustained";
  const jointMovement = new Map<MotionJoint, number>(JOINTS.map((joint) => [joint, 0]));
  for (let index = 1; index < normalized.length; index += 1) {
    JOINTS.forEach((joint) =>
      jointMovement.set(
        joint,
        jointMovement.get(joint)! +
          distance(normalized[index - 1].joints[joint], normalized[index].joints[joint]),
      ),
    );
  }
  const activeJoints = [...jointMovement.values()].filter((value) => value > 0.03).length;
  const rhythmRepetitions =
    reversalCount(points) >= 2 ? Math.max(1, Math.floor(reversalCount(points) / 2)) : 1;
  return {
    durationMs: normalized.length ? Math.max(normalized.at(-1)!.tMs - normalized[0].tMs, 0) : 0,
    trajectory: {
      dominantDirection: direction(points),
      pathShape: pathShape(points, pathLength),
      pathComplexity: Math.min(
        pathLength /
          Math.max(distance(points[0] ?? { x: 0, y: 0 }, points.at(-1) ?? { x: 0, y: 0 }), 0.05),
        20,
      ),
      spatialExtent: extent,
    },
    dynamics: {
      meanSpeed,
      peakSpeed,
      speedVariation: variation(speeds),
      accelerationTendency: accelerationTendency(speeds),
      smoothness: 1 / (1 + variation(speeds)),
    },
    rhythm: {
      repetitionCount: rhythmRepetitions,
      temporalRegularity: 1 / (1 + variation(intervals)),
      pauseCount,
      intervalVariation: variation(intervals),
      amplitudeTrend:
        lastAmplitude > firstAmplitude * 1.25
          ? "growing"
          : firstAmplitude > lastAmplitude * 1.25
            ? "decaying"
            : "stable",
    },
    bodyUsage: {
      dominantJoints: dominantJoints(normalized),
      leftRightAsymmetry:
        Math.abs(leftMovement - rightMovement) / Math.max(leftMovement + rightMovement, EPSILON),
      symmetry:
        1 -
        Math.abs(leftMovement - rightMovement) / Math.max(leftMovement + rightMovement, EPSILON),
      participationExtent: activeJoints / JOINTS.length,
    },
    ending: {
      shape: endingShape,
      finalAmplitude: amplitudes.at(-1) ?? 0,
      decayDurationMs:
        endingShape === "gradual"
          ? average(durations.slice(-3)) * Math.min(3, finalSpeeds.length)
          : 0,
    },
  };
}

export function segmentMotionPhases(frames: BodyPoseFrame[], descriptors = describeMotion(frames)) {
  const normalized = normalizeMotionSequence(frames);
  if (normalized.length < 2) return [];
  const { speeds } = segmentValues(normalized);
  const peak = Math.max(...speeds, 0);
  const boundaries = [
    ...new Set([
      0,
      ...speeds
        .map((speed, index) => (peak > 0 && speed <= peak * 0.12 ? index + 1 : -1))
        .filter((index) => index > 0),
      normalized.length - 1,
    ]),
  ].sort((a, b) => a - b);
  const phases: MotionPhase[] = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    const start = normalized[boundaries[index - 1]];
    const end = normalized[boundaries[index]];
    const localSpeeds = speeds.slice(boundaries[index - 1], boundaries[index]);
    const localVariation = variation(localSpeeds);
    const label = localSpeeds.every((speed) => speed <= peak * 0.12)
      ? "pause"
      : descriptors.ending.shape === "gradual" && index === boundaries.length - 1
        ? "decelerating"
        : localVariation > 0.5
          ? "oscillating"
          : "active";
    phases.push({ startMs: start.tMs, endMs: end.tMs, label });
  }
  return phases.slice(0, 4);
}
