// Backend de génération vidéo — appelle les modèles IA de pointe côté serveur
// (clé jamais exposée au navigateur) puis renvoie les clips au lecteur.
//
// Fournisseurs supportés :
//   - replicate : accès unifié aux derniers modèles (Google Veo 3, Kling,
//                 Luma, MiniMax, Wan…) via un seul jeton.
//   - openai    : API Vidéos (Sora 2 / Sora 2 Pro).
//   - google    : API Gemini (Veo 3.x).
//
// Les clés sont lues dans les variables d'environnement (voir .env.example) ;
// à défaut, l'en-tête `x-provider-key` de la requête est utilisé.

import express from "express";
import { readFileSync } from "node:fs";

// Chargement léger de .env (sans dépendance) : KEY=VALUE, lignes # ignorées.
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* pas de .env : on utilisera les variables d'environnement / en-têtes */
  }
}
loadEnv();

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;

/** Stockage en mémoire des jobs : id -> { status, progress, error, buffer, contentType } */
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function newId() {
  return "job_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function setJob(id, patch) {
  const cur = jobs.get(id) || {};
  jobs.set(id, { ...cur, ...patch, updatedAt: Date.now() });
}

// Nettoyage périodique.
setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - (j.updatedAt || 0) > JOB_TTL_MS) jobs.delete(id);
  }
}, 60 * 1000).unref?.();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lit une réponse en JSON de façon tolérante (renvoie {__text} si non-JSON). */
async function readBody(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __text: text.slice(0, 300) };
  }
}
const bodyError = (b, fallback) =>
  b?.error?.message || b?.detail || b?.error || b?.__text || fallback;

function keyFor(provider, req) {
  const header = req.get("x-provider-key");
  if (header && header.trim()) return header.trim();
  if (provider === "replicate") return process.env.REPLICATE_API_TOKEN || "";
  if (provider === "openai") return process.env.OPENAI_API_KEY || "";
  if (provider === "google") return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  return "";
}

function aspectToSize(aspect) {
  switch (aspect) {
    case "9:16":
      return "720x1280";
    case "1:1":
      return "1024x1024";
    default:
      return "1280x720"; // 16:9
  }
}

async function downloadToBuffer(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Téléchargement du clip échoué (${res.status}).`);
  const arr = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arr),
    contentType: res.headers.get("content-type") || "video/mp4",
  };
}

// ---------------------------------------------------------------------------
// Replicate
// ---------------------------------------------------------------------------
async function generateReplicate({ prompt, model, aspect, seconds, extra }, key, onProgress) {
  const modelSlug = model || "google/veo-3-fast";
  const input = { prompt, ...(extra || {}) };
  // Paramètres courants (ignorés silencieusement par les modèles qui ne les
  // connaissent pas seulement si l'utilisateur les passe via `extra`).
  const createRes = await fetch(
    `https://api.replicate.com/v1/models/${modelSlug}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    },
  );
  const created = await readBody(createRes);
  if (!createRes.ok) {
    throw new Error(bodyError(created, `Replicate: erreur ${createRes.status}.`));
  }
  const pollUrl = created?.urls?.get || `https://api.replicate.com/v1/predictions/${created.id}`;

  let status = created.status;
  let output = created.output;
  let tries = 0;
  while (status === "starting" || status === "processing") {
    await sleep(3000);
    onProgress(Math.min(90, 10 + tries * 6));
    tries += 1;
    const r = await fetch(pollUrl, { headers: { Authorization: `Bearer ${key}` } });
    const j = await readBody(r);
    status = j.status;
    output = j.output;
    if (status === "failed" || status === "canceled") {
      throw new Error(j?.error || `Replicate: génération ${status}.`);
    }
    if (tries > 200) throw new Error("Replicate: délai dépassé.");
  }
  if (status !== "succeeded") throw new Error(`Replicate: statut ${status}.`);

  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (!videoUrl || typeof videoUrl !== "string") {
    throw new Error("Replicate: aucune URL vidéo dans la sortie.");
  }
  return downloadToBuffer(videoUrl);
}

// ---------------------------------------------------------------------------
// OpenAI — Videos API (Sora)
// ---------------------------------------------------------------------------
async function generateOpenAI({ prompt, model, aspect, seconds }, key, onProgress) {
  const size = aspectToSize(aspect);
  const secs = String(seconds || 8);
  const createRes = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: model || "sora-2", prompt, seconds: secs, size }),
  });
  const created = await readBody(createRes);
  if (!createRes.ok) {
    throw new Error(bodyError(created, `OpenAI: erreur ${createRes.status}.`));
  }
  let status = created.status;
  let tries = 0;
  while (status === "queued" || status === "in_progress") {
    await sleep(4000);
    const r = await fetch(`https://api.openai.com/v1/videos/${created.id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const j = await readBody(r);
    status = j.status;
    onProgress(typeof j.progress === "number" ? Math.min(95, j.progress) : Math.min(90, 10 + tries * 5));
    if (status === "failed") throw new Error(j?.error?.message || "OpenAI: génération échouée.");
    tries += 1;
    if (tries > 200) throw new Error("OpenAI: délai dépassé.");
  }
  if (status !== "completed") throw new Error(`OpenAI: statut ${status}.`);

  return downloadToBuffer(`https://api.openai.com/v1/videos/${created.id}/content`, {
    Authorization: `Bearer ${key}`,
  });
}

// ---------------------------------------------------------------------------
// Google — Gemini API (Veo)
// ---------------------------------------------------------------------------
async function generateGoogle({ prompt, model, aspect, seconds }, key, onProgress) {
  const modelName = model || "veo-3.0-fast-generate-preview";
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const createRes = await fetch(
    `${base}/models/${modelName}:predictLongRunning?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio: aspect || "16:9",
          durationSeconds: Number(seconds || 8),
          personGeneration: "allow_all",
        },
      }),
    },
  );
  const created = await readBody(createRes);
  if (!createRes.ok) {
    throw new Error(bodyError(created, `Google Veo: erreur ${createRes.status}.`));
  }
  const opName = created.name;
  if (!opName) throw new Error("Google Veo: opération introuvable.");

  let done = false;
  let payload = null;
  let tries = 0;
  while (!done) {
    await sleep(5000);
    onProgress(Math.min(90, 10 + tries * 6));
    tries += 1;
    const r = await fetch(`${base}/${opName}?key=${key}`);
    const j = await readBody(r);
    if (j.error) throw new Error(j.error.message || "Google Veo: erreur d'opération.");
    done = !!j.done;
    payload = j;
    if (tries > 200) throw new Error("Google Veo: délai dépassé.");
  }

  const uri =
    payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
    payload?.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("Google Veo: URI vidéo introuvable dans la réponse.");

  // Le fichier Veo nécessite la clé pour être téléchargé.
  const dlUrl = uri.includes("?") ? `${uri}&key=${key}` : `${uri}?key=${key}`;
  return downloadToBuffer(dlUrl);
}

const PROVIDERS = {
  replicate: generateReplicate,
  openai: generateOpenAI,
  google: generateGoogle,
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    keys: {
      replicate: !!(process.env.REPLICATE_API_TOKEN),
      openai: !!process.env.OPENAI_API_KEY,
      google: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    },
  });
});

app.post("/api/generate", async (req, res) => {
  const { prompt, provider = "replicate", model, aspect = "16:9", seconds = 8, extra } =
    req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Champ 'prompt' requis." });
  }
  const gen = PROVIDERS[provider];
  if (!gen) return res.status(400).json({ error: `Fournisseur inconnu : ${provider}.` });

  const key = keyFor(provider, req);
  if (!key) {
    return res.status(400).json({
      error: `Aucune clé pour ${provider}. Définissez la variable d'environnement correspondante ou fournissez l'en-tête x-provider-key.`,
    });
  }

  const id = newId();
  setJob(id, { status: "processing", progress: 5 });
  res.json({ id });

  gen(
    { prompt, model, aspect, seconds, extra },
    key,
    (p) => setJob(id, { progress: p }),
  )
    .then(({ buffer, contentType }) => {
      setJob(id, { status: "succeeded", progress: 100, buffer, contentType });
    })
    .catch((err) => {
      setJob(id, { status: "failed", error: String(err.message || err) });
    });
});

app.get("/api/jobs/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: "Job introuvable." });
  res.json({
    status: j.status,
    progress: j.progress || 0,
    error: j.error || null,
    videoUrl: j.status === "succeeded" ? `/api/jobs/${req.params.id}/video` : null,
  });
});

app.get("/api/jobs/:id/video", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j || j.status !== "succeeded" || !j.buffer) {
    return res.status(404).json({ error: "Vidéo indisponible." });
  }
  res.setHeader("Content-Type", j.contentType || "video/mp4");
  res.setHeader("Cache-Control", "no-store");
  res.send(j.buffer);
});

app.listen(PORT, () => {
  console.log(`🎬 Backend vidéo Docu Studio sur http://localhost:${PORT}`);
});
