import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import type { RawJob } from '@boussole/core';
import { fetchWithPolicy } from './http.js';
import type { Connector, ConnectorContext, ConnectorResult } from './types.js';

/**
 * Connecteur Personio — flux XML public.
 *
 * Endpoint : https://{compagnie}.jobs.personio.de/xml
 *
 * Pourquoi une dépendance XML : contrairement aux trois autres ATS, Personio
 * ne publie qu'un flux XML avec des sections CDATA imbriquées. Un parseur
 * maison à base d'expressions régulières casserait sur les CDATA contenant du
 * HTML — c'est-à-dire tous les cas réels. `fast-xml-parser` est petit, sans
 * dépendance transitive, et l'analyse d'entités externes est désactivée
 * ci-dessous.
 *
 * Le flux découpe la description en blocs nommés (`Tâches`, `Profil`,
 * `Avantages`). On les reconstitue en `<h3>` + contenu, pour que le découpage
 * en sections les reconnaisse comme des en-têtes.
 */

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  // Le flux contient du HTML en CDATA : ne pas le réinterpréter comme du XML.
  cdataPropName: '__cdata',
  processEntities: true,
  // Aucune entité personnalisée : évite l'expansion d'entités hostiles.
  htmlEntities: false,
});

const PersonioPositionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  office: z.union([z.string(), z.object({}).passthrough()]).nullish(),
  department: z.union([z.string(), z.object({}).passthrough()]).nullish(),
  subcompany: z.union([z.string(), z.object({}).passthrough()]).nullish(),
  employmentType: z.string().nullish(),
  schedule: z.string().nullish(),
  seniority: z.string().nullish(),
  yearsOfExperience: z.string().nullish(),
  occupation: z.string().nullish(),
  occupationCategory: z.string().nullish(),
  createdAt: z.string().nullish(),
  jobDescriptions: z.unknown().nullish(),
});

export const personioConnector: Connector = {
  id: 'personio',
  label: 'Personio',
  boardHint: "Sous-domaine de l'entreprise : <compagnie>.jobs.personio.de",
  apiDocsUrl: 'https://support.personio.de/hc/en-us/articles/360000froQ',

  async fetchJobs(boardToken: string, context: ConnectorContext): Promise<ConnectorResult> {
    const url = `https://${encodeURIComponent(boardToken)}.jobs.personio.de/xml`;

    const xml = await fetchWithPolicy<string>(url, context, {
      provider: 'personio',
      boardToken,
      as: 'text',
    });

    let document: unknown;
    try {
      document = parser.parse(xml);
    } catch (error) {
      return {
        jobs: [],
        warnings: [`Flux XML Personio illisible : ${(error as Error).message}`],
        fetched: 0,
      };
    }

    const positions = extractPositions(document);
    const warnings: string[] = [];
    const jobs: RawJob[] = [];

    for (const entry of positions) {
      const position = PersonioPositionSchema.safeParse(entry);
      if (!position.success) {
        warnings.push('Offre Personio ignorée : structure inattendue.');
        continue;
      }

      const data = position.data;
      const office = asText(data.office);
      const department = asText(data.department);

      jobs.push({
        source: 'connector',
        atsProvider: 'personio',
        sourceJobId: String(data.id),
        companyName: asText(data.subcompany) || boardToken,
        title: data.name,
        department: department || undefined,
        locationRaw: office || undefined,
        employmentTypeRaw:
          [data.employmentType, data.schedule].filter(Boolean).join(' ') || undefined,
        descriptionRaw: assembleDescription(data.jobDescriptions),
        // Personio ne publie pas d'URL par offre dans le flux ; l'URL du
        // tableau est la seule cible fiable. On ne fabrique pas de lien direct.
        applyUrl: `https://${boardToken}.jobs.personio.de/job/${String(data.id)}`,
        canonicalUrl: `https://${boardToken}.jobs.personio.de/`,
        postedAt: toIso(data.createdAt),
        rawPayload: entry,
      });
    }

    return { jobs, warnings, fetched: positions.length };
  },
};

/** Le flux racine s'appelle `workzag-jobs` (nom historique de Personio). */
function extractPositions(document: unknown): unknown[] {
  if (!document || typeof document !== 'object') return [];
  const root = document as Record<string, unknown>;
  const container = (root['workzag-jobs'] ?? root.jobs ?? root.positions) as
    Record<string, unknown> | undefined;
  if (!container || typeof container !== 'object') return [];

  const positions = container.position;
  if (!positions) return [];
  // fast-xml-parser renvoie un objet unique quand il n'y a qu'une offre.
  return Array.isArray(positions) ? positions : [positions];
}

/**
 * Reconstitue la description à partir des blocs nommés du flux.
 * Chaque bloc devient un `<h3>` suivi de son contenu HTML.
 */
function assembleDescription(jobDescriptions: unknown): string {
  if (!jobDescriptions || typeof jobDescriptions !== 'object') return '';
  const container = jobDescriptions as Record<string, unknown>;
  const raw = container.jobDescription;
  if (!raw) return '';

  const blocks = Array.isArray(raw) ? raw : [raw];
  const parts: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;
    const name = asText(record.name);
    const value = asText(record.value);
    if (name) parts.push(`<h3>${name}</h3>`);
    if (value) parts.push(value);
  }

  return parts.join('\n');
}

/**
 * Normalise une valeur du flux en texte.
 * Une balise XML vide devient `{}` et une CDATA `{ __cdata: '…' }` : les
 * traiter comme des chaînes produirait « [object Object] » dans les offres.
 */
function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const cdata = (value as Record<string, unknown>).__cdata;
    if (typeof cdata === 'string') return cdata.trim();
    if (Array.isArray(cdata))
      return cdata
        .filter((c) => typeof c === 'string')
        .join('')
        .trim();
  }
  return '';
}

function toIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
