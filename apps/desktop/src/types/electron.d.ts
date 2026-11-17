interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  companion: {
    toggle: () => void;
    close: () => void;
    openMainWindow: () => void;
    setAlwaysOnTop: (flag: boolean) => void;
  };
  app: {
    getInfo: () => Promise<{ version: string; platform: string; isDev: boolean }>;
  };
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
