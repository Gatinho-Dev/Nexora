// Preferências de dispositivos de áudio/vídeo da Nexora (persistidas no navegador).
const KEY = "nexora-devices";

export type DevicePrefs = {
  audioInputId?: string;
  audioOutputId?: string;
  videoInputId?: string;
  inputSensitivityMode?: "automatic" | "manual";
  inputSensitivity?: number;
  audioProcessing?: "off" | "standard" | "clearvoice";
  pushToTalkKeybind?: string;
  streamQuality?: "720p30" | "1080p30" | "1080p60";
};

export const DEFAULT_DEVICE_PREFS: Required<
  Pick<
    DevicePrefs,
    "inputSensitivityMode" | "inputSensitivity" | "audioProcessing"
  >
> = {
  inputSensitivityMode: "automatic",
  inputSensitivity: 28,
  audioProcessing: "standard",
};

export const DEFAULT_PUSH_TO_TALK_KEYBIND: undefined = undefined;
export const DEFAULT_STREAM_QUALITY = "720p30" as const;

export function getDevicePrefs(): DevicePrefs {
  try {
    return {
      ...DEFAULT_DEVICE_PREFS,
      ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as DevicePrefs),
    };
  } catch {
    return { ...DEFAULT_DEVICE_PREFS };
  }
}

export function setDevicePrefs(prefs: DevicePrefs) {
  const next = { ...getDevicePrefs(), ...prefs };
  for (const key of Object.keys(next) as (keyof DevicePrefs)[]) {
    if (next[key] === undefined) delete next[key];
  }
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent<DevicePrefs>("nexora:device-preferences", {
      detail: next,
    })
  );
}
