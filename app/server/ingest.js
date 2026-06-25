import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { insertItem, updateItemCategorization } from './db.js';
import { categorizeFile, EPUB_TYPE, DOCX_TYPE, PPTX_TYPE } from './categorize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FILES_DIR = path.join(__dirname, '..', 'data', 'files');
await fs.mkdir(FILES_DIR, { recursive: true });

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.epub': EPUB_TYPE,
  '.docx': DOCX_TYPE,
  '.pptx': PPTX_TYPE,
};

export function guessMimetype(filename) {
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

function storedFilename(originalName) {
  return `${randomUUID()}-${path.basename(originalName).replace(/[^\w.\-]/g, '_')}`;
}

/** Déplace un fichier existant sur disque vers le stockage géré. */
export async function ingestFromPath(srcPath, originalName, source, { driveFileId = null } = {}) {
  const dest = path.join(FILES_DIR, storedFilename(originalName));
  await fs.rename(srcPath, dest);
  return finalize(dest, originalName, source, driveFileId);
}

/** Écrit un buffer en mémoire vers le stockage géré (ex: Drive download, share target). */
export async function ingestFromBuffer(buffer, originalName, source, { driveFileId = null } = {}) {
  const dest = path.join(FILES_DIR, storedFilename(originalName));
  await fs.writeFile(dest, buffer);
  return finalize(dest, originalName, source, driveFileId);
}

/** Le fichier est déjà au bon endroit (ex: multer a écrit directement dans FILES_DIR). */
export async function ingestExisting(filePath, originalName, source, { driveFileId = null } = {}) {
  return finalize(filePath, originalName, source, driveFileId);
}

async function finalize(filePath, originalName, source, driveFileId) {
  const stat = await fs.stat(filePath);
  const mimetype = guessMimetype(originalName);
  const id = insertItem({
    filename: originalName,
    filepath: path.relative(path.join(__dirname, '..'), filePath),
    mimetype,
    size: stat.size,
    source,
    driveFileId,
  });

  categorizeFile(filePath, mimetype, originalName)
    .then((result) => updateItemCategorization(id, result))
    .catch((err) => {
      console.error(`Catégorisation échouée pour #${id} (${originalName}):`, err.message);
      updateItemCategorization(id, {
        category: 'Non catégorisé',
        tags: [],
        description: '',
        ocrText: err.ocrText || '',
        status: 'error',
        error: err.message,
      });
    });

  return id;
}
