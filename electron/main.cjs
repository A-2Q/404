'use strict';

const path = require('path');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { applyGpuSwitches } = require('./gpuFlags.cjs');

// =========================================================================
// 1. INJECT CHROMIUM GPU PROCESS FLAGS BEFORE app.whenReady()
// =========================================================================
const useDx12 = process.env.ROOM404_DX12 === '1' || process.argv.includes('--dx12');
const unlockFps = process.env.ROOM404_UNLOCK_FPS === '1' || process.argv.includes('--unlock-fps');

const appliedSwitches = applyGpuSwitches(app.commandLine, {
  dx12: useDx12,
  unlockFps,
});

// Prefer dedicated discrete GPU on Windows / hybrid laptops
app.commandLine.appendSwitch('gpu-preference', 'high-performance');

// Single-instance lock so the game cannot accidentally open twice
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createGameWindow() {
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

  mainWindow = new BrowserWindow({
    title: 'غرفة التحقيق 404',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#05070a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // Keep 3D simulation & audio smooth at full speed
    },
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  // Smooth zero-flash reveal once WebGL canvas is ready
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  // Native desktop shortcuts: F11 / Alt+Enter for fullscreen, Ctrl+Shift+I for DevTools in dev
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!mainWindow || input.type !== 'keyDown') return;

    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return;
    }

    if (isDev && input.control && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Prevent external window popups inside the game
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =========================================================================
// 2. IPC HANDLERS FOR DESKTOP CONTROLS & LIVE GPU VERIFICATION
// =========================================================================
ipcMain.handle('room404:get-gpu-info', async () => {
  try {
    const featureStatus = app.getGPUFeatureStatus();
    const info = await app.getGPUInfo('basic');
    return {
      backend: useDx12 ? 'ANGLE DirectX 12 (d3d11on12)' : 'ANGLE DirectX 11 (d3d11)',
      webgl2: featureStatus.webgl2 || 'unknown',
      gpuCompositing: featureStatus.gpu_compositing || 'unknown',
      rasterization: featureStatus.rasterization || 'unknown',
      gpuDevices: Array.isArray(info?.gpuDevice) ? info.gpuDevice : [],
      appliedFlags: appliedSwitches.map(([k, v]) => (v ? `--${k}=${v}` : `--${k}`)),
    };
  } catch (err) {
    return {
      backend: useDx12 ? 'ANGLE DirectX 12' : 'ANGLE DirectX 11',
      error: String(err),
    };
  }
});

ipcMain.handle('room404:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('room404:quit', () => {
  app.quit();
});

// =========================================================================
// 3. APP LIFECYCLE
// =========================================================================
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createGameWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createGameWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
