class NexoraClearVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.noiseFloor = 0.004;
    this.gain = 1;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input?.length || !output?.length) return true;

    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[Math.min(channel, input.length - 1)];
      const target = output[channel];
      if (!source) {
        target.fill(0);
        continue;
      }

      let energy = 0;
      for (let i = 0; i < source.length; i += 1) {
        energy += source[i] * source[i];
      }
      const rms = Math.sqrt(energy / source.length);

      if (rms < this.noiseFloor * 2.4) {
        this.noiseFloor = this.noiseFloor * 0.995 + rms * 0.005;
      }
      this.noiseFloor = Math.max(0.0015, Math.min(this.noiseFloor, 0.025));

      const openThreshold = Math.max(0.009, this.noiseFloor * 2.8);
      const closeThreshold = Math.max(0.006, this.noiseFloor * 1.8);
      const targetGain =
        rms >= openThreshold ? 1 : rms <= closeThreshold ? 0.12 : this.gain;
      const smoothing = targetGain > this.gain ? 0.32 : 0.025;
      this.gain += (targetGain - this.gain) * smoothing;

      for (let i = 0; i < source.length; i += 1) {
        target[i] = source[i] * this.gain;
      }
    }
    return true;
  }
}

registerProcessor("nexora-clearvoice", NexoraClearVoiceProcessor);
