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
