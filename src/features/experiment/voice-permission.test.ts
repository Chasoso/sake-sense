import { describe, expect, it, vi } from "vitest";
import {
  classifyVoiceAudioInitializationError,
  classifyVoiceCaptureError,
  cleanupVoiceStartupResources,
  getVoiceFailureMessage,
  getVoicePermissionGuidance,
  getVoicePermissionPlatform,
  requestVoiceMicrophone,
} from "./voice-permission";

describe("voice permission handling", () => {
  it.each([
    ["NotAllowedError", "permission-denied"],
    ["NotFoundError", "microphone-unavailable"],
    ["NotReadableError", "microphone-busy"],
    ["OtherError", "unknown"],
  ])("classifies %s without requiring a DOMException", (name, expected) => {
    expect(classifyVoiceCaptureError({ name })).toBe(expected);
  });

  it("keeps post-permission audio setup failures separate", () => {
    expect(classifyVoiceAudioInitializationError()).toBe("audio-initialization");
  });

  it("provides actionable permission-denied copy", () => {
    expect(getVoiceFailureMessage("permission-denied")).toContain("許可");
  });

  it("provides iOS guidance that also covers Chrome and Safari settings", () => {
    expect(
      getVoicePermissionPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    ).toBe("ios");
    const guidance = getVoicePermissionGuidance(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    expect(guidance).toContain("Safari");
    expect(guidance).toContain("Chrome");
  });

  it("provides Android site and app permission guidance", () => {
    const guidance = getVoicePermissionGuidance("Mozilla/5.0 (Linux; Android 14) Chrome/128");
    expect(guidance).toContain("Chrome");
    expect(guidance).toContain("Android");
  });

  it("can request the microphone again for retry", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(requestVoiceMicrophone(getUserMedia)).resolves.toBe(stream);
    await expect(requestVoiceMicrophone(getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, { audio: true });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
  });

  it("closes an AudioContext after post-permission startup failure", async () => {
    const stop = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const context = { close } as unknown as AudioContext;

    await cleanupVoiceStartupResources(stream, context);

    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not let cleanup failure replace the startup failure", async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const context = {
      close: vi.fn().mockRejectedValue(new Error("close failed")),
    } as unknown as AudioContext;

    await expect(cleanupVoiceStartupResources(stream, context)).resolves.toBeUndefined();
  });
});
