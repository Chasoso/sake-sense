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
  surface: "viewport" | "review";
  details: "contained";
  topOverlay: "surface";
  bottomOverlay: "surface" | "review-actions";
} {
  const isCaptured = status === "captured";

  return {
    shell: "body-shell",
    surface: isCaptured ? "review" : "viewport",
    details: "contained",
    topOverlay: "surface",
    bottomOverlay: isCaptured ? "review-actions" : "surface",
  };
}
