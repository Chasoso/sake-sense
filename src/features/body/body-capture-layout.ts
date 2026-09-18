export type BodyCaptureStatus =
  | "idle"
  | "loading"
  | "ready"
  | "capturing"
  | "captured"
  | "denied"
  | "unavailable";

/** Keeps the explanatory permission states separate from the camera-first experience. */
export function getBodyCaptureLayout(status: BodyCaptureStatus): "setup" | "capture" {
  return status === "ready" || status === "capturing" || status === "captured"
    ? "capture"
    : "setup";
}
