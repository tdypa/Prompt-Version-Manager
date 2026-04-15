import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { closeDatabase } from './database';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f0f0f',
    show: false,
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-asset', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  protocol.registerFileProtocol('local-asset', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-asset://', ''));
    callback({ path: filePath });
  });

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
