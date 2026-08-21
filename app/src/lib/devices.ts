// Preferências de dispositivos de áudio/vídeo (persistidas no navegador).
const KEY = "pulsar-devices";

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
