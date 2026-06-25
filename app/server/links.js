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

function failItem(id, err) {
  console.error(`[links] Catégorisation échouée pour #${id}:`, err.message);
  updateItemCategorization(id, {
    category: 'Non catégorisé', tags: [], description: '', ocrText: '', status: 'error', error: err.message,
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
    const result = await categorizeYoutube(title, transcript);
    updateItemCategorization(id, { ...result, ocrText: transcript, filename: title || url });
  })().catch((err) => failItem(id, err));

  return id;
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
    .catch((err) => failItem(id, err));

  return id;
}
