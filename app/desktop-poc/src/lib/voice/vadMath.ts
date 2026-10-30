export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    energy += samples[index] * samples[index];
  }
  return Math.sqrt(energy / samples.length);
}

export function manualVadThreshold(sensitivity: number): number {
  const clamped = Math.max(0, Math.min(100, sensitivity));
  return 0.004 + ((100 - clamped) / 100) * 0.07;
}
