export type BodyCaptureCountdown = 3 | 2 | 1 | null;

type CountdownTimerApi = {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timerId: number) => void;
};

const defaultTimerApi: CountdownTimerApi = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs) as unknown as number,
  clearTimeout: (timerId) => globalThis.clearTimeout(timerId),
};

export type BodyCaptureCountdownScheduler = {
  begin: () => boolean;
  cancel: () => void;
  isActive: () => boolean;
};

export const BODY_CAPTURE_COUNTDOWN_STEP_MS = 1000;

export function createBodyCaptureCountdownScheduler(
  onChange: (value: BodyCaptureCountdown) => void,
  onComplete: () => void,
  timerApi: CountdownTimerApi = defaultTimerApi,
): BodyCaptureCountdownScheduler {
  let current: BodyCaptureCountdown = null;
  let timerId: number | null = null;
  let generation = 0;

  const cancel = () => {
    generation += 1;
    if (timerId !== null) timerApi.clearTimeout(timerId);
    timerId = null;
    if (current !== null) {
      current = null;
      onChange(null);
    }
  };

  const begin = (): boolean => {
    if (timerId !== null || current !== null) return false;
    const activeGeneration = ++generation;
    const schedule = (value: Exclude<BodyCaptureCountdown, null>) => {
      timerId = timerApi.setTimeout(() => {
        if (activeGeneration !== generation) return;
        timerId = null;
        if (value === 1) {
          current = null;
          onChange(null);
          onComplete();
          return;
        }
        current = (value - 1) as Exclude<BodyCaptureCountdown, null>;
        onChange(current);
        schedule(current);
      }, BODY_CAPTURE_COUNTDOWN_STEP_MS);
    };

    current = 3;
    onChange(current);
    schedule(current);
    return true;
  };

  return {
    begin,
    cancel,
    isActive: () => current !== null || timerId !== null,
  };
}
