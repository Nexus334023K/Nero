import { app, BrowserWindow, ipcMain, shell, screen } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Guard against unhandled exceptions popping up modal crash dialogs
process.on('uncaughtException', (error) => {
  console.error('[ELECTRON] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ELECTRON] Unhandled Rejection:', reason);
});

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;

interface CompanionConfig {
  x?: number;
  y?: number;
  alwaysOnTop?: boolean;
}

function getCompanionConfigPath(): string {
  return join(app.getPath('userData'), 'companion-config.json');
}

function loadCompanionConfig(): CompanionConfig {
  try {
    const p = getCompanionConfigPath();
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'));
    }
  } catch {
    // fallback
  }
  return { alwaysOnTop: true };
}

function saveCompanionConfig(cfg: CompanionConfig): void {
  try {
    const p = getCompanionConfigPath();
    writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function getValidCompanionPosition(
  savedX?: number,
  savedY?: number,
  width = 260,
  height = 320,
): { x: number; y: number } {
  const displays = screen.getAllDisplays();

  if (typeof savedX === 'number' && typeof savedY === 'number') {
    const isVisible = displays.some((display) => {
      const { x, y, width: dW, height: dH } = display.workArea;
      return (
        savedX >= x - 30 &&
        savedX <= x + dW - 50 &&
        savedY >= y - 30 &&
        savedY <= y + dH - 50
      );
    });

    if (isVisible) {
      return { x: savedX, y: savedY };
    }
  }

  // Default to bottom-right corner of primary screen
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: pX, y: pY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  return {
    x: Math.max(20, pX + screenWidth - width - 40),
    y: Math.max(20, pY + screenHeight - height - 40),
  };
}

function createCompanionWindow(): void {
  if (companionWindow && !companionWindow.isDestroyed()) {
    if (companionWindow.isMinimized()) companionWindow.restore();
    companionWindow.show();
    companionWindow.focus();
    return;
  }

  const companionWidth = 260;
  const companionHeight = 320;
  const cfg = loadCompanionConfig();
  const initialPos = getValidCompanionPosition(cfg.x, cfg.y, companionWidth, companionHeight);

  companionWindow = new BrowserWindow({
    title: 'NERO Companion',
    width: companionWidth,
    height: companionHeight,
    x: initialPos.x,
    y: initialPos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: cfg.alwaysOnTop ?? true,
    resizable: false,
    hasShadow: false, // Essential for pure transparent desktop pet without Windows box-shadow
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  companionWindow.setMenuBarVisibility(false);

  companionWindow.once('ready-to-show', () => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.show();
    }
  });

  // Track window movements to persist desktop position
  companionWindow.on('moved', () => {
    if (!companionWindow || companionWindow.isDestroyed()) return;
    const [x, y] = companionWindow.getPosition();
    const currentCfg = loadCompanionConfig();
    saveCompanionConfig({ ...currentCfg, x, y });
  });

  if (isDev) {
    void companionWindow.loadURL('http://localhost:5173/#/companion');
  } else {
    void companionWindow.loadFile(join(__dirname, '../dist/index.html'), {
      hash: '/companion',
    });
  }

  companionWindow.on('closed', () => {
    companionWindow = null;
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'NERO — Personal AI Desktop Companion',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Safety fallback to ensure window is visible
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1000);

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[ELECTRON] Failed to load index:', code, desc);
  });

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // Handle external links and prevent in-window hijack
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Helper for safe window operations
function safeWinOp(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    // Window may have been closed or destroyed during asynchronous IPC dispatch
    console.warn('[ELECTRON IPC] Handled safe window op exception:', err);
  }
}

// IPC Handlers for window controls
ipcMain.on('window:minimize', () => {
  safeWinOp(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });
});

ipcMain.on('window:maximize', () => {
  safeWinOp(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
});

ipcMain.on('window:close', () => {
  safeWinOp(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
});

// IPC Handlers for companion window
ipcMain.on('companion:toggle', () => {
  safeWinOp(() => {
    if (companionWindow && !companionWindow.isDestroyed() && companionWindow.isVisible()) {
      companionWindow.hide();
    } else {
      createCompanionWindow();
    }
  });
});

ipcMain.on('companion:close', () => {
  safeWinOp(() => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.hide();
    }
  });
});

ipcMain.on('companion:openMainWindow', (_event, route?: string) => {
  safeWinOp(() => {
    const targetRoute = route || '/chat';
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('navigation:go', targetRoute);
      }
    } else {
      createWindow();
      mainWindow?.once('ready-to-show', () => {
        safeWinOp(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('navigation:go', targetRoute);
          }
        });
      });
    }
  });
});

ipcMain.on('companion:openSettings', () => {
  safeWinOp(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('navigation:go', '/settings');
      }
    } else {
      createWindow();
      mainWindow?.once('ready-to-show', () => {
        safeWinOp(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('navigation:go', '/settings');
          }
        });
      });
    }
  });
});

ipcMain.on('companion:setAlwaysOnTop', (_event, flag: boolean) => {
  safeWinOp(() => {
    const boolFlag = Boolean(flag);
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.setAlwaysOnTop(boolFlag);
    }
    const currentCfg = loadCompanionConfig();
    saveCompanionConfig({ ...currentCfg, alwaysOnTop: boolFlag });
  });
});

ipcMain.on('companion:setIgnoreMouseEvents', (_event, ignore: boolean, options?: { forward?: boolean }) => {
  safeWinOp(() => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: options?.forward ?? true });
    }
  });
});

ipcMain.on('companion:move', (_event, x: number, y: number) => {
  safeWinOp(() => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.setPosition(Math.round(x), Math.round(y));
    }
  });
});

// IPC: Synchronize companion state between main and companion windows
ipcMain.on('companion:syncState', (_event, message: unknown) => {
  safeWinOp(() => {
    let senderId = -1;
    try {
      if (_event.sender && !_event.sender.isDestroyed()) {
        senderId = _event.sender.id;
      }
    } catch {
      // sender already destroyed
    }

    if (
      companionWindow &&
      !companionWindow.isDestroyed() &&
      companionWindow.webContents &&
      !companionWindow.webContents.isDestroyed() &&
      companionWindow.webContents.id !== senderId
    ) {
      companionWindow.webContents.send('companion:syncState', message);
    }

    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.webContents &&
      !mainWindow.webContents.isDestroyed() &&
      mainWindow.webContents.id !== senderId
    ) {
      mainWindow.webContents.send('companion:syncState', message);
    }
  });
});

// IPC: get app info
ipcMain.handle('app:getInfo', () => ({
  version: app.getVersion(),
  platform: process.platform,
  isDev,
}));

// Disable GPU shader disk cache to prevent Windows file-lock collision warnings
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch(console.error);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

