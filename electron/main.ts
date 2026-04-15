import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseService } from "./db";
import { exportVersionBundle } from "./exporter";
import type {
  AttachmentKind,
  CreateVersionInput,
  ExportMode,
  PromptSetInput,
  PromptSetUpdateInput,
  UpdateVersionInput,
} from "../shared/types";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let db: DatabaseService | null = null;
let assetsDir = "";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveAttachmentKind(filePath: string): AttachmentKind {
  const ext = path.extname(filePath).toLowerCase();
  if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".tiff"].includes(
      ext
    )
  ) {
    return "image";
  }
  if ([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"].includes(ext)) {
    return "video";
  }
  return "document";
}

function getRendererUrl(): string {
  if (isDev) {
    return "http://127.0.0.1:5173";
  }
  return `file://${path.join(__dirname, "../dist/renderer/index.html")}`;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: "Prompt Version Manager",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(getRendererUrl());
}

async function bootstrap(): Promise<void> {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "pvm-data");
  assetsDir = path.join(dataDir, "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  db = await DatabaseService.create(dataDir);
}

function ensureDb(): DatabaseService {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  return db;
}

function registerIpcHandlers(): void {
  ipcMain.handle("pvm:listPromptSets", async (_event, query?: string) => {
    return ensureDb().listPromptSets(query?.trim() || "");
  });
  ipcMain.handle("pvm:createPromptSet", async (_event, payload: PromptSetInput) => {
    return ensureDb().createPromptSet(payload);
  });
  ipcMain.handle(
    "pvm:updatePromptSet",
    async (_event, payload: PromptSetUpdateInput) => {
      return ensureDb().updatePromptSet(payload.id, payload);
    }
  );
  ipcMain.handle("pvm:deletePromptSet", async (_event, id: string) => {
    const dbi = ensureDb();
    const versions = dbi.getVersionsByPromptSet(id);
    dbi.deletePromptSet(id);
    await Promise.all(
      versions.map(async (version) => {
        const versionDir = path.join(assetsDir, id, version.id);
        await fs.rm(versionDir, { recursive: true, force: true });
      })
    );
    await fs.rm(path.join(assetsDir, id), { recursive: true, force: true });
    return true;
  });

  ipcMain.handle("pvm:listVersions", async (_event, promptSetId: string) => {
    return ensureDb().listVersions(promptSetId);
  });
  ipcMain.handle("pvm:createVersion", async (_event, payload: CreateVersionInput) => {
    return ensureDb().createVersion(payload);
  });
  ipcMain.handle("pvm:updateVersion", async (_event, id: string, payload: UpdateVersionInput) => {
    return ensureDb().updateVersion(id, payload);
  });
  ipcMain.handle("pvm:deleteVersion", async (_event, id: string) => {
    const dbi = ensureDb();
    const version = dbi.getVersionById(id);
    if (!version) {
      return false;
    }
    const promptSetId = version.promptSetId;
    dbi.deleteVersion(id);
    const versionDir = path.join(assetsDir, promptSetId, id);
    await fs.rm(versionDir, { recursive: true, force: true });
    return true;
  });
  ipcMain.handle("pvm:setRecommendedVersion", async (_event, versionId: string) => {
    ensureDb().setRecommendedVersion(versionId);
    return true;
  });
  ipcMain.handle("pvm:addAttachments", async (_event, versionId: string) => {
    const dbi = ensureDb();
    const version = dbi.getVersionById(versionId);
    if (!version) {
      throw new Error("Version not found");
    }
    const promptSet = dbi.getPromptSetById(version.promptSetId);
    if (!promptSet) {
      throw new Error("Prompt set not found");
    }
    const pickResult = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile", "multiSelections"],
      title: "选择附件文件",
    });
    if (pickResult.canceled || pickResult.filePaths.length === 0) {
      return [];
    }

    const targetDir = path.join(assetsDir, promptSet.id, version.id);
    await fs.mkdir(targetDir, { recursive: true });

    const created = [];
    for (const filePath of pickResult.filePaths) {
      const originalName = path.basename(filePath);
      const storedName = `${Date.now()}_${sanitizeName(originalName)}`;
      const storedPath = path.join(targetDir, storedName);
      await fs.copyFile(filePath, storedPath);
      const attachment = dbi.createAttachment({
        versionId,
        kind: resolveAttachmentKind(filePath),
        originalName,
        storedName,
        storedPath,
      });
      created.push(attachment);
    }
    return created;
  });

  ipcMain.handle("pvm:removeAttachment", async (_event, id: string) => {
    const dbi = ensureDb();
    const attachment = dbi.getAttachmentById(id);
    if (!attachment) {
      return false;
    }
    dbi.deleteAttachment(id);
    await fs.rm(attachment.storedPath, { force: true });
    return true;
  });
  ipcMain.handle("pvm:copyVersionContent", async (_event, versionId: string) => {
    const version = ensureDb().getVersionById(versionId);
    if (!version) {
      throw new Error("Version not found");
    }
    clipboard.writeText(version.contentMarkdown);
    return true;
  });
  ipcMain.handle("pvm:copyAttachmentPaths", async (_event, versionId: string) => {
    const attachments = ensureDb().getAttachmentsByVersion(versionId);
    const all = attachments.map((item) => item.storedPath).join("\n");
    clipboard.writeText(all);
    return all;
  });
  ipcMain.handle("pvm:exportVersionPackage", async (_event, versionId: string, mode: ExportMode) => {
    const dbi = ensureDb();
    const version = dbi.getVersionById(versionId);
    if (!version) {
      throw new Error("Version not found");
    }
    const promptSet = dbi.getPromptSetById(version.promptSetId);
    if (!promptSet) {
      throw new Error("Prompt set not found");
    }
    const attachments = dbi.getAttachmentsByVersion(versionId);
    const exportName = `${sanitizeName(promptSet.title)}_${sanitizeName(version.name || version.id)}`;
    const selectDir = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择导出目录",
    });
    if (selectDir.canceled || selectDir.filePaths.length === 0) {
      return null;
    }
    const outputPath = await exportVersionBundle({
      outputDir: selectDir.filePaths[0],
      exportName,
      mode,
      promptSet,
      version,
      attachments,
    });
    return outputPath;
  });
}

app.whenReady().then(async () => {
  await bootstrap();
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
