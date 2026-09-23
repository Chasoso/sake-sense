import { describe, expect, it, vi } from "vitest";
import {
  applyAndroidExposurePreferences,
  getAndroidExposurePlan,
  isAndroidCameraEnvironment,
} from "./body-camera-exposure";

describe("body camera exposure", () => {
  it("detects Android without applying the policy to other platforms", () => {
    expect(isAndroidCameraEnvironment("Mozilla/5.0 (Linux; Android 14) Chrome/128")).toBe(true);
    expect(
      isAndroidCameraEnvironment("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    ).toBe(false);
    expect(isAndroidCameraEnvironment("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });

  it("plans continuous exposure only when the capability is advertised", () => {
    expect(getAndroidExposurePlan({ exposureMode: ["manual", "continuous"] })).toEqual({
      advanced: [{ exposureMode: "continuous" }],
    });
    expect(getAndroidExposurePlan({ exposureMode: ["manual"] })).toBeNull();
    expect(getAndroidExposurePlan(undefined)).toBeNull();
  });

  it("is a no-op when capabilities are unavailable", async () => {
    const applyConstraints = vi.fn();
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await expect(
      applyAndroidExposurePreferences(track, "Mozilla/5.0 (Linux; Android 14) Chrome/128"),
    ).resolves.toBe("unsupported");
    expect(applyConstraints).not.toHaveBeenCalled();
  });

  it("does not apply Android constraints on non-Android platforms", async () => {
    const track = {
      getCapabilities: vi.fn(() => ({ exposureMode: ["continuous"] })),
      applyConstraints: vi.fn(),
    } as unknown as MediaStreamTrack;

    await expect(
      applyAndroidExposurePreferences(
        track,
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
    ).resolves.toBe("not-android");
    expect(track.applyConstraints).not.toHaveBeenCalled();
  });

  it("applies continuous exposure when supported", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      getCapabilities: vi.fn(() => ({ exposureMode: ["manual", "continuous"] })),
      getSettings: vi.fn(() => ({ exposureMode: "manual" })),
      applyConstraints,
    } as unknown as MediaStreamTrack;

    await expect(
      applyAndroidExposurePreferences(track, "Mozilla/5.0 (Linux; Android 14) Chrome/128"),
    ).resolves.toBe("applied");
    expect(applyConstraints).toHaveBeenCalledWith({
      advanced: [{ exposureMode: "continuous" }],
    });
  });

  it("keeps camera setup resilient when applyConstraints rejects", async () => {
    const track = {
      getCapabilities: vi.fn(() => ({ exposureMode: ["continuous"] })),
      applyConstraints: vi.fn().mockRejectedValue(new Error("unsupported camera control")),
    } as unknown as MediaStreamTrack;

    await expect(
      applyAndroidExposurePreferences(track, "Mozilla/5.0 (Linux; Android 14) Chrome/128"),
    ).resolves.toBe("failed");
  });
});
