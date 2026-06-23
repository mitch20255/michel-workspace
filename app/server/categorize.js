import fs from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';

const MODEL = process.env.CATEGORIZE_MODEL || 'claude-sonnet-4-6';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown']);

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquante dans .env — la catégorisation automatique est désactivée.');
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `Tu organises une bibliothèque personnelle de fichiers (screenshots, documents, images).
Pour chaque fichier, retourne UNIQUEMENT un objet JSON avec ces champs:
- "category": une catégorie courte et cohérente (ex: "Screenshot - Conversation", "Document - Facture", "Document - Contrat", "Photo personnelle", "Reçu", "Code / Technique", "Idée / Note", "Référence", "Autre"). Réutilise une catégorie existante si elle convient, sinon crée-en une nouvelle pertinente.
- "tags": liste de 2 à 6 mots-clés courts en minuscules.
- "description": une phrase résumant le contenu, en français.
- "ocr_text": le texte visible dans l'image/document, tel quel (vide si aucun texte significatif).
Ne retourne rien d'autre que le JSON.`;

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse IA non-JSON: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function categorizeImage(filePath, filename) {
  const buffer = await fs.readFile(filePath);
  const sizeMb = buffer.length / (1024 * 1024);
  if (sizeMb > 4.5) {
    throw new Error(`Image trop volumineuse pour la catégorisation IA (${sizeMb.toFixed(1)} Mo, max ~4.5 Mo)`);
  }
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const base64 = buffer.toString('base64');

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `Nom du fichier: ${filename}. Analyse cette image et retourne le JSON demandé.` },
        ],
      },
    ],
  });

  return extractJson(response.content[0].text);
}

async function categorizeText(content, filename) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Nom du fichier: ${filename}\n\nContenu:\n${content.slice(0, 8000)}\n\nRetourne le JSON demandé.`,
      },
    ],
  });
  return extractJson(response.content[0].text);
}

/**
 * Catégorise un fichier et retourne { category, tags, description, ocrText }.
 */
export async function categorizeFile(filePath, mimetype, filename) {
  let result;
  if (IMAGE_TYPES.has(mimetype)) {
    result = await categorizeImage(filePath, filename);
  } else if (mimetype === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    result = await categorizeText(parsed.text || '(PDF sans texte extractible)', filename);
  } else if (TEXT_TYPES.has(mimetype) || filename.match(/\.(txt|md)$/i)) {
    const content = await fs.readFile(filePath, 'utf-8');
    result = await categorizeText(content, filename);
  } else {
    result = await categorizeText('(contenu non extrait — catégorisation basée sur le nom du fichier uniquement)', filename);
  }

  return {
    category: result.category || 'Autre',
    tags: Array.isArray(result.tags) ? result.tags : [],
    description: result.description || '',
    ocrText: result.ocr_text || '',
  };
}
