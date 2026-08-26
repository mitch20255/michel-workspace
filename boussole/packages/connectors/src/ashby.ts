import { z } from 'zod';
import type { RawJob } from '@boussole/core';
import { fetchWithPolicy } from './http.js';
import type { Connector, ConnectorContext, ConnectorResult } from './types.js';

/**
 * Connecteur Ashby — API publique du tableau d'offres.
 *
 * Endpoint : https://api.ashbyhq.com/posting-api/job-board/{nom}?includeCompensation=true
 *
 * Particularités :
 *  - `isListed: false` marque une offre retirée du tableau public. On
 *    l'ignore : la présenter au candidat l'enverrait vers une page morte.
 *  - `isRemote` est un booléen structuré, plus fiable que la détection
 *    textuelle. On le transmet dans `locationRaw` pour que la normalisation
 *    l'utilise comme signal fort.
 *  - La compensation est renvoyée en composantes (salaire, actions, prime) :
 *    on ne retient que la composante salariale.
 */

const AshbyCompensationTierSchema = z.object({
  id: z.string().nullish(),
  tierSummary: z.string().nullish(),
  title: z.string().nullish(),
  additionalInformation: z.string().nullish(),
  components: z
    .array(
      z.object({
        summary: z.string().nullish(),
        compensationType: z.string().nullish(),
        interval: z.string().nullish(),
        currencyCode: z.string().nullish(),
        minValue: z.number().nullish(),
        maxValue: z.number().nullish(),
      }),
    )
    .nullish(),
});

const AshbyJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  secondaryLocations: z.array(z.object({ location: z.string().nullish() })).nullish(),
  department: z.string().nullish(),
  team: z.string().nullish(),
  isListed: z.boolean().nullish(),
  isRemote: z.boolean().nullish(),
  employmentType: z.string().nullish(),
  publishedAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  jobUrl: z.string().nullish(),
  applyUrl: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  compensation: z
    .object({
      compensationTierSummary: z.string().nullish(),
      scrapeableCompensationSalarySummary: z.string().nullish(),
      compensationTiers: z.array(AshbyCompensationTierSchema).nullish(),
    })
    .nullish(),
});

const AshbyResponseSchema = z.object({
  jobs: z.array(z.unknown()).default([]),
});

const INTERVAL_MAP: Record<string, 'hour' | 'day' | 'week' | 'month' | 'year'> = {
  YEAR: 'year',
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  HOUR: 'hour',
};

export const ashbyConnector: Connector = {
  id: 'ashby',
  label: 'Ashby',
  boardHint: "Nom du tableau d'offres, visible dans l'URL : jobs.ashbyhq.com/<nom>",
  apiDocsUrl: 'https://developers.ashbyhq.com/reference/job-posting-api',

  async fetchJobs(boardToken: string, context: ConnectorContext): Promise<ConnectorResult> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
      boardToken,
    )}?includeCompensation=true`;

    const payload = await fetchWithPolicy<unknown>(url, context, {
      provider: 'ashby',
      boardToken,
    });

    const parsed = AshbyResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        jobs: [],
        warnings: ['Réponse Ashby inattendue : aucune liste « jobs ».'],
        fetched: 0,
      };
    }

    const warnings: string[] = [];
    const jobs: RawJob[] = [];
    let skippedUnlisted = 0;

    for (const entry of parsed.data.jobs) {
      const job = AshbyJobSchema.safeParse(entry);
      if (!job.success) {
        warnings.push('Offre Ashby ignorée : structure inattendue.');
        continue;
      }

      const data = job.data;
      if (data.isListed === false) {
        skippedUnlisted += 1;
        continue;
      }

      const locations = [
        data.location,
        ...(data.secondaryLocations?.map((l) => l.location) ?? []),
      ].filter((value): value is string => Boolean(value));

      // `isRemote` est une donnée structurée : on l'ajoute explicitement au
      // texte de localisation pour que la détection s'appuie dessus.
      const locationRaw = data.isRemote
        ? [...new Set([...locations, 'Remote'])].join('; ')
        : locations.join('; ');

      jobs.push({
        source: 'connector',
        atsProvider: 'ashby',
        sourceJobId: data.id,
        companyName: boardToken,
        title: data.title,
        department: data.department ?? data.team ?? undefined,
        locationRaw: locationRaw || undefined,
        employmentTypeRaw: data.employmentType ?? undefined,
        descriptionRaw: data.descriptionHtml ?? data.descriptionPlain ?? '',
        applyUrl: data.applyUrl ?? data.jobUrl ?? undefined,
        canonicalUrl: data.jobUrl ?? undefined,
        postedAt: toIso(data.publishedAt),
        updatedAtSource: toIso(data.updatedAt),
        salary: extractSalary(data.compensation),
        rawPayload: entry,
      });
    }

    if (skippedUnlisted > 0) {
      warnings.push(`${skippedUnlisted} offre(s) Ashby non publiées ont été ignorées.`);
    }

    return { jobs, warnings, fetched: parsed.data.jobs.length };
  },
};

function extractSalary(
  compensation: z.infer<typeof AshbyJobSchema>['compensation'],
): RawJob['salary'] {
  const components =
    compensation?.compensationTiers?.flatMap((tier) => tier.components ?? []) ?? [];
  // On ne retient que le salaire : additionner actions et primes produirait
  // un chiffre que l'employeur n'a jamais annoncé.
  const salaryComponent = components.find(
    (component) => component.compensationType?.toUpperCase() === 'SALARY',
  );
  if (!salaryComponent) return undefined;
  if (salaryComponent.minValue == null && salaryComponent.maxValue == null) return undefined;

  const currency = salaryComponent.currencyCode?.toUpperCase();
  return {
    min: salaryComponent.minValue ?? undefined,
    max: salaryComponent.maxValue ?? undefined,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
    period: salaryComponent.interval
      ? INTERVAL_MAP[salaryComponent.interval.toUpperCase()]
      : undefined,
    confidence: 'high',
  };
}

function toIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
