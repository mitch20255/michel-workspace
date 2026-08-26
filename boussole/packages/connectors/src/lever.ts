import { z } from 'zod';
import type { RawJob } from '@boussole/core';
import { fetchWithPolicy } from './http.js';
import type { Connector, ConnectorContext, ConnectorResult } from './types.js';

/**
 * Connecteur Lever — API publique des offres.
 *
 * Endpoint : https://api.lever.co/v0/postings/{compagnie}?mode=json
 *
 * Particularité : la description est éclatée en trois morceaux
 * (`description`, `lists`, `additional`). Ne lire que `description` fait
 * perdre les exigences, qui vivent presque toujours dans `lists`. On
 * reconstitue donc un document HTML complet, dans l'ordre d'affichage.
 *
 * Lever expose aussi `salaryRange` de façon structurée : on le prend tel quel
 * plutôt que de le redeviner dans le texte.
 */

const LeverSalarySchema = z.object({
  min: z.number().nullish(),
  max: z.number().nullish(),
  currency: z.string().nullish(),
  interval: z.string().nullish(),
});

const LeverPostingSchema = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string().nullish(),
  applyUrl: z.string().nullish(),
  createdAt: z.number().nullish(),
  workplaceType: z.string().nullish(),
  description: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  additional: z.string().nullish(),
  lists: z.array(z.object({ text: z.string().nullish(), content: z.string().nullish() })).nullish(),
  categories: z
    .object({
      commitment: z.string().nullish(),
      department: z.string().nullish(),
      location: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
      team: z.string().nullish(),
    })
    .nullish(),
  salaryRange: LeverSalarySchema.nullish(),
});

/** Correspondance des intervalles Lever vers notre vocabulaire de période. */
const INTERVAL_MAP: Record<string, 'hour' | 'day' | 'week' | 'month' | 'year'> = {
  'per-year-salary': 'year',
  'per-month-salary': 'month',
  'per-week-salary': 'week',
  'per-day-salary': 'day',
  'per-hour-wage': 'hour',
};

export const leverConnector: Connector = {
  id: 'lever',
  label: 'Lever',
  boardHint: "Identifiant de compagnie, visible dans l'URL : jobs.lever.co/<compagnie>",
  apiDocsUrl: 'https://github.com/lever/postings-api',

  async fetchJobs(boardToken: string, context: ConnectorContext): Promise<ConnectorResult> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}?mode=json`;

    const payload = await fetchWithPolicy<unknown>(url, context, {
      provider: 'lever',
      boardToken,
    });

    if (!Array.isArray(payload)) {
      return {
        jobs: [],
        warnings: ['Réponse Lever inattendue : un tableau était attendu.'],
        fetched: 0,
      };
    }

    const warnings: string[] = [];
    const jobs: RawJob[] = [];

    for (const entry of payload) {
      const posting = LeverPostingSchema.safeParse(entry);
      if (!posting.success) {
        warnings.push('Offre Lever ignorée : structure inattendue.');
        continue;
      }

      const data = posting.data;
      const locations = data.categories?.allLocations?.length
        ? data.categories.allLocations.join('; ')
        : (data.categories?.location ?? undefined);

      jobs.push({
        source: 'connector',
        atsProvider: 'lever',
        sourceJobId: data.id,
        companyName: boardToken,
        title: data.text,
        department: data.categories?.department ?? data.categories?.team ?? undefined,
        locationRaw: locations,
        employmentTypeRaw: data.categories?.commitment ?? undefined,
        descriptionRaw: assembleDescription(data),
        applyUrl: data.applyUrl ?? data.hostedUrl ?? undefined,
        canonicalUrl: data.hostedUrl ?? undefined,
        postedAt: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
        salary: toSalary(data.salaryRange),
        rawPayload: entry,
      });
    }

    return { jobs, warnings, fetched: payload.length };
  },
};

/**
 * Reconstitue la description complète dans l'ordre d'affichage de Lever :
 * introduction, puis chaque liste avec son titre, puis le complément.
 * Les titres de listes (« Requirements », « What you'll do ») sont émis
 * comme des `<h3>` pour que le découpage en sections les reconnaisse.
 */
function assembleDescription(posting: z.infer<typeof LeverPostingSchema>): string {
  const parts: string[] = [];

  if (posting.description) parts.push(posting.description);

  for (const list of posting.lists ?? []) {
    if (list.text) parts.push(`<h3>${list.text}</h3>`);
    if (list.content) parts.push(`<ul>${list.content}</ul>`);
  }

  if (posting.additional) parts.push(posting.additional);

  // Repli sur la version texte si l'API n'a renvoyé aucun bloc HTML.
  if (parts.length === 0 && posting.descriptionPlain) return posting.descriptionPlain;

  return parts.join('\n');
}

function toSalary(range: z.infer<typeof LeverSalarySchema> | null | undefined): RawJob['salary'] {
  if (!range?.min && !range?.max) return undefined;
  const currency = range.currency?.toUpperCase();
  return {
    min: range.min ?? undefined,
    max: range.max ?? undefined,
    // Une devise non conforme à ISO 4217 est écartée plutôt que corrigée.
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
    period: range.interval ? INTERVAL_MAP[range.interval] : undefined,
    // Donnée structurée déclarée par l'employeur : confiance maximale.
    confidence: 'high',
  };
}
