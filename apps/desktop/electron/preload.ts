import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, validated IPC APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  // Companion controls
  companion: {
    toggle: () => ipcRenderer.send('companion:toggle'),
    close: () => ipcRenderer.send('companion:close'),
    openMainWindow: () => ipcRenderer.send('companion:openMainWindow'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.send('companion:setAlwaysOnTop', flag),
  },
  // App info
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
  },
  // Platform
  platform: process.platform,
});
