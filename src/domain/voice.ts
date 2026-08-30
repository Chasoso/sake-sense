import type { GestureRepresentation } from "./gesture";

export type VoiceSample = {
  t: number;
  level: number;
};

export type VoiceFeatures = {
  durationMs: number;
  averageIntensity: number;
  pauseCount: number;
  endingBehavior: "maintained" | "fading" | "unknown";
};

export function estimatePitch(samples: ArrayLike<number>, sampleRate: number): number | null {
  if (samples.length < 32 || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;

  const centered = Array.from(samples, (sample) => (Number.isFinite(sample) ? sample - 128 : 0));
  const rms = Math.sqrt(
    centered.reduce((total, sample) => total + sample * sample, 0) / centered.length,
  );
  if (rms < 3) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / 350));
  const maxLag = Math.min(Math.floor(sampleRate / 80), centered.length - 1);
  let bestLag = 0;
  let bestCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let baseEnergy = 0;
    let lagEnergy = 0;
    for (let index = 0; index < centered.length - lag; index += 1) {
      correlation += centered[index] * centered[index + lag];
      baseEnergy += centered[index] * centered[index];
      lagEnergy += centered[index + lag] * centered[index + lag];
    }
    const normalized =
      baseEnergy && lagEnergy ? correlation / Math.sqrt(baseEnergy * lagEnergy) : 0;
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  return bestLag && bestCorrelation >= 0.35 ? sampleRate / bestLag : null;
}

export type SyntheticWavePoint = {
  amplitude: number;
  frequency: number;
  phase: number;
};

export function smoothWaveValue(previous: number, current: number, factor = 0.3): number {
  const safeFactor = Math.min(Math.max(factor, 0), 1);
  return previous + (current - previous) * safeFactor;
}

export function mapPitchToWaveFrequency(
  pitch: number | null,
  minPitch = 80,
  maxPitch = 360,
  minFrequency = 1.5,
  maxFrequency = 8,
): number {
  const safePitch = Number.isFinite(pitch)
    ? Math.min(Math.max(pitch ?? minPitch, minPitch), maxPitch)
    : 160;
  const normalized = Math.log(safePitch / minPitch) / Math.log(maxPitch / minPitch);
  return minFrequency + normalized * (maxFrequency - minFrequency);
}

export function advanceWavePhase(phase: number, frequency: number, elapsedMs: number): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(elapsedMs, 0) : 0;
  return phase + (2 * Math.PI * frequency * safeElapsed) / 1000;
}

export function createSyntheticWavePath(
  history: ReadonlyArray<SyntheticWavePoint>,
  width = 320,
  height = 64,
): string {
  if (!history.length) return "";
  const lastIndex = Math.max(history.length - 1, 1);
  const center = height / 2;
  const maximumAmplitude = Math.max(height / 2 - 2, 0);
  return history
    .map((point, index) => {
      const amplitude = Math.min(Math.max(point.amplitude, 0), 1) * maximumAmplitude;
      const x = history.length === 1 ? width : (index / lastIndex) * width;
      const y = center + Math.sin(point.phase) * amplitude;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function appendWaveHistory(
  history: ReadonlyArray<SyntheticWavePoint>,
  point: SyntheticWavePoint,
  maxLength = 180,
): Array<SyntheticWavePoint> {
  return [...history, point].slice(-Math.max(maxLength, 1));
}

export function extractVoiceFeatures(samples: VoiceSample[], durationMs: number): VoiceFeatures {
  const validSamples = samples.filter(
    (sample) => Number.isFinite(sample.t) && Number.isFinite(sample.level),
  );
  const levels = validSamples.map((sample) => Math.min(Math.max(sample.level, 0), 1));
  const averageIntensity = levels.length
    ? levels.reduce((total, level) => total + level, 0) / levels.length
    : 0;
  const pauseCount = validSamples.filter((sample, index) => {
    const previous = validSamples[index - 1];
    return sample.level < 0.05 && (!previous || previous.level >= 0.05);
  }).length;
  const midpoint = Math.floor(levels.length / 2);
  const earlier = levels.slice(0, Math.max(midpoint, 1));
  const ending = levels.slice(midpoint);
  const earlierAverage = average(earlier);
  const endingAverage = average(ending);
  const endingBehavior = !levels.length
    ? "unknown"
    : endingAverage < earlierAverage * 0.65
      ? "fading"
      : "maintained";

  return {
    durationMs: Math.max(Math.round(durationMs), 0),
    averageIntensity,
    pauseCount,
    endingBehavior,
  };
}

export function voiceToRepresentation(features: VoiceFeatures): GestureRepresentation {
  if (features.durationMs <= 0) return { dimensions: [], tags: [] };

  const isShort = features.durationMs <= 700;
  return {
    dimensions: [
      {
        dimensionId: "duration",
        polarity: isShort ? "short" : "lingering",
        reason: `voice duration ${features.durationMs}ms (experimental hint)`,
      },
    ],
    tags: [isShort ? "voice-short" : "voice-lingering"],
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}
