import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import type {
  AttachmentKind,
  AttachmentRecord,
  CreateVersionInput,
  PromptSetInput,
  PromptSetRecord,
  PromptVersionRecord,
  UpdateVersionInput,
  VersionWithAttachments,
} from "../shared/types";

function nowMs(): number {
  return Date.now();
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function queryRows(
  db: Database,
  sql: string,
  params: (string | number | null)[] = []
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

function mapPromptSet(row: Record<string, unknown>): PromptSetRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    tags: [],
    versionCount: Number(row.version_count ?? 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapVersion(row: Record<string, unknown>): PromptVersionRecord {
  return {
    id: String(row.id),
    promptSetId: String(row.prompt_set_id),
    name: String(row.name),
    summary: String(row.summary ?? ""),
    contentMarkdown: String(row.content_markdown ?? ""),
    isRecommended: Number(row.is_recommended) === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapAttachment(row: Record<string, unknown>): AttachmentRecord {
  return {
    id: String(row.id),
    versionId: String(row.version_id),
    kind: String(row.kind) as AttachmentKind,
    originalName: String(row.original_name),
    storedName: String(row.stored_name),
    storedPath: String(row.stored_path),
    createdAt: Number(row.created_at),
  };
}

export class DatabaseService {
  private sql!: SqlJsStatic;
  private db!: Database;
  private readonly dbFilePath: string;
  private readonly assetsDir: string;

  private constructor(dbFilePath: string, assetsDir: string) {
    this.dbFilePath = dbFilePath;
    this.assetsDir = assetsDir;
  }

  static async create(dataDir: string): Promise<DatabaseService> {
    ensureDir(dataDir);
    const dbPath = path.join(dataDir, "pvm.sqlite");
    const assetsDir = path.join(dataDir, "assets");
    ensureDir(assetsDir);
    const service = new DatabaseService(dbPath, assetsDir);
    await service.init();
    return service;
  }

  getAssetsDir(): string {
    return this.assetsDir;
  }

  private async init(): Promise<void> {
    this.sql = await initSqlJs();
    if (fs.existsSync(this.dbFilePath)) {
      const raw = fs.readFileSync(this.dbFilePath);
      this.db = new this.sql.Database(new Uint8Array(raw));
    } else {
      this.db = new this.sql.Database();
    }
    this.setupSchema();
    this.persist();
  }

  private setupSchema(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS prompt_sets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        prompt_set_id TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT DEFAULT '',
        content_markdown TEXT NOT NULL DEFAULT '',
        is_recommended INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (prompt_set_id) REFERENCES prompt_sets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        version_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('image','document','video')),
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prompt_set_tags (
        prompt_set_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (prompt_set_id, tag_id),
        FOREIGN KEY (prompt_set_id) REFERENCES prompt_sets(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_prompt_sets_title ON prompt_sets(title);
      CREATE INDEX IF NOT EXISTS idx_prompt_sets_updated_at ON prompt_sets(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_versions_prompt_set_created_at ON versions(prompt_set_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_versions_prompt_set_recommended ON versions(prompt_set_id, is_recommended);
      CREATE INDEX IF NOT EXISTS idx_attachments_version_id ON attachments(version_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_kind ON attachments(kind);
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    `);
  }

  private persist(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbFilePath, Buffer.from(data));
  }

  private getTagsByPromptSet(promptSetId: string): string[] {
    return queryRows(
      this.db,
      `SELECT t.name
       FROM tags t
       JOIN prompt_set_tags pst ON pst.tag_id = t.id
       WHERE pst.prompt_set_id = ?
       ORDER BY t.name ASC`,
      [promptSetId]
    ).map((row) => String(row.name));
  }

  private upsertTags(promptSetId: string, rawTags: string[]): void {
    const tags = [...new Set(rawTags.map((item) => item.trim()).filter(Boolean))];
    this.db.run("DELETE FROM prompt_set_tags WHERE prompt_set_id = ?", [promptSetId]);
    const now = nowMs();
    for (const tagName of tags) {
      const existing = queryRows(this.db, "SELECT id FROM tags WHERE name = ?", [tagName])[0];
      const tagId = existing ? String(existing.id) : randomUUID();
      if (!existing) {
        this.db.run("INSERT INTO tags(id, name, created_at) VALUES (?, ?, ?)", [tagId, tagName, now]);
      }
      this.db.run("INSERT INTO prompt_set_tags(prompt_set_id, tag_id) VALUES (?, ?)", [promptSetId, tagId]);
    }
  }

  listPromptSets(searchTerm?: string): PromptSetRecord[] {
    const q = `%${(searchTerm ?? "").trim()}%`;
    const rows =
      !searchTerm || !searchTerm.trim()
        ? queryRows(
            this.db,
            `SELECT ps.id, ps.title, ps.description, ps.created_at, ps.updated_at,
                    COUNT(v.id) as version_count
             FROM prompt_sets ps
             LEFT JOIN versions v ON v.prompt_set_id = ps.id
             GROUP BY ps.id
             ORDER BY ps.updated_at DESC`
          )
        : queryRows(
            this.db,
            `SELECT DISTINCT ps.id, ps.title, ps.description, ps.created_at, ps.updated_at,
                    (SELECT COUNT(*) FROM versions vv WHERE vv.prompt_set_id = ps.id) as version_count
             FROM prompt_sets ps
             LEFT JOIN prompt_set_tags pst ON pst.prompt_set_id = ps.id
             LEFT JOIN tags t ON t.id = pst.tag_id
             LEFT JOIN versions v ON v.prompt_set_id = ps.id
             WHERE ps.title LIKE ?
                OR t.name LIKE ?
                OR v.name LIKE ?
                OR v.summary LIKE ?
                OR v.content_markdown LIKE ?
             ORDER BY ps.updated_at DESC`,
            [q, q, q, q, q]
          );
    return rows.map((row) => {
      const promptSet = mapPromptSet(row);
      promptSet.tags = this.getTagsByPromptSet(promptSet.id);
      return promptSet;
    });
  }

  createPromptSet(input: PromptSetInput): PromptSetRecord {
    const id = randomUUID();
    const now = nowMs();
    this.db.run(
      "INSERT INTO prompt_sets(id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [id, input.title.trim(), input.description.trim(), now, now]
    );
    this.upsertTags(id, input.tags);
    this.persist();
    const created = this.getPromptSetById(id);
    if (!created) {
      throw new Error("创建项目失败");
    }
    return created;
  }

  updatePromptSet(id: string, input: PromptSetInput): PromptSetRecord {
    const now = nowMs();
    this.db.run("UPDATE prompt_sets SET title = ?, description = ?, updated_at = ? WHERE id = ?", [
      input.title.trim(),
      input.description.trim(),
      now,
      id,
    ]);
    this.upsertTags(id, input.tags);
    this.persist();
    const updated = this.getPromptSetById(id);
    if (!updated) {
      throw new Error("项目不存在");
    }
    return updated;
  }

  deletePromptSet(id: string): void {
    this.db.run("DELETE FROM prompt_sets WHERE id = ?", [id]);
    this.persist();
  }

  listVersions(promptSetId: string): VersionWithAttachments[] {
    const rows = queryRows(
      this.db,
      `SELECT id, prompt_set_id, name, summary, content_markdown, is_recommended, created_at, updated_at
       FROM versions
       WHERE prompt_set_id = ?
       ORDER BY created_at DESC`,
      [promptSetId]
    );
    return rows.map((row) => {
      const version = mapVersion(row);
      return { ...version, attachments: this.listAttachments(version.id) };
    });
  }

  createVersion(input: CreateVersionInput): PromptVersionRecord {
    const id = randomUUID();
    const now = nowMs();
    this.db.run(
      `INSERT INTO versions(id, prompt_set_id, name, summary, content_markdown, is_recommended, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, input.promptSetId, input.name.trim(), input.summary.trim(), input.contentMarkdown, now, now]
    );
    this.db.run("UPDATE prompt_sets SET updated_at = ? WHERE id = ?", [now, input.promptSetId]);
    this.persist();
    const created = this.getVersionById(id);
    if (!created) {
      throw new Error("创建版本失败");
    }
    return created;
  }

  updateVersion(versionId: string, input: UpdateVersionInput): PromptVersionRecord {
    const row = queryRows(this.db, "SELECT prompt_set_id FROM versions WHERE id = ?", [versionId])[0];
    if (!row) {
      throw new Error("版本不存在");
    }
    const now = nowMs();
    this.db.run(
      "UPDATE versions SET name = ?, summary = ?, content_markdown = ?, updated_at = ? WHERE id = ?",
      [input.name.trim(), input.summary.trim(), input.contentMarkdown, now, versionId]
    );
    this.db.run("UPDATE prompt_sets SET updated_at = ? WHERE id = ?", [now, String(row.prompt_set_id)]);
    this.persist();
    const updated = this.getVersionById(versionId);
    if (!updated) {
      throw new Error("版本不存在");
    }
    return updated;
  }

  deleteVersion(versionId: string): void {
    const row = queryRows(this.db, "SELECT prompt_set_id FROM versions WHERE id = ?", [versionId])[0];
    if (!row) {
      return;
    }
    this.db.run("DELETE FROM versions WHERE id = ?", [versionId]);
    this.db.run("UPDATE prompt_sets SET updated_at = ? WHERE id = ?", [nowMs(), String(row.prompt_set_id)]);
    this.persist();
  }

  listAttachments(versionId: string): AttachmentRecord[] {
    return queryRows(
      this.db,
      `SELECT id, version_id, kind, original_name, stored_name, stored_path, created_at
       FROM attachments
       WHERE version_id = ?
       ORDER BY created_at DESC`,
      [versionId]
    ).map(mapAttachment);
  }

  createAttachment(input: {
    versionId: string;
    kind: AttachmentKind;
    originalName: string;
    storedName: string;
    storedPath: string;
  }): AttachmentRecord {
    const id = randomUUID();
    this.db.run(
      `INSERT INTO attachments(id, version_id, kind, original_name, stored_name, stored_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.versionId, input.kind, input.originalName, input.storedName, input.storedPath, nowMs()]
    );
    this.persist();
    const created = this.getAttachmentById(id);
    if (!created) {
      throw new Error("附件创建失败");
    }
    return created;
  }

  deleteAttachment(attachmentId: string): void {
    this.db.run("DELETE FROM attachments WHERE id = ?", [attachmentId]);
    this.persist();
  }

  setRecommendedVersion(versionId: string): void {
    const version = this.getVersionById(versionId);
    if (!version) {
      throw new Error("版本不存在");
    }
    this.db.run("UPDATE versions SET is_recommended = 0 WHERE prompt_set_id = ?", [version.promptSetId]);
    this.db.run("UPDATE versions SET is_recommended = 1 WHERE id = ?", [versionId]);
    this.db.run("UPDATE prompt_sets SET updated_at = ? WHERE id = ?", [nowMs(), version.promptSetId]);
    this.persist();
  }

  getPromptSetById(promptSetId: string): PromptSetRecord | null {
    const row = queryRows(
      this.db,
      `SELECT ps.id, ps.title, ps.description, ps.created_at, ps.updated_at,
              COUNT(v.id) as version_count
       FROM prompt_sets ps
       LEFT JOIN versions v ON v.prompt_set_id = ps.id
       WHERE ps.id = ?
       GROUP BY ps.id`,
      [promptSetId]
    )[0];
    if (!row) {
      return null;
    }
    const promptSet = mapPromptSet(row);
    promptSet.tags = this.getTagsByPromptSet(promptSetId);
    return promptSet;
  }

  getVersionById(versionId: string): PromptVersionRecord | null {
    const row = queryRows(
      this.db,
      `SELECT id, prompt_set_id, name, summary, content_markdown, is_recommended, created_at, updated_at
       FROM versions
       WHERE id = ?`,
      [versionId]
    )[0];
    return row ? mapVersion(row) : null;
  }

  getAttachmentsByVersion(versionId: string): AttachmentRecord[] {
    return this.listAttachments(versionId);
  }

  getAttachmentById(id: string): AttachmentRecord | null {
    const row = queryRows(
      this.db,
      `SELECT id, version_id, kind, original_name, stored_name, stored_path, created_at
       FROM attachments
       WHERE id = ?`,
      [id]
    )[0];
    return row ? mapAttachment(row) : null;
  }

  getVersionsByPromptSet(promptSetId: string): PromptVersionRecord[] {
    return this.listVersions(promptSetId).map(({ attachments, ...version }) => version);
  }
}
