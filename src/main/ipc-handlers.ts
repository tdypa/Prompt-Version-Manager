import { ipcMain, dialog, clipboard, shell } from 'electron';
import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import archiver from 'archiver';

function getAssetsDir(): string {
  const dir = path.join(app.getPath('userData'), 'assets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function registerIpcHandlers() {
  // ===== Prompts =====
  ipcMain.handle('prompts:list', (_event, searchQuery?: string) => {
    const db = getDatabase();
    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      return db.prepare(`
        SELECT DISTINCT p.* FROM prompts p
        LEFT JOIN versions v ON v.prompt_id = p.id
        WHERE p.title LIKE ? OR p.tags LIKE ? OR p.description LIKE ? OR v.content LIKE ? OR v.name LIKE ?
        ORDER BY p.updated_at DESC
      `).all(q, q, q, q, q);
    }
    return db.prepare('SELECT * FROM prompts ORDER BY updated_at DESC').all();
  });

  ipcMain.handle('prompts:get', (_event, id: string) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
  });

  ipcMain.handle('prompts:create', (_event, data: { title: string; description?: string; tags?: string[] }) => {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO prompts (id, title, description, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.title, data.description || '', JSON.stringify(data.tags || []), now, now);
    return db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
  });

  ipcMain.handle('prompts:update', (_event, id: string, data: { title?: string; description?: string; tags?: string[] }) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing: any = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
    if (!existing) return null;
    db.prepare(
      'UPDATE prompts SET title = ?, description = ?, tags = ?, updated_at = ? WHERE id = ?'
    ).run(
      data.title ?? existing.title,
      data.description ?? existing.description,
      data.tags ? JSON.stringify(data.tags) : existing.tags,
      now,
      id
    );
    return db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
  });

  ipcMain.handle('prompts:delete', (_event, id: string) => {
    const db = getDatabase();
    const versions: any[] = db.prepare('SELECT id FROM versions WHERE prompt_id = ?').all(id);
    for (const v of versions) {
      deleteVersionAttachments(v.id);
    }
    db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    return true;
  });

  // ===== Versions =====
  ipcMain.handle('versions:list', (_event, promptId: string) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM versions WHERE prompt_id = ? ORDER BY created_at DESC').all(promptId);
  });

  ipcMain.handle('versions:get', (_event, id: string) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
  });

  ipcMain.handle('versions:create', (_event, data: { prompt_id: string; name: string; description?: string; content?: string }) => {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO versions (id, prompt_id, name, description, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.prompt_id, data.name, data.description || '', data.content || '', now, now);
    db.prepare('UPDATE prompts SET updated_at = ? WHERE id = ?').run(now, data.prompt_id);
    return db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
  });

  ipcMain.handle('versions:update', (_event, id: string, data: { name?: string; description?: string; content?: string; is_recommended?: boolean }) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing: any = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
    if (!existing) return null;

    if (data.is_recommended !== undefined && data.is_recommended) {
      db.prepare('UPDATE versions SET is_recommended = 0 WHERE prompt_id = ?').run(existing.prompt_id);
    }

    db.prepare(
      'UPDATE versions SET name = ?, description = ?, content = ?, is_recommended = ?, updated_at = ? WHERE id = ?'
    ).run(
      data.name ?? existing.name,
      data.description ?? existing.description,
      data.content ?? existing.content,
      data.is_recommended !== undefined ? (data.is_recommended ? 1 : 0) : existing.is_recommended,
      now,
      id
    );
    db.prepare('UPDATE prompts SET updated_at = ? WHERE id = ?').run(now, existing.prompt_id);
    return db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
  });

  ipcMain.handle('versions:delete', (_event, id: string) => {
    const db = getDatabase();
    const version: any = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
    if (version) {
      deleteVersionAttachments(id);
      db.prepare('DELETE FROM versions WHERE id = ?').run(id);
      const now = new Date().toISOString();
      db.prepare('UPDATE prompts SET updated_at = ? WHERE id = ?').run(now, version.prompt_id);
    }
    return true;
  });

  // ===== Attachments =====
  ipcMain.handle('attachments:list', (_event, versionId: string) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM attachments WHERE version_id = ? ORDER BY created_at ASC').all(versionId);
  });

  ipcMain.handle('attachments:add', async (_event, versionId: string, type: string) => {
    const filters: { name: string; extensions: string[] }[] = [];
    if (type === 'image') {
      filters.push({ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'] });
    } else if (type === 'document') {
      filters.push({ name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'] });
    } else if (type === 'video') {
      filters.push({ name: 'Videos', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] });
    }

    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters,
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const db = getDatabase();
    const assetsDir = getAssetsDir();
    const attachments: any[] = [];

    for (const filePath of result.filePaths) {
      const id = uuidv4();
      const ext = path.extname(filePath);
      const filename = `${id}${ext}`;
      const destPath = path.join(assetsDir, filename);

      fs.copyFileSync(filePath, destPath);
      const stats = fs.statSync(destPath);
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO attachments (id, version_id, type, filename, original_name, file_path, file_size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, versionId, type, filename, path.basename(filePath), destPath, stats.size, getMimeType(ext), now);

      attachments.push(db.prepare('SELECT * FROM attachments WHERE id = ?').get(id));
    }

    return attachments;
  });

  ipcMain.handle('attachments:delete', (_event, id: string) => {
    const db = getDatabase();
    const att: any = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
    if (att) {
      try { fs.unlinkSync(att.file_path); } catch {}
      db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
    }
    return true;
  });

  ipcMain.handle('attachments:get-path', (_event, id: string) => {
    const db = getDatabase();
    const att: any = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
    return att ? att.file_path : null;
  });

  // ===== Actions =====
  ipcMain.handle('actions:copy-content', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('actions:open-file', (_event, filePath: string) => {
    shell.openPath(filePath);
    return true;
  });

  ipcMain.handle('actions:export-version', async (_event, versionId: string) => {
    const db = getDatabase();
    const version: any = db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId);
    if (!version) return null;

    const prompt: any = db.prepare('SELECT * FROM prompts WHERE id = ?').get(version.prompt_id);
    const attachments: any[] = db.prepare('SELECT * FROM attachments WHERE version_id = ?').all(versionId);

    const result = await dialog.showSaveDialog({
      title: 'Export Version',
      defaultPath: `${prompt?.title || 'prompt'}_${version.name}.zip`,
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) return null;

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(result.filePath!);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(result.filePath));
      archive.on('error', (err: Error) => reject(err));

      archive.pipe(output);
      archive.append(version.content || '', { name: 'prompt.md' });
      archive.append(JSON.stringify({
        prompt_title: prompt?.title,
        version_name: version.name,
        version_description: version.description,
        is_recommended: version.is_recommended === 1,
        created_at: version.created_at,
        tags: prompt?.tags ? JSON.parse(prompt.tags) : [],
      }, null, 2), { name: 'metadata.json' });

      for (const att of attachments) {
        if (fs.existsSync(att.file_path)) {
          const folder = att.type === 'image' ? 'images' : att.type === 'video' ? 'videos' : 'documents';
          archive.file(att.file_path, { name: `${folder}/${att.original_name}` });
        }
      }

      archive.finalize();
    });
  });

  ipcMain.handle('actions:copy-attachment-paths', (_event, versionId: string) => {
    const db = getDatabase();
    const attachments: any[] = db.prepare('SELECT * FROM attachments WHERE version_id = ?').all(versionId);
    const paths = attachments.map(a => a.file_path).join('\n');
    clipboard.writeText(paths);
    return true;
  });
}

function deleteVersionAttachments(versionId: string) {
  const db = getDatabase();
  const attachments: any[] = db.prepare('SELECT * FROM attachments WHERE version_id = ?').all(versionId);
  for (const att of attachments) {
    try { fs.unlinkSync(att.file_path); } catch {}
  }
  db.prepare('DELETE FROM attachments WHERE version_id = ?').run(versionId);
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.pdf': 'application/pdf',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}
