import {
  CandidateProfileSchema,
  NormalizedJobSchema,
  type CandidateProfile,
  type NormalizedJob,
} from '@boussole/core';
import type {
  CandidateProfile as ProfileRow,
  Job as JobRow,
  SensitiveAnswer,
} from '../generated/client/index.js';

/**
 * Conversion entre lignes Prisma et types du domaine.
 *
 * Pourquoi une couche explicite plutôt que d'exposer les types Prisma partout :
 *
 *  - Prisma représente les colonnes `Json` par `unknown`/`JsonValue`. Les
 *    passer tels quels au reste du code ferait perdre tout typage utile.
 *  - Les dates sont des `Date` en base et des chaînes ISO dans le domaine
 *    (sérialisables, comparables, stables en JSON). La conversion doit se
 *    faire à un seul endroit.
 *  - Chaque lecture repasse par le schéma Zod : une ligne corrompue ou
 *    écrite par une version antérieure échoue ici, avec un message clair,
 *    plutôt que de se propager silencieusement dans le scoring.
 */

function toIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

// --- Offres ---------------------------------------------------------------

export function jobRowToDomain(row: JobRow): NormalizedJob {
  const salary =
    row.salaryMin !== null || row.salaryMax !== null
      ? {
          min: row.salaryMin ?? undefined,
          max: row.salaryMax ?? undefined,
          currency: row.salaryCurrency ?? undefined,
          period: row.salaryPeriod ?? undefined,
          confidence: row.salaryConfidence,
          evidence: row.salaryEvidence ?? undefined,
        }
      : undefined;

  return NormalizedJobSchema.parse({
    source: row.source,
    atsProvider: row.atsProvider,
    sourceJobId: row.sourceJobId,
    companyName: row.companyName,
    companyNameNormalized: row.companyNameNormalized,
    companyDomain: row.companyDomain ?? undefined,
    title: row.title,
    titleNormalized: row.titleNormalized,
    department: row.department ?? undefined,
    locationRaw: row.locationRaw ?? undefined,
    locations: row.locations,
    remotePolicy: row.remotePolicy,
    remoteConfidence: row.remoteConfidence,
    employmentType: row.employmentType,
    seniority: row.seniority,
    seniorityConfidence: row.seniorityConfidence,
    salary,
    language: row.language,
    descriptionRaw: row.descriptionRaw,
    descriptionText: row.descriptionText,
    sections: row.sections,
    skills: row.skills,
    applyUrl: row.applyUrl ?? undefined,
    canonicalUrl: row.canonicalUrl ?? undefined,
    postedAt: toIso(row.postedAt),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    lastChangedAt: toIso(row.lastChangedAt),
    expiresAt: toIso(row.expiresAt),
    seenCount: row.seenCount,
    repostCount: row.repostCount,
    status: row.status,
    contentHash: row.contentHash,
    identityKey: row.identityKey,
    duplicateGroupId: row.duplicateGroupId ?? undefined,
    ghostScore: row.ghostScore,
    ghostSignals: row.ghostSignals,
    rawPayload: row.rawPayload ?? undefined,
  });
}

/** Champs à écrire pour une offre. Les colonnes de salaire sont aplaties. */
export function jobToRow(job: NormalizedJob) {
  return {
    source: job.source,
    atsProvider: job.atsProvider,
    sourceJobId: job.sourceJobId,
    companyName: job.companyName,
    companyNameNormalized: job.companyNameNormalized,
    companyDomain: job.companyDomain ?? null,
    title: job.title,
    titleNormalized: job.titleNormalized,
    department: job.department ?? null,
    locationRaw: job.locationRaw ?? null,
    locations: job.locations,
    remotePolicy: job.remotePolicy,
    remoteConfidence: job.remoteConfidence,
    employmentType: job.employmentType,
    seniority: job.seniority,
    seniorityConfidence: job.seniorityConfidence,
    salaryMin: job.salary?.min ?? null,
    salaryMax: job.salary?.max ?? null,
    salaryCurrency: job.salary?.currency ?? null,
    salaryPeriod: job.salary?.period ?? null,
    salaryConfidence: job.salary?.confidence ?? 'low',
    salaryEvidence: job.salary?.evidence ?? null,
    language: job.language,
    descriptionRaw: job.descriptionRaw,
    descriptionText: job.descriptionText,
    sections: job.sections,
    skills: job.skills,
    applyUrl: job.applyUrl ?? null,
    canonicalUrl: job.canonicalUrl ?? null,
    postedAt: job.postedAt ? new Date(job.postedAt) : null,
    firstSeenAt: new Date(job.firstSeenAt),
    lastSeenAt: new Date(job.lastSeenAt),
    lastChangedAt: job.lastChangedAt ? new Date(job.lastChangedAt) : null,
    expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
    seenCount: job.seenCount,
    repostCount: job.repostCount,
    status: job.status,
    contentHash: job.contentHash,
    identityKey: job.identityKey,
    ghostScore: job.ghostScore,
    ghostSignals: job.ghostSignals,
    // `undefined` supprimerait la valeur existante lors d'une mise à jour ;
    // Prisma attend `null` (JSON null) pour l'effacer explicitement.
    rawPayload: (job.rawPayload ?? null) as never,
  };
}

// --- Profil ---------------------------------------------------------------

export function profileRowToDomain(
  row: ProfileRow & { sensitiveAnswers?: SensitiveAnswer[] },
): CandidateProfile {
  return CandidateProfileSchema.parse({
    id: row.id,
    label: row.label,
    locale: row.locale,
    identity: {
      firstName: row.firstName,
      lastName: row.lastName,
      headline: row.headline ?? undefined,
      summary: row.summary ?? undefined,
      pronouns: row.pronouns ?? undefined,
    },
    contact: {
      email: row.email,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      publicLocation: row.publicLocation ?? undefined,
    },
    location:
      row.city || row.region || row.country
        ? {
            city: row.city ?? undefined,
            region: row.region ?? undefined,
            country: row.country ?? undefined,
            raw: [row.city, row.region, row.country].filter(Boolean).join(', '),
          }
        : undefined,
    experiences: row.experiences,
    projects: row.projects,
    education: row.education,
    certifications: row.certifications,
    skills: row.skills,
    languages: row.languages,
    links: row.links,
    preferences: row.preferences,
    cannedAnswers: row.cannedAnswers,
    sensitiveAnswers: (row.sensitiveAnswers ?? []).map((answer) => ({
      key: answer.key,
      state: answer.state,
      value: answer.value ?? undefined,
      note: answer.note ?? undefined,
      updatedAt: answer.updatedAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/**
 * Champs scalaires du profil. Les réponses sensibles vivent dans leur propre
 * table et sont écrites séparément — elles ont un cycle de vie distinct
 * (chiffrement, audit de chaque modification).
 */
export function profileToRow(profile: CandidateProfile) {
  return {
    label: profile.label,
    locale: profile.locale,
    firstName: profile.identity.firstName,
    lastName: profile.identity.lastName,
    headline: profile.identity.headline ?? null,
    summary: profile.identity.summary ?? null,
    pronouns: profile.identity.pronouns ?? null,
    email: profile.contact.email,
    phone: profile.contact.phone ?? null,
    address: profile.contact.address ?? null,
    publicLocation: profile.contact.publicLocation ?? null,
    city: profile.location?.city ?? null,
    region: profile.location?.region ?? null,
    country: profile.location?.country ?? null,
    experiences: profile.experiences,
    projects: profile.projects,
    education: profile.education,
    certifications: profile.certifications,
    skills: profile.skills,
    languages: profile.languages,
    links: profile.links,
    preferences: profile.preferences,
    cannedAnswers: profile.cannedAnswers,
  };
}
