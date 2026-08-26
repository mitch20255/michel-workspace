import type { NormalizedJob, RawJob } from '../schemas/job.js';
import { NormalizedJobSchema, RawJobSchema } from '../schemas/job.js';
import { normalizeCompanyName, normalizeJobTitle } from '../text/normalize.js';
import { detectLanguage } from '../text/tokens.js';
import { toPlainText } from '../text/html.js';
import { contentHash, identityKey } from './fingerprint.js';
import { detectRemotePolicy, parseLocations } from './location.js';
import { parseSalary } from './salary.js';
import { detectEmploymentType, detectSeniority } from './seniority.js';
import { extractSections } from './sections.js';
import { extractSkills } from '../matching/skills.js';
import { scoreGhostJob } from '../ghost/score.js';

/**
 * Orchestration de la normalisation : une offre brute d'un connecteur devient
 * une offre canonique.
 *
 * Cette fonction est **pure et déterministe** (hors `now`, injecté). C'est ce
 * qui permet de rejouer la normalisation sur les payloads bruts archivés
 * quand un parseur s'améliore, sans retourner interroger les ATS.
 */

export interface NormalizeOptions {
  /** Horodatage de référence. Injecté pour rendre les tests déterministes. */
  now?: Date;
  /** État précédemment connu de cette offre, s'il existe. */
  previous?: Pick<
    NormalizedJob,
    'firstSeenAt' | 'contentHash' | 'seenCount' | 'repostCount' | 'lastChangedAt' | 'status'
  >;
  /** Nombre d'offres actives de l'entreprise, pour le ghost scoring. */
  companyActiveJobCount?: number;
  companyEmployeeCount?: number;
}

export function normalizeJob(input: RawJob, options: NormalizeOptions = {}): NormalizedJob {
  const raw = RawJobSchema.parse(input);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  const descriptionText = toPlainText(raw.descriptionRaw);
  const sections = extractSections(descriptionText);

  const locations = parseLocations(raw.locationRaw);
  const remote = detectRemotePolicy(descriptionText, raw.locationRaw);

  const seniority = detectSeniority(raw.title, descriptionText);
  const employmentType = detectEmploymentType(raw.employmentTypeRaw, raw.title);

  // Le salaire structuré de la source prime toujours sur l'extraction
  // textuelle : c'est une donnée déclarée, pas une devinette.
  const structuredSalary =
    raw.salary?.min !== undefined || raw.salary?.max !== undefined
      ? { ...raw.salary, confidence: raw.salary.confidence ?? ('high' as const) }
      : undefined;
  const salary =
    structuredSalary ?? parseSalary(descriptionText, { locationHint: raw.locationRaw ?? '' });

  const requirementText = [...sections.requirements, ...sections.responsibilities].join('\n');
  const skills = extractSkills(`${raw.title}\n${descriptionText}`, { requirementText }).map(
    (s) => s.canonical,
  );

  const hash = contentHash({
    title: raw.title,
    companyName: raw.companyName,
    descriptionText,
  });

  const identity = identityKey({
    title: raw.title,
    companyName: raw.companyName,
    primaryLocation: locations[0]?.raw,
    department: raw.department,
  });

  // --- Historique ---------------------------------------------------------
  const previous = options.previous;
  const firstSeenAt = previous?.firstSeenAt ?? nowIso;
  const seenCount = (previous?.seenCount ?? 0) + 1;
  const contentChanged = previous ? previous.contentHash !== hash : false;

  // Une offre qui réapparaît après avoir été marquée inactive est une
  // republication — le signal fantôme le plus fort après le vocabulaire de
  // vivier de candidats.
  const wasInactive = previous?.status === 'inactive' || previous?.status === 'expired';
  const repostCount = (previous?.repostCount ?? 0) + (wasInactive ? 1 : 0);

  const lastChangedAt = contentChanged ? nowIso : previous?.lastChangedAt;

  const ghost = scoreGhostJob({
    firstSeenAt,
    lastSeenAt: nowIso,
    seenCount,
    repostCount,
    descriptionText,
    sections,
    applyUrl: raw.applyUrl,
    canonicalUrl: raw.canonicalUrl,
    hasSalary: Boolean(salary?.min),
    companyActiveJobCount: options.companyActiveJobCount,
    companyEmployeeCount: options.companyEmployeeCount,
    now,
  });

  const normalized: NormalizedJob = {
    source: raw.source,
    atsProvider: raw.atsProvider,
    sourceJobId: raw.sourceJobId,

    companyName: raw.companyName.trim(),
    companyNameNormalized: normalizeCompanyName(raw.companyName),
    companyDomain: raw.companyDomain,

    title: raw.title.trim(),
    titleNormalized: normalizeJobTitle(raw.title),
    department: raw.department,

    locationRaw: raw.locationRaw,
    locations,
    remotePolicy: remote.policy,
    remoteConfidence: remote.confidence,

    employmentType,
    seniority: seniority.seniority,
    seniorityConfidence: seniority.confidence,

    salary: salary as NormalizedJob['salary'],

    language: detectLanguage(descriptionText),

    descriptionRaw: raw.descriptionRaw,
    descriptionText,
    sections,
    skills,

    applyUrl: raw.applyUrl,
    canonicalUrl: raw.canonicalUrl,

    postedAt: raw.postedAt,
    firstSeenAt,
    lastSeenAt: nowIso,
    lastChangedAt,
    seenCount,
    repostCount,

    status: 'active',

    contentHash: hash,
    identityKey: identity,

    ghostScore: ghost.score,
    ghostSignals: ghost.signals,

    rawPayload: raw.rawPayload,
  };

  // Validation de sortie : une régression de normalisation doit échouer ici,
  // pas trois couches plus loin au moment de l'insertion en base.
  return NormalizedJobSchema.parse(normalized);
}

/**
 * Marque comme inactives les offres qui n'ont pas été revues lors de la
 * dernière ingestion d'une source.
 *
 * On ne supprime jamais : une offre disparue reste utile (candidature en
 * cours, historique, détection de republication future).
 */
export function markMissingAsInactive<T extends { sourceJobId: string; status: string }>(
  known: T[],
  seenSourceJobIds: Set<string>,
): Array<T & { status: 'inactive' }> {
  return known
    .filter((job) => job.status === 'active' && !seenSourceJobIds.has(job.sourceJobId))
    .map((job) => ({ ...job, status: 'inactive' as const }));
}
