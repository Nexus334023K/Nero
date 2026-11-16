import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, validated IPC APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  // App info
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
  },
  // Platform
  platform: process.platform,
});
