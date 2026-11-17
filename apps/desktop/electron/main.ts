import { app, BrowserWindow, ipcMain, shell, screen } from 'electron';
import { join } from 'path';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;

function createCompanionWindow(): void {
  if (companionWindow) {
    if (companionWindow.isMinimized()) companionWindow.restore();
    companionWindow.show();
    companionWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const companionWidth = 280;
  const companionHeight = 360;

  companionWindow = new BrowserWindow({
    title: 'NERO Companion',
    width: companionWidth,
    height: companionHeight,
    x: Math.max(20, screenWidth - companionWidth - 40),
    y: Math.max(20, screenHeight - companionHeight - 40),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: true,
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
    companionWindow?.show();
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
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Safety fallback to ensure window is visible
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
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
}

// IPC Handlers for window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// IPC Handlers for companion window
ipcMain.on('companion:toggle', () => {
  if (companionWindow && companionWindow.isVisible()) {
    companionWindow.hide();
  } else {
    createCompanionWindow();
  }
});
ipcMain.on('companion:close', () => {
  if (companionWindow) {
    companionWindow.hide();
  }
});
ipcMain.on('companion:openMainWindow', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});
ipcMain.on('companion:setAlwaysOnTop', (_event, flag: boolean) => {
  if (companionWindow) {
    companionWindow.setAlwaysOnTop(Boolean(flag));
  }
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
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

