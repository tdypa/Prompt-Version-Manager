const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, clipboard, dialog, ipcMain } = require('electron');
const { initializeDatabase } = require('./database.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const debugLogPath = '/opt/cursor/logs/debug.log';

let mainWindow;
let database;

// #region agent log
function debugLog(hypothesisId, location, message, data = {}) {
  fs.appendFileSync(debugLogPath, `${JSON.stringify({
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  })}\n`);
}
// #endregion

function getFileFilters(category) {
  if (category === 'image') {
    return [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }];
  }

  if (category === 'video') {
    return [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'] }];
  }

  return [{ name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'] }];
}

app.disableHardwareAcceleration();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 760,
    backgroundColor: '#0b1020',
    title: 'Prompt Version Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // #region agent log
  debugLog('A', 'electron/main.cjs:createWindow', 'BrowserWindow created', {
    isDev,
    backgroundColor: '#0b1020',
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    debugLog('A', 'electron/main.cjs:webContents:render-process-gone', 'Renderer process gone', details);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    debugLog('A', 'electron/main.cjs:webContents:did-fail-load', 'Renderer failed to load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  });
  mainWindow.on('unresponsive', () => {
    debugLog('A', 'electron/main.cjs:window:unresponsive', 'Window became unresponsive');
  });
  // #endregion

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function registerIpcHandlers() {
  ipcMain.handle('debug:log', async (_event, payload) => {
    // #region agent log
    debugLog(payload?.hypothesisId || 'A', 'electron/main.cjs:ipc:debug:log', payload?.message || 'Renderer debug log', payload?.data || {});
    // #endregion
    return { ok: true };
  });

  ipcMain.handle('data:load', async (_event, searchTerm = '') => ({
    projects: database.loadHierarchy(searchTerm),
    storage: {
      databasePath: database.dbPath,
      assetsPath: database.assetsRoot,
    },
  }));

  ipcMain.handle('projects:create', async () => ({
    projectId: database.createProject(),
  }));

  ipcMain.handle('projects:update', async (_event, payload) => ({
    projectId: database.updateProject(payload),
  }));

  ipcMain.handle('projects:delete', async (_event, projectId) => {
    database.deleteProject(projectId);
    return { ok: true };
  });

  ipcMain.handle('versions:create', async (_event, projectId) => ({
    versionId: database.createVersion(projectId),
  }));

  ipcMain.handle('versions:update', async (_event, payload) => ({
    versionId: database.updateVersion(payload),
  }));

  ipcMain.handle('versions:delete', async (_event, versionId) => {
    database.deleteVersion(versionId);
    return { ok: true };
  });

  ipcMain.handle('versions:setRecommended', async (_event, versionId) => {
    database.setRecommended(versionId);
    return { ok: true };
  });

  ipcMain.handle('versions:copyContent', async (_event, versionId) => {
    const version = database.getVersion(versionId);
    clipboard.writeText(version.contentMarkdown || '');
    return { ok: true };
  });

  ipcMain.handle('versions:copyAttachmentPaths', async (_event, versionId) => {
    const attachments = database.getVersionAttachments(versionId);
    clipboard.writeText(attachments.map((item) => item.absolutePath).join('\n'));
    return { count: attachments.length };
  });

  ipcMain.handle('versions:export', async (_event, { versionId, format }) => {
    // #region agent log
    debugLog('B', 'electron/main.cjs:ipc:versions:export', 'Export requested', {
      versionId,
      format,
    });
    // #endregion
    if (format === 'folder') {
      const directoryResult = await dialog.showOpenDialog(mainWindow, {
        title: '选择导出目录',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (directoryResult.canceled || directoryResult.filePaths.length === 0) {
        return { cancelled: true };
      }

      const exportPath = await database.exportVersion({
        versionId,
        format,
        destinationPath: directoryResult.filePaths[0],
      });

      // #region agent log
      debugLog('B', 'electron/main.cjs:ipc:versions:export', 'Folder export completed', {
        versionId,
        exportPath,
      });
      // #endregion

      return { cancelled: false, exportPath };
    }

    const version = database.getVersion(versionId);
    const fileName = `${version.projectTitle}-${version.name}.zip`.replace(/[\\/:*?"<>|]+/g, '-');
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: '导出 ZIP',
      defaultPath: fileName,
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { cancelled: true };
    }
    try {
      const exportPath = await database.exportVersion({
        versionId,
        format,
        destinationPath: saveResult.filePath,
      });

      // #region agent log
      debugLog('B', 'electron/main.cjs:ipc:versions:export', 'Zip export completed', {
        versionId,
        exportPath,
      });
      // #endregion

      return { cancelled: false, exportPath };
    } catch (error) {
      // #region agent log
      debugLog('B', 'electron/main.cjs:ipc:versions:export', 'Zip export failed', {
        versionId,
        destinationPath: saveResult.filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      // #endregion
      throw error;
    }
  });

  ipcMain.handle('attachments:add', async (_event, { versionId, category }) => {
    const dialogResult = await dialog.showOpenDialog(mainWindow, {
      title: '选择附件',
      properties: ['openFile', 'multiSelections'],
      filters: getFileFilters(category),
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { cancelled: true };
    }

    database.addAttachments({
      versionId,
      category,
      filePaths: dialogResult.filePaths,
    });

    return { cancelled: false };
  });

  ipcMain.handle('attachments:remove', async (_event, attachmentId) => {
    database.removeAttachment(attachmentId);
    return { ok: true };
  });
}

async function bootstrap() {
  database = initializeDatabase({
    dbPath: path.join(app.getPath('userData'), 'prompt-version-manager.db'),
    assetsRoot: path.join(app.getPath('userData'), 'assets'),
  });

  registerIpcHandlers();
  await createWindow();
}

app.whenReady().then(async () => {
  // #region agent log
  app.on('child-process-gone', (_event, details) => {
    debugLog('A', 'electron/main.cjs:app:child-process-gone', 'Electron child process gone', details);
  });
  // #endregion
  await bootstrap();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
