import type { DevicePrefs } from "../devices";

export type AudioProcessingSession = {
  rawStream: MediaStream;
  outputStream: MediaStream;
  context: AudioContext | null;
  mode: NonNullable<DevicePrefs["audioProcessing"]>;
  close: () => Promise<void>;
};

const CLEARVOICE_WORKLET_URL = "/audio-worklets/nexora-clearvoice-processor.js";

export function microphoneConstraints(
  prefs: DevicePrefs
): MediaTrackConstraints {
  const mode = prefs.audioProcessing ?? "standard";
  return {
    echoCancellation: mode !== "off",
    noiseSuppression: mode === "standard",
    autoGainControl: mode === "standard",
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48_000 },
    ...(prefs.audioInputId ? { deviceId: { exact: prefs.audioInputId } } : {}),
  };
}

export async function createAudioProcessingSession(
  rawStream: MediaStream,
  prefs: DevicePrefs
): Promise<AudioProcessingSession> {
  const mode = prefs.audioProcessing ?? "standard";
  if (mode !== "clearvoice") {
    return {
      rawStream,
      outputStream: rawStream,
      context: null,
      mode,
      close: async () => {
        rawStream.getTracks().forEach(track => track.stop());
      },
    };
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const context = new AudioContextClass({ latencyHint: "interactive" });

  try {
    const source = context.createMediaStreamSource(rawStream);
    const highPass = context.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 85;
    highPass.Q.value = 0.7;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.16;

    const outputGain = context.createGain();
    outputGain.gain.value = 1;
    const destination = context.createMediaStreamDestination();

    source.connect(highPass);
    let tail: AudioNode = highPass;

    try {
      await context.audioWorklet.addModule(CLEARVOICE_WORKLET_URL);
      const gate = new AudioWorkletNode(context, "nexora-clearvoice", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      highPass.connect(gate);
      tail = gate;
    } catch (error) {
      console.warn(
        "[VOICE][ClearVoice] AudioWorklet indisponível; usando filtro e compressor.",
        error
      );
    }

    tail.connect(compressor);
    compressor.connect(outputGain);
    outputGain.connect(destination);
    if (context.state === "suspended") await context.resume();

    const outputStream = destination.stream;
    const close = async () => {
      outputStream.getTracks().forEach(track => track.stop());
      rawStream.getTracks().forEach(track => track.stop());
      source.disconnect();
      highPass.disconnect();
      if (tail !== highPass) tail.disconnect();
      compressor.disconnect();
      outputGain.disconnect();
      if (context.state !== "closed") await context.close();
    };

    return { rawStream, outputStream, context, mode, close };
  } catch (error) {
    if (context.state !== "closed") await context.close().catch(() => {});
    console.warn(
      "[VOICE][ClearVoice] Falha no pipeline avançado; mantendo áudio nativo.",
      error
    );
    return {
      rawStream,
      outputStream: rawStream,
      context: null,
      mode: "standard",
      close: async () => {
        rawStream.getTracks().forEach(track => track.stop());
      },
    };
  }
}
