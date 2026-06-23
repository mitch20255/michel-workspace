import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { listItems, listCategories, getItem, deleteItem } from './db.js';
import { ingestExisting, FILES_DIR } from './ingest.js';
import { startWatcher } from './watcher.js';
import { importFromDrive } from './drive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.diskStorage({
    destination: FILES_DIR,
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

app.get('/api/items', (req, res) => {
  const { category, q, status } = req.query;
  res.json(listItems({ category, q, status }));
});

app.get('/api/categories', (req, res) => {
  res.json(listCategories());
});

app.get('/api/files/:id', (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).end();
  res.type(item.mimetype || 'application/octet-stream');
  res.sendFile(path.join(__dirname, '..', item.filepath), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

app.delete('/api/items/:id', (req, res) => {
  deleteItem(req.params.id);
  res.status(204).end();
});

app.post('/api/upload', upload.array('file'), async (req, res) => {
  const ids = [];
  for (const file of req.files || []) {
    const id = await ingestExisting(file.path, file.originalname, 'manual-upload');
    ids.push(id);
  }
  res.json({ ids });
});

// Endpoint PWA Web Share Target (Android: "Partager" -> choisir cette app)
app.post('/api/share', upload.array('file'), async (req, res) => {
  const ids = [];
  for (const file of req.files || []) {
    const id = await ingestExisting(file.path, file.originalname, 'phone-share');
    ids.push(id);
  }
  res.redirect('/?shared=' + ids.length);
});

app.post('/api/import/drive', async (req, res) => {
  try {
    const imported = await importFromDrive();
    res.json({ imported });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Centralized Data DB en écoute sur http://localhost:${PORT}`);
  startWatcher();
});
