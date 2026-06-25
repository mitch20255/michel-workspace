import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { listItems, listCategories, getItem, deleteItem } from './db.js';
import { ingestExisting, FILES_DIR } from './ingest.js';
import { startWatcher } from './watcher.js';
import { importFromDrive } from './drive.js';
import { extractUrl, isYoutubeUrl, ingestYoutube, ingestWebpage, ingestNote } from './links.js';

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

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Protège toute l'app par mot de passe quand APP_USERNAME/APP_PASSWORD sont définis.
// Indispensable dès que l'app est exposée publiquement (ex: Fly.io) — sinon n'importe
// qui avec l'URL peut voir/uploader des fichiers. Optionnel si l'accès passe déjà par
// un réseau privé (Tailscale).
function basicAuth(req, res, next) {
  const { APP_USERNAME, APP_PASSWORD } = process.env;
  if (!APP_USERNAME || !APP_PASSWORD) return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const sep = decoded.indexOf(':');
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (safeEqual(user, APP_USERNAME) && safeEqual(pass, APP_PASSWORD)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Bibliotheque centralisee"');
  res.status(401).send('Authentification requise');
}

app.use(basicAuth);
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

// Endpoint PWA Web Share Target (Android: "Partager" -> choisir cette app).
// Reçoit soit un/des fichiers, soit un lien (YouTube ou page web), soit du texte collé.
app.post('/api/share', upload.array('file'), async (req, res) => {
  const ids = [];
  for (const file of req.files || []) {
    ids.push(await ingestExisting(file.path, file.originalname, 'phone-share'));
  }

  if (ids.length === 0) {
    const text = req.body.text || '';
    const url = req.body.url || extractUrl(text) || extractUrl(req.body.title || '');
    try {
      if (url && isYoutubeUrl(url)) {
        ids.push(await ingestYoutube(url, 'phone-share'));
      } else if (url) {
        ids.push(await ingestWebpage(url, 'phone-share'));
      } else if (text.trim()) {
        ids.push(await ingestNote(text, 'phone-share', req.body.title));
      }
    } catch (err) {
      console.error('[share] Échec:', err.message);
    }
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
  if (!process.env.APP_USERNAME || !process.env.APP_PASSWORD) {
    console.warn('[auth] APP_USERNAME/APP_PASSWORD non définis — l\'app est accessible sans mot de passe. À ne configurer ainsi que sur un réseau privé (ex: Tailscale).');
  }
  startWatcher();
});
