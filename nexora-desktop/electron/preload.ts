import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('nexora', {
  login: (identifier: string, password: string, code?: string) => ipcRenderer.invoke('auth:login', { identifier, password, code }),
  rpc: (path: string, input?: unknown) => ipcRenderer.invoke('api:rpc', path, input),
  external: (url: string) => ipcRenderer.invoke('app:external', url),
  version: () => ipcRenderer.invoke('app:version'),
  connected: () => ipcRenderer.invoke('app:connected'),
  typing: (target: unknown) => ipcRenderer.invoke('realtime:typing', target),
  voiceSend: (message: unknown) => ipcRenderer.invoke('voice:send', message),
  voiceIceServers: () => ipcRenderer.invoke('voice:iceServers'),
  mediaFetch: (url: string) => ipcRenderer.invoke('media:fetch', url),
  pickFiles: () => ipcRenderer.invoke('files:pick'),
  uploadFiles: (paths: string[]) => ipcRenderer.invoke('files:upload', paths),
  getSettings: () => ipcRenderer.invoke('desktop:getSettings'),
  updaterState: () => ipcRenderer.invoke('updater:state'),
  checkUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdater: (callback: (value: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);
    ipcRenderer.on('updater:state', handler);
    return () => ipcRenderer.removeListener('updater:state', handler);
  },
  setSettings: (patch: unknown) => ipcRenderer.invoke('desktop:setSettings', patch),
  onSettings: (callback: (value: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);
    ipcRenderer.on('desktop:settings', handler);
    return () => ipcRenderer.removeListener('desktop:settings', handler);
  },
  onNavigate: (callback: (value: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);
    ipcRenderer.on('desktop:navigate', handler);
    return () => ipcRenderer.removeListener('desktop:navigate', handler);
  },
  onEvent: (callback: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);
    ipcRenderer.on('realtime:event', handler);
    return () => ipcRenderer.removeListener('realtime:event', handler);
  }
});
