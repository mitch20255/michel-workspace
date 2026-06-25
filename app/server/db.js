import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'library.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS item_lists (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, list_id)
  );
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('items', 'content_type', "TEXT NOT NULL DEFAULT 'file'");
ensureColumn('items', 'source_url', 'TEXT');
ensureColumn('items', 'is_read', 'INTEGER NOT NULL DEFAULT 0');

const ITEM_LISTS_JSON = `(
  SELECT json_group_array(json_object('id', l.id, 'name', l.name))
  FROM item_lists il JOIN lists l ON l.id = il.list_id
  WHERE il.item_id = items.id
)`;

export function insertItem({
  filename, filepath, mimetype, size, source, driveFileId = null,
  contentType = 'file', sourceUrl = null,
}) {
  const stmt = db.prepare(`
    INSERT INTO items (filename, filepath, mimetype, size, source, drive_file_id, content_type, source_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  const info = stmt.run(filename, filepath, mimetype, size, source, driveFileId, contentType, sourceUrl);
  return info.lastInsertRowid;
}

export function updateItemCategorization(id, { category, tags, description, ocrText, status = 'categorized', error = null, filename = null }) {
  if (filename) {
    db.prepare('UPDATE items SET filename = ? WHERE id = ?').run(filename, id);
  }
  db.prepare(`
    UPDATE items
    SET category = ?, tags = ?, description = ?, ocr_text = ?, status = ?, error = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(category, JSON.stringify(tags ?? []), description, ocrText, status, error, id);
}

export function getItem(id) {
  return db.prepare(`SELECT items.*, ${ITEM_LISTS_JSON} as lists_json FROM items WHERE id = ?`).get(id);
}

export function listItems({ category, q, status, list } = {}) {
  let sql = `SELECT items.*, ${ITEM_LISTS_JSON} as lists_json FROM items WHERE 1=1`;
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (list) {
    sql += ' AND id IN (SELECT item_id FROM item_lists WHERE list_id = ?)';
    params.push(list);
  }
  if (q) {
    sql += ' AND (filename LIKE ? OR description LIKE ? OR ocr_text LIKE ? OR tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}

export function setItemRead(id, isRead) {
  db.prepare('UPDATE items SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, id);
}

export function listLists() {
  return db.prepare(`
    SELECT lists.id, lists.name, COUNT(item_lists.item_id) as count
    FROM lists
    LEFT JOIN item_lists ON item_lists.list_id = lists.id
    GROUP BY lists.id
    ORDER BY lists.name
  `).all();
}

export function createList(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nom de liste vide');
  db.prepare('INSERT OR IGNORE INTO lists (name) VALUES (?)').run(trimmed);
  return db.prepare('SELECT * FROM lists WHERE name = ?').get(trimmed);
}

export function addItemToList(itemId, listId) {
  db.prepare('INSERT OR IGNORE INTO item_lists (item_id, list_id) VALUES (?, ?)').run(itemId, listId);
}

export function removeItemFromList(itemId, listId) {
  db.prepare('DELETE FROM item_lists WHERE item_id = ? AND list_id = ?').run(itemId, listId);
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
