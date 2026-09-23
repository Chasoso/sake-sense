import { describe, expect, it, vi } from "vitest";
import {
  BODY_CAPTURE_COUNTDOWN_STEP_MS,
  createBodyCaptureCountdownScheduler,
  type BodyCaptureCountdown,
} from "./body-capture-countdown";

describe("Body capture countdown", () => {
  it("progresses 3 → 2 → 1 → complete on deterministic ticks", () => {
    vi.useFakeTimers();
    const values: BodyCaptureCountdown[] = [];
    const complete = vi.fn();
    const scheduler = createBodyCaptureCountdownScheduler((value) => values.push(value), complete);

    expect(scheduler.begin()).toBe(true);
    expect(values).toEqual([3]);
    expect(complete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(BODY_CAPTURE_COUNTDOWN_STEP_MS);
    expect(values).toEqual([3, 2]);
    expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(BODY_CAPTURE_COUNTDOWN_STEP_MS);
    expect(values).toEqual([3, 2, 1]);
    expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(BODY_CAPTURE_COUNTDOWN_STEP_MS);
    expect(values).toEqual([3, 2, 1, null]);
    expect(complete).toHaveBeenCalledOnce();
    expect(scheduler.isActive()).toBe(false);
    vi.useRealTimers();
  });

  it("ignores repeated begins while active and completes only once", () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    const scheduler = createBodyCaptureCountdownScheduler(() => undefined, complete);

    expect(scheduler.begin()).toBe(true);
    expect(scheduler.begin()).toBe(false);
    vi.advanceTimersByTime(BODY_CAPTURE_COUNTDOWN_STEP_MS * 3);

    expect(complete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("cancels pending ticks and prevents a delayed capture", () => {
    vi.useFakeTimers();
    const complete = vi.fn();
    const values: BodyCaptureCountdown[] = [];
    const scheduler = createBodyCaptureCountdownScheduler((value) => values.push(value), complete);

    scheduler.begin();
    scheduler.cancel();
    vi.advanceTimersByTime(BODY_CAPTURE_COUNTDOWN_STEP_MS * 4);

    expect(values).toEqual([3, null]);
    expect(complete).not.toHaveBeenCalled();
    expect(scheduler.isActive()).toBe(false);
    vi.useRealTimers();
  });
});
