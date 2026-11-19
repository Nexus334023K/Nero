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
    openMainWindow: (route?: string) => ipcRenderer.send('companion:openMainWindow', route),
    openSettings: () => ipcRenderer.send('companion:openSettings'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.send('companion:setAlwaysOnTop', flag),
    setIgnoreMouseEvents: (ignore: boolean, forward = true) =>
      ipcRenderer.send('companion:setIgnoreMouseEvents', ignore, { forward }),
    move: (x: number, y: number) => ipcRenderer.send('companion:move', x, y),
    syncState: (data: unknown) => ipcRenderer.send('companion:syncState', data),
    onSyncState: (callback: (data: any) => void) => {
      const handler = (_event: unknown, data: any) => callback(data);
      ipcRenderer.on('companion:syncState', handler);
      return () => {
        ipcRenderer.removeListener('companion:syncState', handler);
      };
    },
  },
  // Navigation listener for main window
  onNavigation: (callback: (route: string) => void) => {
    const handler = (_event: unknown, route: string) => callback(route);
    ipcRenderer.on('navigation:go', handler);
    return () => {
      ipcRenderer.removeListener('navigation:go', handler);
    };
  },
  // App info
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
  },
  // Platform
  platform: process.platform,
});
