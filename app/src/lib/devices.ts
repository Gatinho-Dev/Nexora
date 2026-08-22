// Preferências de dispositivos de áudio/vídeo da Nexora (persistidas no navegador).
const KEY = "nexora-devices";

export type DevicePrefs = {
  audioInputId?: string;
  videoInputId?: string;
};

export function getDevicePrefs(): DevicePrefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as DevicePrefs;
  } catch {
    return {};
  }
}

export function setDevicePrefs(prefs: DevicePrefs) {
  localStorage.setItem(KEY, JSON.stringify({ ...getDevicePrefs(), ...prefs }));
}
