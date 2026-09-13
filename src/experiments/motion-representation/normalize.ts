import type { BodyPoseFrame } from "../../domain/body";
import type { MotionJoint, MotionPoint, NormalizedMotionFrame } from "./types";

const JOINT_INDEX: Record<MotionJoint, number> = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
};

const JOINTS = Object.keys(JOINT_INDEX) as MotionJoint[];

function midpoint(left: MotionPoint, right: MotionPoint): MotionPoint {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

export function normalizeMotionSequence(frames: BodyPoseFrame[]): NormalizedMotionFrame[] {
  const valid = frames.filter((frame) => frame.landmarks[11] && frame.landmarks[12]);
  if (!valid.length) return [];
  const scale = Math.max(
    Math.hypot(
      valid[0].landmarks[12].x - valid[0].landmarks[11].x,
      valid[0].landmarks[12].y - valid[0].landmarks[11].y,
    ),
    0.001,
  );
  return valid
    .map((frame) => {
      const shoulderCenter = midpoint(frame.landmarks[11], frame.landmarks[12]);
      const joints = {} as Record<MotionJoint, MotionPoint>;
      JOINTS.forEach((joint) => {
        const landmark = frame.landmarks[JOINT_INDEX[joint]] ?? frame.landmarks[11];
        joints[joint] = {
          x: (landmark.x - shoulderCenter.x) / scale,
          y: (landmark.y - shoulderCenter.y) / scale,
        };
      });
      return { tMs: frame.t, joints };
    })
    .map((frame) => ({
      ...frame,
      joints: Object.fromEntries(
        JOINTS.map((joint) => [
          joint,
          {
            x: frame.joints[joint].x,
            y: frame.joints[joint].y,
          },
        ]),
      ) as Record<MotionJoint, MotionPoint>,
    }));
}

export { JOINTS };
