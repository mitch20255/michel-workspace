import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'library.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    source TEXT NOT NULL,
    drive_file_id TEXT,
    category TEXT,
    tags TEXT,
    description TEXT,
    ocr_text TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_items_drive_file_id ON items(drive_file_id) WHERE drive_file_id IS NOT NULL;
`);

export function insertItem({ filename, filepath, mimetype, size, source, driveFileId = null }) {
  const stmt = db.prepare(`
    INSERT INTO items (filename, filepath, mimetype, size, source, drive_file_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);
  const info = stmt.run(filename, filepath, mimetype, size, source, driveFileId);
  return info.lastInsertRowid;
}

export function updateItemCategorization(id, { category, tags, description, ocrText, status = 'categorized', error = null }) {
  db.prepare(`
    UPDATE items
    SET category = ?, tags = ?, description = ?, ocr_text = ?, status = ?, error = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(category, JSON.stringify(tags ?? []), description, ocrText, status, error, id);
}

export function getItem(id) {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
}

export function listItems({ category, q, status } = {}) {
  let sql = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (filename LIKE ? OR description LIKE ? OR ocr_text LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}

export function listCategories() {
  return db.prepare(`
    SELECT category, COUNT(*) as count
    FROM items
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `).all();
}

export function findByDriveFileId(driveFileId) {
  return db.prepare('SELECT * FROM items WHERE drive_file_id = ?').get(driveFileId);
}

export function deleteItem(id) {
  return db.prepare('DELETE FROM items WHERE id = ?').run(id);
}
