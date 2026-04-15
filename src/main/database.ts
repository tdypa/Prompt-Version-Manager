import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'prompt-version-manager.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      content TEXT DEFAULT '',
      is_recommended INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('image', 'document', 'video')),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_versions_prompt_id ON versions(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_versions_created_at ON versions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_version_id ON attachments(version_id);
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}
