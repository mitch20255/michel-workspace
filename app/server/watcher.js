import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';
import { ingestFromPath } from './ingest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATCH_DIR = process.env.WATCH_DIR || path.join(__dirname, '..', 'watched');
fs.mkdirSync(WATCH_DIR, { recursive: true });

export function startWatcher() {
  const watcher = chokidar.watch(WATCH_DIR, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 200 },
  });

  watcher.on('add', async (filePath) => {
    const filename = path.basename(filePath);
    if (filename.startsWith('.')) return;
    try {
      const id = await ingestFromPath(filePath, filename, 'watched-folder');
      console.log(`[watcher] Importé #${id}: ${filename}`);
    } catch (err) {
      console.error(`[watcher] Échec import ${filename}:`, err.message);
    }
  });

  console.log(`[watcher] Surveillance du dossier: ${WATCH_DIR}`);
  return watcher;
}
