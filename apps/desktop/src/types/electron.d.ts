interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  companion: {
    toggle: () => void;
    close: () => void;
    openMainWindow: (route?: string) => void;
    openSettings: () => void;
    setAlwaysOnTop: (flag: boolean) => void;
    setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => void;
    move: (x: number, y: number) => void;
  };
  onNavigation?: (callback: (route: string) => void) => () => void;
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
