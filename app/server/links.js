import dns from 'node:dns/promises';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { YoutubeTranscript } from 'youtube-transcript';
import { insertItem, updateItemCategorization } from './db.js';
import { getClient, MODEL, extractJson } from './anthropic.js';

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/;
const NOTE_SUMMARY_THRESHOLD = 500; // caractères

export function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

export function isYoutubeUrl(url) {
  return YOUTUBE_RE.test(url);
}

export function isVimeoUrl(url) {
  return /vimeo\.com/i.test(url);
}

export function isTiktokUrl(url) {
  return /tiktok\.com/i.test(url);
}

function failItem(id, err, overrides = {}) {
  console.error(`[links] Catégorisation échouée pour #${id}:`, err.message);
  updateItemCategorization(id, {
    category: 'Non catégorisé', tags: [], description: '', ocrText: '', status: 'error', error: err.message, ...overrides,
  });
}

// --- YouTube ---------------------------------------------------------------

const YOUTUBE_SYSTEM_PROMPT = `Tu organises une bibliothèque personnelle. On te donne le transcript d'une vidéo YouTube.
Retourne UNIQUEMENT un objet JSON avec:
- "category": catégorie courte et cohérente (ex: "Vidéo - Tutoriel", "Vidéo - Actualité", "Vidéo - Divertissement", "Vidéo - Éducatif"). Réutilise une catégorie existante si pertinent.
- "tags": 2 à 6 mots-clés courts en minuscules.
- "summary": un résumé LONG et structuré en français (sections avec titres courts en gras markdown "**Titre**", points clés en liste à tirets, et 1-3 citations marquantes si présentes). Vise 200-500 mots selon la richesse du contenu.
Ne retourne rien d'autre que le JSON.`;

async function getYoutubeTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}

async function categorizeYoutube(title, transcript) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: YOUTUBE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Titre: ${title || '(inconnu)'}\n\nTranscript:\n${transcript.slice(0, 15000)}` }],
  });
  const result = extractJson(response.content[0].text);
  return { category: result.category || 'Vidéo', tags: result.tags || [], description: result.summary || '' };
}

export async function ingestYoutube(url, source) {
  const match = url.match(YOUTUBE_RE);
  if (!match) throw new Error('URL YouTube invalide');
  const videoId = match[1];

  const id = insertItem({
    filename: url, filepath: '', mimetype: null, size: 0, source, contentType: 'youtube', sourceUrl: url,
  });

  (async () => {
    const title = await getYoutubeTitle(videoId);
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'fr' }).catch(() =>
      YoutubeTranscript.fetchTranscript(videoId)
    );
    const transcript = transcriptItems.map((t) => t.text).join(' ');
    if (!transcript.trim()) throw new Error('Aucun transcript disponible pour cette vidéo');
    try {
      const result = await categorizeYoutube(title, transcript);
      updateItemCategorization(id, { ...result, ocrText: transcript, filename: title || url });
    } catch (err) {
      // Le transcript a été récupéré avec succès — on l'archive même si le résumé IA échoue.
      failItem(id, err, { ocrText: transcript, filename: title || url });
    }
  })().catch((err) => failItem(id, err));

  return id;
}

// --- Vidéos via oEmbed (Vimeo, TikTok) — métadonnées seulement, pas de transcript ----

const VIDEO_SYSTEM_PROMPT = `Tu organises une bibliothèque personnelle. On te donne le titre et l'auteur d'une vidéo (Vimeo ou TikTok) — aucun transcript n'est disponible pour ce type de vidéo.
Retourne UNIQUEMENT un objet JSON avec:
- "category": catégorie courte (ex: "Vidéo - Divertissement", "Vidéo - Tutoriel", "Vidéo - Actualité"). Réutilise une catégorie existante si pertinent.
- "tags": 2 à 6 mots-clés courts en minuscules.
- "summary": une description en français de 1-2 phrases basée sur le titre et l'auteur.
Ne retourne rien d'autre que le JSON.`;

async function categorizeVideoMetadata(title, author) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: VIDEO_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Titre: ${title || '(inconnu)'}\nAuteur: ${author || '(inconnu)'}` }],
  });
  const result = extractJson(response.content[0].text);
  return { category: result.category || 'Vidéo', tags: result.tags || [], description: result.summary || '' };
}

async function ingestOembedVideo(url, source, { contentType, oembedUrl }) {
  const id = insertItem({
    filename: url, filepath: '', mimetype: null, size: 0, source, contentType, sourceUrl: url,
  });

  (async () => {
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error(`oEmbed indisponible pour cette vidéo (HTTP ${res.status})`);
    const data = await res.json();
    const title = data.title || url;
    const result = await categorizeVideoMetadata(title, data.author_name);
    updateItemCategorization(id, { ...result, ocrText: '', filename: title });
  })().catch((err) => failItem(id, err));

  return id;
}

export async function ingestVimeo(url, source) {
  return ingestOembedVideo(url, source, {
    contentType: 'vimeo',
    oembedUrl: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  });
}

export async function ingestTiktok(url, source) {
  return ingestOembedVideo(url, source, {
    contentType: 'tiktok',
    oembedUrl: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  });
}

// --- Pages web ---------------------------------------------------------------

const WEBPAGE_SYSTEM_PROMPT = `Tu organises une bibliothèque personnelle. On te donne le contenu d'une page web.
Retourne UNIQUEMENT un objet JSON avec:
- "category": catégorie courte (ex: "Article", "Documentation", "Recette", "Actualité", "Référence"). Réutilise une catégorie existante si pertinent.
- "tags": 2 à 6 mots-clés courts en minuscules.
- "summary": un résumé en français de 2 à 4 phrases qui capture l'essentiel de la page.
Ne retourne rien d'autre que le JSON.`;

function isPrivateAddress(address, family) {
  if (family === 4) {
    const p = address.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0
      || (p[0] === 169 && p[1] === 254)
      || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
      || (p[0] === 192 && p[1] === 168);
  }
  const a = address.toLowerCase();
  return a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80');
}

// Empêche le serveur de faire des requêtes vers le réseau interne/local (SSRF) quand
// on va chercher le contenu d'une page web partagée par l'utilisateur.
async function assertPublicHttpUrl(urlStr) {
  const u = new URL(urlStr);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Protocole non supporté');
  if (['localhost', '169.254.169.254', 'metadata.google.internal'].includes(u.hostname.toLowerCase())) {
    throw new Error('URL interne non autorisée');
  }
  const addresses = await dns.lookup(u.hostname, { all: true });
  if (addresses.some(({ address, family }) => isPrivateAddress(address, family))) {
    throw new Error('URL pointant vers un réseau privé, refusée');
  }
}

async function categorizeWebpage(title, text) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: WEBPAGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Titre: ${title}\n\nContenu:\n${text.slice(0, 12000)}` }],
  });
  const result = extractJson(response.content[0].text);
  return { category: result.category || 'Article', tags: result.tags || [], description: result.summary || '' };
}

export async function ingestWebpage(url, source) {
  const id = insertItem({
    filename: url, filepath: '', mimetype: null, size: 0, source, contentType: 'webpage', sourceUrl: url,
  });

  (async () => {
    await assertPublicHttpUrl(url);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BibliothequePersonnelle/1.0)' } });
    if (!res.ok) throw new Error(`Page inaccessible (HTTP ${res.status})`);
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const title = article?.title || url;
    const text = (article?.textContent || '').trim();
    if (!text) throw new Error('Contenu de la page non extractible');
    const result = await categorizeWebpage(title, text);
    updateItemCategorization(id, { ...result, ocrText: '', filename: title });
  })().catch((err) => failItem(id, err));

  return id;
}

// --- Notes / texte collé ----------------------------------------------------

async function categorizeNote(text) {
  const isLong = text.length >= NOTE_SUMMARY_THRESHOLD;
  const anthropic = getClient();
  const system = `Tu organises une bibliothèque personnelle de notes. On te donne un texte collé par l'utilisateur.
Retourne UNIQUEMENT un objet JSON avec:
- "category": catégorie courte (ex: "Note", "Idée", "Extrait d'article", "Citation", "Liste"). Réutilise une catégorie existante si pertinent.
- "tags": 2 à 6 mots-clés courts en minuscules.${isLong ? '\n- "summary": un résumé en français de 2 à 4 phrases du texte.' : ''}
Ne retourne rien d'autre que le JSON.`;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: text.slice(0, 12000) }],
  });
  const result = extractJson(response.content[0].text);
  return {
    category: result.category || 'Note',
    tags: result.tags || [],
    description: isLong ? (result.summary || '') : '',
  };
}

export async function ingestNote(text, source, titleHint = null) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Texte vide');

  const id = insertItem({
    filename: titleHint?.trim() || trimmed.slice(0, 60) || 'Note',
    filepath: '', mimetype: null, size: 0, source, contentType: 'note', sourceUrl: null,
  });

  categorizeNote(trimmed)
    .then((result) => updateItemCategorization(id, { ...result, ocrText: trimmed }))
    .catch((err) => failItem(id, err, { ocrText: trimmed }));

  return id;
}
