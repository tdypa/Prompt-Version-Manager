const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const archiver = require('archiver');

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function categoryFolder(category) {
  return {
    image: 'images',
    document: 'documents',
    video: 'videos',
  }[category] || 'misc';
}

function formatTags(tags = []) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function createZipFromDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function initializeSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS project_tags (
      project_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (project_id, tag_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content_markdown TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_recommended INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
    );
  `);
}

function initializeDatabase({ dbPath, assetsRoot }) {
  ensureDir(path.dirname(dbPath));
  ensureDir(assetsRoot);

  const db = new Database(dbPath);
  initializeSchema(db);

  const cleanupUnusedTags = db.prepare(`
    DELETE FROM tags
    WHERE id NOT IN (SELECT DISTINCT tag_id FROM project_tags)
  `);

  const touchProject = db.prepare(`
    UPDATE projects
    SET updated_at = ?
    WHERE id = ?
  `);

  const replaceProjectTags = db.transaction((projectId, tags) => {
    const tagValues = formatTags(tags);
    db.prepare('DELETE FROM project_tags WHERE project_id = ?').run(projectId);

    for (const tagName of tagValues) {
      db.prepare('INSERT INTO tags(name) VALUES (?) ON CONFLICT(name) DO NOTHING').run(tagName);
      db.prepare(`
        INSERT OR IGNORE INTO project_tags(project_id, tag_id)
        SELECT ?, id FROM tags WHERE name = ? COLLATE NOCASE
      `).run(projectId, tagName);
    }

    cleanupUnusedTags.run();
  });

  function getProjectSearchRows(searchTerm = '') {
    const normalized = searchTerm.trim().toLowerCase();
    const likeTerm = `%${normalized}%`;

    return db.prepare(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT v.id) AS version_count,
        GROUP_CONCAT(DISTINCT t.name) AS tag_names
      FROM projects p
      LEFT JOIN versions v ON v.project_id = p.id
      LEFT JOIN project_tags pt ON pt.project_id = p.id
      LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE (
        ? = ''
        OR LOWER(p.title) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM project_tags inner_pt
          JOIN tags inner_t ON inner_t.id = inner_pt.tag_id
          WHERE inner_pt.project_id = p.id
            AND LOWER(inner_t.name) LIKE ?
        )
        OR EXISTS (
          SELECT 1
          FROM versions inner_v
          WHERE inner_v.project_id = p.id
            AND (
              LOWER(inner_v.name) LIKE ?
              OR LOWER(inner_v.description) LIKE ?
              OR LOWER(inner_v.content_markdown) LIKE ?
            )
        )
      )
      GROUP BY p.id
      ORDER BY datetime(p.updated_at) DESC, p.id DESC
    `).all(normalized, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  }

  function loadHierarchy(searchTerm = '') {
    const projectRows = getProjectSearchRows(searchTerm);
    if (projectRows.length === 0) {
      return [];
    }

    const projectIds = projectRows.map((row) => row.id);
    const versionPlaceholders = projectIds.map(() => '?').join(', ');
    const versionRows = db.prepare(`
      SELECT *
      FROM versions
      WHERE project_id IN (${versionPlaceholders})
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(...projectIds);

    const versionIds = versionRows.map((row) => row.id);
    let attachmentRows = [];
    if (versionIds.length > 0) {
      const attachmentPlaceholders = versionIds.map(() => '?').join(', ');
      attachmentRows = db.prepare(`
        SELECT *
        FROM attachments
        WHERE version_id IN (${attachmentPlaceholders})
        ORDER BY datetime(created_at) DESC, id DESC
      `).all(...versionIds);
    }

    const attachmentsByVersion = new Map();
    for (const row of attachmentRows) {
      const list = attachmentsByVersion.get(row.version_id) || [];
      list.push({
        id: row.id,
        versionId: row.version_id,
        category: row.category,
        originalName: row.original_name,
        storedName: row.stored_name,
        relativePath: row.relative_path,
        absolutePath: path.join(assetsRoot, row.relative_path),
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
      });
      attachmentsByVersion.set(row.version_id, list);
    }

    const versionsByProject = new Map();
    for (const row of versionRows) {
      const list = versionsByProject.get(row.project_id) || [];
      list.push({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        contentMarkdown: row.content_markdown,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isRecommended: Boolean(row.is_recommended),
        attachments: attachmentsByVersion.get(row.id) || [],
      });
      versionsByProject.set(row.project_id, list);
    }

    return projectRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      versionCount: row.version_count,
      tags: row.tag_names ? row.tag_names.split(',').filter(Boolean) : [],
      versions: versionsByProject.get(row.id) || [],
    }));
  }

  function createProject() {
    const timestamp = nowIso();
    const result = db.prepare(`
      INSERT INTO projects(title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('未命名提示词', '', timestamp, timestamp);

    return result.lastInsertRowid;
  }

  function updateProject({ id, title, description = '', tags = [] }) {
    const timestamp = nowIso();
    db.prepare(`
      UPDATE projects
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(title.trim() || '未命名提示词', description, timestamp, id);
    replaceProjectTags(id, tags);
    return id;
  }

  const deleteProjectTx = db.transaction((projectId) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    cleanupUnusedTags.run();
  });

  function deleteProject(projectId) {
    deleteProjectTx(projectId);
    removePath(path.join(assetsRoot, String(projectId)));
  }

  function createVersion(projectId) {
    const timestamp = nowIso();
    const result = db.prepare(`
      INSERT INTO versions(project_id, name, description, content_markdown, created_at, updated_at, is_recommended)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(projectId, '新版本', '', '', timestamp, timestamp);

    touchProject.run(timestamp, projectId);
    return result.lastInsertRowid;
  }

  function updateVersion({ id, name, description = '', contentMarkdown = '' }) {
    const versionRow = db.prepare('SELECT project_id FROM versions WHERE id = ?').get(id);
    if (!versionRow) {
      throw new Error('Version not found.');
    }

    const timestamp = nowIso();
    db.prepare(`
      UPDATE versions
      SET name = ?, description = ?, content_markdown = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim() || '新版本', description, contentMarkdown, timestamp, id);
    touchProject.run(timestamp, versionRow.project_id);
    return id;
  }

  const deleteVersionTx = db.transaction((versionId) => {
    const versionRow = db.prepare('SELECT id, project_id FROM versions WHERE id = ?').get(versionId);
    if (!versionRow) {
      return null;
    }

    db.prepare('DELETE FROM versions WHERE id = ?').run(versionId);
    touchProject.run(nowIso(), versionRow.project_id);
    return versionRow;
  });

  function deleteVersion(versionId) {
    const deletedVersion = deleteVersionTx(versionId);
    if (deletedVersion) {
      removePath(path.join(assetsRoot, String(deletedVersion.project_id), String(versionId)));
    }
  }

  const setRecommendedTx = db.transaction((versionId) => {
    const versionRow = db.prepare('SELECT id, project_id FROM versions WHERE id = ?').get(versionId);
    if (!versionRow) {
      throw new Error('Version not found.');
    }

    db.prepare('UPDATE versions SET is_recommended = 0 WHERE project_id = ?').run(versionRow.project_id);
    db.prepare('UPDATE versions SET is_recommended = 1 WHERE id = ?').run(versionId);
    touchProject.run(nowIso(), versionRow.project_id);
  });

  function setRecommended(versionId) {
    setRecommendedTx(versionId);
  }

  function addAttachments({ versionId, category, filePaths }) {
    const versionRow = db.prepare(`
      SELECT v.id, v.project_id
      FROM versions v
      WHERE v.id = ?
    `).get(versionId);

    if (!versionRow) {
      throw new Error('Version not found.');
    }

    const targetDir = path.join(assetsRoot, String(versionRow.project_id), String(versionId));
    ensureDir(targetDir);

    const insertedIds = [];
    for (const sourcePath of filePaths) {
      const originalName = path.basename(sourcePath);
      const storedName = `${Date.now()}-${sanitizeFileName(originalName)}`;
      const destinationPath = path.join(targetDir, storedName);
      fs.copyFileSync(sourcePath, destinationPath);
      const stats = fs.statSync(destinationPath);
      const relativePath = path.relative(assetsRoot, destinationPath);
      const createdAt = nowIso();

      const result = db.prepare(`
        INSERT INTO attachments(version_id, category, original_name, stored_name, relative_path, mime_type, file_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(versionId, category, originalName, storedName, relativePath, '', stats.size, createdAt);

      insertedIds.push(result.lastInsertRowid);
    }

    touchProject.run(nowIso(), versionRow.project_id);
    return insertedIds;
  }

  function removeAttachment(attachmentId) {
    const attachmentRow = db.prepare(`
      SELECT
        a.id,
        a.relative_path,
        v.project_id
      FROM attachments a
      JOIN versions v ON v.id = a.version_id
      WHERE a.id = ?
    `).get(attachmentId);

    if (!attachmentRow) {
      return;
    }

    db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
    removePath(path.join(assetsRoot, attachmentRow.relative_path));
    touchProject.run(nowIso(), attachmentRow.project_id);
  }

  function getVersion(versionId) {
    const versionRow = db.prepare(`
      SELECT
        v.*,
        p.title AS project_title
      FROM versions v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = ?
    `).get(versionId);

    if (!versionRow) {
      throw new Error('Version not found.');
    }

    return {
      id: versionRow.id,
      projectId: versionRow.project_id,
      projectTitle: versionRow.project_title,
      name: versionRow.name,
      description: versionRow.description,
      contentMarkdown: versionRow.content_markdown,
      createdAt: versionRow.created_at,
      updatedAt: versionRow.updated_at,
      isRecommended: Boolean(versionRow.is_recommended),
    };
  }

  function getVersionAttachments(versionId) {
    const rows = db.prepare(`
      SELECT *
      FROM attachments
      WHERE version_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
    `).all(versionId);

    return rows.map((row) => ({
      id: row.id,
      versionId: row.version_id,
      category: row.category,
      originalName: row.original_name,
      storedName: row.stored_name,
      relativePath: row.relative_path,
      absolutePath: path.join(assetsRoot, row.relative_path),
      mimeType: row.mime_type,
      fileSize: row.file_size,
      createdAt: row.created_at,
    }));
  }

  function writeExportBundle(versionId, outputDir) {
    const version = getVersion(versionId);
    const attachments = getVersionAttachments(versionId);

    ensureDir(outputDir);
    const attachmentRoot = path.join(outputDir, 'attachments');
    ensureDir(attachmentRoot);

    const metadata = {
      projectTitle: version.projectTitle,
      versionName: version.name,
      versionDescription: version.description,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      isRecommended: version.isRecommended,
      attachments: attachments.map((attachment) => ({
        category: attachment.category,
        originalName: attachment.originalName,
        storedName: attachment.storedName,
        relativePath: attachment.relativePath,
        fileSize: attachment.fileSize,
        createdAt: attachment.createdAt,
      })),
    };

    fs.writeFileSync(path.join(outputDir, 'prompt.md'), version.contentMarkdown || '', 'utf8');
    fs.writeFileSync(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    for (const attachment of attachments) {
      const destinationDir = path.join(attachmentRoot, categoryFolder(attachment.category));
      ensureDir(destinationDir);
      fs.copyFileSync(attachment.absolutePath, path.join(destinationDir, attachment.originalName));
    }
  }

  async function exportVersion({ versionId, format, destinationPath }) {
    const version = getVersion(versionId);
    const folderName = sanitizeFileName(`${version.projectTitle}_${version.name}_${version.createdAt.replace(/[:.]/g, '-')}`);

    if (format === 'folder') {
      const exportDir = path.join(destinationPath, folderName);
      writeExportBundle(versionId, exportDir);
      return exportDir;
    }

    const tempDir = path.join(os.tmpdir(), `prompt-version-manager-${Date.now()}`, folderName);
    ensureDir(tempDir);
    writeExportBundle(versionId, tempDir);
    await createZipFromDirectory(tempDir, destinationPath);
    removePath(path.dirname(tempDir));
    return destinationPath;
  }

  return {
    dbPath,
    assetsRoot,
    loadHierarchy,
    createProject,
    updateProject,
    deleteProject,
    createVersion,
    updateVersion,
    deleteVersion,
    setRecommended,
    addAttachments,
    removeAttachment,
    getVersion,
    getVersionAttachments,
    exportVersion,
  };
}

module.exports = {
  initializeDatabase,
};
