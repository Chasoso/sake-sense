export type BodyCaptureStatus =
  | "idle"
  | "loading"
  | "ready"
  | "capturing"
  | "captured"
  | "denied"
  | "unavailable";

/** The Body experiment stays in one capture shell until it transitions to the result screen. */
export function getBodyCaptureLayout(status: BodyCaptureStatus): {
  shell: "body-shell";
  topOverlay: "surface";
  bottomOverlay: "surface";
  mobileSurface: "edge-to-edge";
} {
  void status;
  return {
    shell: "body-shell",
    topOverlay: "surface",
    bottomOverlay: "surface",
    mobileSurface: "edge-to-edge",
  };
}
