type ExposureMode = "continuous";

type ExposureCapabilities = {
  exposureMode?: readonly string[];
};

type ExposureConstraint = {
  advanced: Array<{ exposureMode: ExposureMode }>;
};

export type AndroidExposureResult = "not-android" | "unsupported" | "applied" | "failed";

export function isAndroidCameraEnvironment(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export function getAndroidExposurePlan(
  capabilities: ExposureCapabilities | undefined,
): ExposureConstraint | null {
  if (!capabilities?.exposureMode?.includes("continuous")) return null;
  return { advanced: [{ exposureMode: "continuous" }] };
}

export async function applyAndroidExposurePreferences(
  track: MediaStreamTrack | undefined,
  userAgent: string,
): Promise<AndroidExposureResult> {
  if (!track || !isAndroidCameraEnvironment(userAgent)) return "not-android";
  if (typeof track.getCapabilities !== "function") return "unsupported";

  let capabilities: ExposureCapabilities;
  try {
    capabilities = track.getCapabilities() as ExposureCapabilities;
    track.getSettings?.();
  } catch {
    return "unsupported";
  }

  const plan = getAndroidExposurePlan(capabilities);
  if (!plan || typeof track.applyConstraints !== "function") return "unsupported";

  try {
    await track.applyConstraints(plan as MediaTrackConstraints);
    return "applied";
  } catch {
    return "failed";
  }
}
