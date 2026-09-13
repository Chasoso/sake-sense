import type { BodyLandmark, BodyPoseFrame } from "../../domain/body";
import type { MotionFixture, MotionPoint } from "./types";

const FRAME_COUNT = 13;
const DURATION_MS = 3000;

function createFrame(
  t: number,
  leftWrist: MotionPoint,
  rightWrist: MotionPoint = { x: 0.4, y: -0.5 },
  leftElbow = { x: -0.7, y: -0.25 },
  rightElbow = { x: 0.7, y: -0.25 },
): BodyPoseFrame {
  const landmarks: BodyLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  landmarks[11] = { x: -0.5, y: 0 };
  landmarks[12] = { x: 0.5, y: 0 };
  landmarks[13] = leftElbow;
  landmarks[14] = rightElbow;
  landmarks[15] = leftWrist;
  landmarks[16] = rightWrist;
  landmarks[23] = { x: -0.3, y: 1 };
  landmarks[24] = { x: 0.3, y: 1 };
  return { t, landmarks };
}

function sequence(
  path: (progress: number) => MotionPoint,
  rightPath?: (progress: number) => MotionPoint,
): BodyPoseFrame[] {
  return Array.from({ length: FRAME_COUNT }, (_, index) => {
    const progress = index / (FRAME_COUNT - 1);
    const wrist = path(progress);
    return createFrame(index * (DURATION_MS / (FRAME_COUNT - 1)), wrist, rightPath?.(progress));
  });
}

const baseWrist = { x: -0.4, y: -0.5 };

export const motionFixtures: MotionFixture[] = [
  {
    id: "large-lateral-sweep",
    label: "large lateral sweep",
    intendedDifference: "large extent, one-way path",
    frames: sequence((p) => ({ x: -1.2 + 2.0 * p, y: -0.5 })),
  },
  {
    id: "small-lateral-sweep",
    label: "small lateral sweep",
    intendedDifference: "same direction, smaller extent",
    frames: sequence((p) => ({ x: -0.4 + 0.35 * p, y: -0.5 })),
  },
  {
    id: "fingertip-only-lateral",
    label: "fingertip-only lateral movement",
    intendedDifference: "sub-wrist articulation is not observable in Pose",
    frames: sequence((p) => ({ x: baseWrist.x + (p > 0.45 ? 0.025 : 0), y: baseWrist.y })),
  },
  {
    id: "wrist-oscillation",
    label: "wrist-centered small oscillation",
    intendedDifference: "small repeated wrist reversal",
    frames: sequence((p) => ({ x: -0.4 + 0.12 * Math.sin(p * Math.PI * 4), y: -0.5 })),
  },
  {
    id: "circular-movement",
    label: "circular movement",
    intendedDifference: "closed curved path",
    frames: sequence((p) => ({
      x: -0.4 + 0.45 * Math.cos(p * Math.PI * 2),
      y: -0.5 + 0.45 * Math.sin(p * Math.PI * 2),
    })),
  },
  {
    id: "shrinking-circle",
    label: "shrinking circle",
    intendedDifference: "closed path with decaying amplitude",
    frames: sequence((p) => {
      const radius = 0.55 * (1 - p * 0.8);
      return {
        x: -0.4 + radius * Math.cos(p * Math.PI * 2),
        y: -0.5 + radius * Math.sin(p * Math.PI * 2),
      };
    }),
  },
  {
    id: "rapid-outward-stop",
    label: "rapid outward expansion then stop",
    intendedDifference: "fast growth followed by a sustained ending",
    frames: sequence((p) => ({ x: -0.4 + 1.2 * Math.min(p * 2.5, 1), y: -0.5 })),
  },
  {
    id: "slow-expand-return",
    label: "slow expansion then return",
    intendedDifference: "gradual outward and inward path",
    frames: sequence((p) => ({ x: -0.4 + 0.9 * Math.sin(p * Math.PI), y: -0.5 })),
  },
  {
    id: "fine-tremor",
    label: "fine tremor",
    intendedDifference: "low-amplitude high-frequency motion",
    frames: sequence((p) => ({
      x: -0.4 + 0.025 * Math.sin(p * Math.PI * 12),
      y: -0.5 + 0.015 * Math.cos(p * Math.PI * 12),
    })),
  },
  {
    id: "pause",
    label: "movement with a pause",
    intendedDifference: "active, paused, active phases",
    frames: sequence((p) => ({
      x: -0.4 + (p < 0.3 ? p : p < 0.65 ? 0.3 : 0.3 + (p - 0.65) * 1.2),
      y: -0.5,
    })),
  },
  {
    id: "fast-to-slow",
    label: "fast start then gradual slowdown",
    intendedDifference: "decelerating speed profile",
    frames: sequence((p) => ({ x: -0.4 + 1.0 * (1 - (1 - p) ** 3), y: -0.5 })),
  },
  {
    id: "asymmetric-left-right",
    label: "asymmetric left/right movement",
    intendedDifference: "left wrist active while right wrist remains still",
    frames: sequence(
      (p) => ({ x: -0.4 + 0.9 * p, y: -0.5 }),
      () => ({ x: 0.4, y: -0.5 }),
    ),
  },
];
