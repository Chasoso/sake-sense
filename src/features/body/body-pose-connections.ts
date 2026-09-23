export type BodyPoseConnection = readonly [number, number];

const SHOULDER_CONNECTIONS = [[11, 12]] as const satisfies readonly BodyPoseConnection[];
const ARM_CONNECTIONS = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
] as const satisfies readonly BodyPoseConnection[];
const TORSO_CONNECTIONS = [
  [11, 23],
  [12, 24],
  [23, 24],
] as const satisfies readonly BodyPoseConnection[];
const LEG_CONNECTIONS = [
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const satisfies readonly BodyPoseConnection[];

/** Single source of truth for the existing pose topology used by the debug pose renderer. */
export const BODY_POSE_CONNECTIONS = [
  ...SHOULDER_CONNECTIONS,
  ...ARM_CONNECTIONS,
  ...TORSO_CONNECTIONS,
  ...LEG_CONNECTIONS,
] as const;

/** Upper-body subset for the dev-only hybrid comparison renderer. */
export const BODY_POSE_UPPER_BODY_CONNECTIONS = [
  ...SHOULDER_CONNECTIONS,
  ...ARM_CONNECTIONS,
  ...TORSO_CONNECTIONS,
] as const;

/** Arm-only subset for the first hybrid comparison variant. */
export const BODY_POSE_ARM_CONNECTIONS = ARM_CONNECTIONS;
