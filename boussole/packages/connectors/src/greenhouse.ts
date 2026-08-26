import { z } from 'zod';
import { decodeHtmlEntities, type RawJob } from '@boussole/core';
import { fetchWithPolicy } from './http.js';
import type { Connector, ConnectorContext, ConnectorResult } from './types.js';

/**
 * Connecteur Greenhouse — API publique des tableaux d'offres.
 *
 * Endpoint : https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 * Sans authentification, documenté et destiné à cet usage.
 *
 * Particularité : le champ `content` est du HTML **encodé en entités**
 * (`&lt;p&gt;`). Le décoder avant toute conversion est indispensable, sinon
 * l'intégralité de la description arrive comme un seul bloc de texte contenant
 * des balises littérales, et le découpage en sections échoue.
 */

const GreenhouseJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  updated_at: z.string().optional(),
  absolute_url: z.string().optional(),
  content: z.string().optional(),
  requisition_id: z.string().nullish(),
  location: z.object({ name: z.string() }).nullish(),
  offices: z.array(z.object({ name: z.string().nullish() })).optional(),
  departments: z.array(z.object({ name: z.string().nullish() })).optional(),
  company_name: z.string().nullish(),
  first_published: z.string().nullish(),
});

const GreenhouseResponseSchema = z.object({
  jobs: z.array(z.unknown()).default([]),
});

export const greenhouseConnector: Connector = {
  id: 'greenhouse',
  label: 'Greenhouse',
  boardHint:
    "Jeton du tableau d'offres, visible dans l'URL : boards.greenhouse.io/<jeton> ou job-boards.greenhouse.io/<jeton>",
  apiDocsUrl: 'https://developers.greenhouse.io/job-board.html',

  async fetchJobs(boardToken: string, context: ConnectorContext): Promise<ConnectorResult> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      boardToken,
    )}/jobs?content=true`;

    const payload = await fetchWithPolicy<unknown>(url, context, {
      provider: 'greenhouse',
      boardToken,
    });

    const parsed = GreenhouseResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        jobs: [],
        warnings: ['Réponse Greenhouse inattendue : aucune liste « jobs ».'],
        fetched: 0,
      };
    }

    const warnings: string[] = [];
    const jobs: RawJob[] = [];

    for (const entry of parsed.data.jobs) {
      const job = GreenhouseJobSchema.safeParse(entry);
      if (!job.success) {
        // Une offre malformée ne doit pas faire échouer toute l'ingestion :
        // on la signale et on continue.
        warnings.push('Offre Greenhouse ignorée : structure inattendue.');
        continue;
      }

      const data = job.data;
      const locationRaw =
        data.location?.name ??
        data.offices
          ?.map((o) => o.name)
          .filter((name): name is string => Boolean(name))
          .join('; ');

      jobs.push({
        source: 'connector',
        atsProvider: 'greenhouse',
        sourceJobId: String(data.id),
        companyName: data.company_name ?? boardToken,
        title: data.title,
        department: data.departments?.[0]?.name ?? undefined,
        locationRaw: locationRaw || undefined,
        descriptionRaw: data.content ? decodeHtmlEntities(data.content) : '',
        applyUrl: data.absolute_url,
        canonicalUrl: data.absolute_url,
        postedAt: toIso(data.first_published ?? data.updated_at),
        updatedAtSource: toIso(data.updated_at),
        rawPayload: entry,
      });
    }

    return { jobs, warnings, fetched: parsed.data.jobs.length };
  },
};

/** Les ATS renvoient des dates de formats variés ; on n'invente rien. */
function toIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
