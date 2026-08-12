#!/usr/bin/env node
/**
 * Second Brain — Moteur de capture automatique.
 *
 * Deux modes :
 *   1. Batch  (nightly cron)         : node capture.mjs
 *      -> va chercher les NOUVEAUX YouTube likés + articles Readwise/Reader
 *   2. Single (repository_dispatch)  : node capture.mjs --url <url> [--type ..] [--source ..]
 *      -> capture UN contenu précis (déclenché par IFTTT/Zapier/partage)
 *
 * Sortie : des notes .md dans <VAULT_DIR>/01-Sources/<Type>/, prêtes pour Obsidian.
 * Aucune dépendance npm : Node 18+ (fetch natif). Chaque item est isolé (un échec
 * n'arrête pas le run). L'état (ids déjà vus) est gardé dans automation/.state.json.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------- config
const ENV = process.env;
const VAULT_DIR = ENV.VAULT_DIR || "second-brain-vault";
const STATE_FILE = "automation/.state.json";
const MODEL = ENV.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const MAX_NEW_PER_RUN = Number(ENV.MAX_NEW_PER_RUN || 20);
// Projets actifs proposés à Claude pour le rattachement (tag = slug du nom).
const PROJECTS = (ENV.PROJECTS || "Parenting").split(",").map((s) => s.trim()).filter(Boolean);
const CATEGORIES = [
  "AI & Machine Learning", "Business & Stratégie", "Développement / Code",
  "Marketing & Growth", "Design & Créatif", "Finance & Investissement",
  "Productivité & Outils", "Parenting", "Santé & Bien-être", "Personnel", "Autre",
];

const TYPE_FOLDER = { article: "Articles", video: "YouTube", post: "Instagram", journal: "Journal", podcast: "Podcasts" };

// ---------------------------------------------------------------- utils
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function slug(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function safeTitle(s) {
  return (s || "sans-titre").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
}
function yaml(v) {
  if (Array.isArray(v)) return "[" + v.map((x) => JSON.stringify(String(x))).join(", ") + "]";
  return JSON.stringify(String(v ?? ""));
}

async function loadState() {
  try { return JSON.parse(await readFile(STATE_FILE, "utf8")); }
  catch { return { youtube: [], readwise: [], lastRun: null }; }
}
async function saveState(state) {
  state.lastRun = nowISO();
  for (const k of ["youtube", "readwise"]) state[k] = (state[k] || []).slice(-800);
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

// ---------------------------------------------------------------- fetchers
// Jina Reader : transforme une URL (article OU vidéo YouTube) en texte/transcript propre.
async function readContent(url) {
  try {
    const headers = { "X-Return-Format": "markdown" };
    if (ENV.JINA_API_KEY) headers.Authorization = `Bearer ${ENV.JINA_API_KEY}`;
    const r = await fetch("https://r.jina.ai/" + url, { headers });
    if (!r.ok) return "";
    return (await r.text()).slice(0, 12000); // borne le coût tokens
  } catch { return ""; }
}

// ---------------------------------------------------------------- Claude (le bibliothécaire)
const SYSTEM = `Tu es le bibliothécaire du "second brain" de Mitch, entrepreneur digital québécois francophone.
On te donne le contenu brut d'un truc qu'il vient de CONSOMMER (vidéo YouTube, article, post). Ton job : le digérer.

Réponds en JSON STRICT, rien avant/après :
{
  "title": "Titre clair et descriptif (max 70 car.)",
  "source": "Nom du média / chaîne / auteur",
  "summary": "2-3 phrases en français : de quoi ça parle, pourquoi c'est utile.",
  "takeaways": ["3 à 5 apprentissages concrets et actionnables"],
  "category": "UNE de: ${CATEGORIES.join(" | ")}",
  "tags": ["3 à 6 tags fins, minuscules, mots liés par des tirets"],
  "projets": ["0 à 2 parmi: ${PROJECTS.join(" | ")} — vide si rien ne colle"],
  "importance": "high | medium | low"
}
Sois concret. Les takeaways sont le vrai apprentissage, pas un résumé. Si le contenu est mince, déduis au mieux.`;

async function analyze(rawText, meta) {
  const userMsg = `TYPE: ${meta.type}\nSOURCE: ${meta.source || "?"}\nURL: ${meta.url}\nTITRE BRUT: ${meta.title || "?"}\n\nCONTENU:\n${rawText || "(pas de contenu récupéré — déduis à partir du titre/source)"}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ENV.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1200, system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  let text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  text = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  return JSON.parse(text);
}

// ---------------------------------------------------------------- écriture de la note
async function writeNote(meta, a) {
  const projetTags = (a.projets || []).map(slug);
  const tags = [...new Set([...(a.tags || []), ...projetTags])];
  const projets = (a.projets || []).map((p) => `[[${p} - MOC]]`);
  const folder = TYPE_FOLDER[meta.type] || "Autre";
  const fname = `${today()} - ${safeTitle(a.title)}.md`;
  const dir = path.join(VAULT_DIR, "01-Sources", folder);
  const full = path.join(dir, fname);
  if (existsSync(full)) return null; // déjà là

  const fm = [
    "---",
    `type: ${meta.type}`,
    `source: ${yaml(a.source || meta.source || "")}`,
    `url: ${meta.url}`,
    `date: ${today()}`,
    `category: ${yaml(a.category || "Autre")}`,
    `tags: ${yaml(tags)}`,
    `projets: ${yaml(projets)}`,
    `importance: ${a.importance || "medium"}`,
    `status: traité`,
    `capture: auto`,
    `id: ${meta.id}`,
    "---",
  ].join("\n");

  const body = [
    ``,
    `# ${a.title}`,
    ``,
    `> **Résumé** — ${a.summary || ""}`,
    ``,
    `## 🎯 Key takeaways`,
    ...(a.takeaways || []).map((t) => `- ${t}`),
    ``,
    `## 🧠 Mes notes`,
    `(À compléter si tu veux creuser.)`,
    ``,
    `## 🔗 Liens`,
    `- Source : ${meta.url}`,
    ...(projets.length ? [`- Projet : ${projets.join(", ")}`] : []),
    ``,
  ].join("\n");

  await mkdir(dir, { recursive: true });
  await writeFile(full, fm + "\n" + body);
  return full;
}

// pipeline unitaire réutilisé par les 2 modes
async function ingest(meta) {
  const raw = await readContent(meta.url);
  const a = await analyze(raw, meta);
  const file = await writeNote(meta, a);
  return { file, title: a.title, category: a.category };
}

// ---------------------------------------------------------------- YouTube (vidéos likées)
async function ytAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.YT_CLIENT_ID, client_secret: ENV.YT_CLIENT_SECRET,
      refresh_token: ENV.YT_REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`YouTube token ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}
async function ytLikes(token) {
  const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${token}` } });
  const chj = await ch.json();
  const likes = chj?.items?.[0]?.contentDetails?.relatedPlaylists?.likes || "LL";
  const pl = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=25&playlistId=${likes}`,
    { headers: { Authorization: `Bearer ${token}` } });
  const plj = await pl.json();
  return (plj.items || []).map((it) => ({
    id: it.contentDetails?.videoId,
    title: it.snippet?.title,
    source: it.snippet?.videoOwnerChannelTitle || "YouTube",
    url: `https://www.youtube.com/watch?v=${it.contentDetails?.videoId}`,
    type: "video",
  })).filter((v) => v.id && v.title !== "Private video" && v.title !== "Deleted video");
}
async function captureYouTube(state) {
  if (!ENV.YT_REFRESH_TOKEN) return [];
  const token = await ytAccessToken();
  const items = await ytLikes(token);
  const seen = new Set(state.youtube);
  const fresh = items.filter((v) => !seen.has(v.id)).slice(0, MAX_NEW_PER_RUN);
  const done = [];
  for (const v of fresh) {
    try { const r = await ingest(v); state.youtube.push(v.id); if (r.file) done.push(r); }
    catch (e) { console.error("YT fail", v.id, e.message); }
  }
  return done;
}

// ---------------------------------------------------------------- Readwise Reader (articles/vidéos sauvegardés)
async function captureReadwise(state) {
  if (!ENV.READWISE_TOKEN) return [];
  const after = state.lastRun || new Date(Date.now() - 3 * 864e5).toISOString();
  const url = new URL("https://readwise.io/api/v3/list/");
  url.searchParams.set("updatedAfter", after);
  const r = await fetch(url, { headers: { Authorization: `Token ${ENV.READWISE_TOKEN}` } });
  if (!r.ok) { console.error("Readwise", r.status); return []; }
  const data = await r.json();
  const seen = new Set(state.readwise);
  const items = (data.results || [])
    .filter((d) => d.source_url && !seen.has(d.id))
    .slice(0, MAX_NEW_PER_RUN);
  const done = [];
  for (const d of items) {
    const type = d.category === "video" ? "video" : d.category === "tweet" ? "post" : "article";
    try {
      const r2 = await ingest({ id: String(d.id), title: d.title, source: d.author || d.site_name || "Readwise", url: d.source_url, type });
      state.readwise.push(d.id); if (r2.file) done.push(r2);
    } catch (e) { console.error("Readwise fail", d.id, e.message); }
  }
  return done;
}

// ---------------------------------------------------------------- CLI args
function parseArgs() {
  const a = process.argv.slice(2); const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1];
  return o;
}
function inferType(url = "") {
  if (/youtube\.com|youtu\.be/.test(url)) return "video";
  if (/instagram\.com/.test(url)) return "post";
  return "article";
}

// ---------------------------------------------------------------- main
async function main() {
  const args = parseArgs();

  if ("selftest" in args) {
    // Vérifie la génération de note SANS réseau ni clé.
    const meta = { id: "selftest", title: "Test", source: "Démo", url: "https://example.com", type: "article" };
    const a = {
      title: "Note de test — le système écrit bien",
      source: "Démo", summary: "Ceci prouve que la génération de note fonctionne.",
      takeaways: ["Le frontmatter est correct", "Le tag projet est ajouté", "Le fichier atterrit dans 01-Sources"],
      category: "Productivité & Outils", tags: ["test"], projets: ["Parenting"], importance: "low",
    };
    const f = await writeNote(meta, a);
    console.log(f ? `✅ Selftest OK → ${f}` : "ℹ️ Selftest: note déjà existante");
    return;
  }

  if (!ENV.ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY manquant"); process.exit(1); }
  const state = await loadState();
  let done = [];

  if (args.url) {
    // Mode single (webhook / partage)
    const meta = { id: slug(args.url).slice(-40) || String(Date.now()), title: args.title, source: args.source, url: args.url, type: args.type || inferType(args.url) };
    try { const r = await ingest(meta); if (r.file) done.push(r); } catch (e) { console.error("ingest fail", e.message); }
  } else {
    // Mode batch (cron)
    done = done.concat(await captureYouTube(state));
    done = done.concat(await captureReadwise(state));
  }

  await saveState(state);
  console.log(`✅ ${done.length} note(s) créée(s)`);
  for (const d of done) console.log(`   • [${d.category}] ${d.title}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
