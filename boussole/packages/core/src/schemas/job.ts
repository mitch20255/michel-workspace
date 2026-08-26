import { z } from 'zod';
import {
  AtsProviderSchema,
  ConfidenceSchema,
  CurrencySchema,
  EmploymentTypeSchema,
  IsoDateTimeSchema,
  JobSourceSchema,
  JobStatusSchema,
  LocationSchema,
  RemotePolicySchema,
  SalaryPeriodSchema,
  SenioritySchema,
} from './common.js';

/**
 * Schéma commun d'offre.
 *
 * Écarts assumés par rapport au schéma proposé initialement, et pourquoi :
 *
 * 1. `source` ET `atsProvider` — comment l'offre est entrée vs quel logiciel
 *    héberge le formulaire. Confondre les deux rend la déduplication fausse
 *    dès qu'une offre est saisie à la main.
 * 2. `salaryConfidence` / `seniorityConfidence` / `remoteConfidence` — un
 *    salaire lu dans un champ structuré et un salaire deviné dans un
 *    paragraphe ne valent pas la même chose. Sans ce marqueur, le scoring
 *    ment et l'interface ne peut pas être honnête.
 * 3. `language` — indispensable au marché québécois : une offre en anglais
 *    exige un CV en anglais. Le champ pilote la forge documentaire.
 * 4. `contentHash` + `identityKey` — deux empreintes distinctes. `contentHash`
 *    détecte qu'une offre a *changé* ; `identityKey` détecte que deux offres
 *    sont *la même*. Une seule empreinte ne peut pas faire les deux.
 * 5. `seenCount` / `repostCount` / `lastChangedAt` — le ghost scoring est
 *    inutile sans historique. Ces compteurs sont sa matière première.
 * 6. `rawPayload` — snapshot brut de la source. Permet de re-parser sans
 *    re-télécharger quand un parseur s'améliore, et sert de preuve d'audit.
 * 7. `descriptionText` est dérivé de `descriptionRaw`, jamais l'inverse : le
 *    HTML original reste la vérité.
 */

export const SalarySchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  currency: CurrencySchema.optional(),
  period: SalaryPeriodSchema.optional(),
  confidence: ConfidenceSchema.default('low'),
  /** Extrait littéral d'où provient l'estimation, pour vérification humaine. */
  evidence: z.string().max(400).optional(),
});
export type Salary = z.infer<typeof SalarySchema>;

export const JobSectionsSchema = z.object({
  requirements: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
});
export type JobSections = z.infer<typeof JobSectionsSchema>;

export const GhostSignalSchema = z.object({
  code: z.string(),
  label: z.string(),
  /** Contribution au score, en points (positif = plus suspect). */
  weight: z.number(),
  detail: z.string().optional(),
});
export type GhostSignal = z.infer<typeof GhostSignalSchema>;

/**
 * Ce qu'un connecteur produit. Volontairement permissif : les ATS renvoient
 * des données incomplètes et incohérentes, c'est la normalisation qui range.
 */
export const RawJobSchema = z.object({
  source: JobSourceSchema.default('connector'),
  atsProvider: AtsProviderSchema.default('unknown'),
  sourceJobId: z.string().min(1),
  companyName: z.string().min(1),
  companyDomain: z.string().optional(),
  title: z.string().min(1),
  department: z.string().optional(),
  locationRaw: z.string().optional(),
  employmentTypeRaw: z.string().optional(),
  descriptionRaw: z.string().default(''),
  applyUrl: z.string().optional(),
  canonicalUrl: z.string().optional(),
  postedAt: IsoDateTimeSchema.optional(),
  updatedAtSource: IsoDateTimeSchema.optional(),
  /** Champs salariaux quand la source les expose de façon structurée. */
  salary: SalarySchema.partial().optional(),
  /** Snapshot brut, conservé pour audit et re-parsing. */
  rawPayload: z.unknown().optional(),
});
export type RawJob = z.infer<typeof RawJobSchema>;

/**
 * Forme **avant** validation : les champs à valeur par défaut y sont
 * facultatifs. C'est ce que fournit un appelant (connecteur, saisie manuelle,
 * script d'amorçage) ; `RawJob` est ce qui en ressort une fois validé.
 * Les confondre oblige chaque appelant à répéter les valeurs par défaut.
 */
export type RawJobInput = z.input<typeof RawJobSchema>;

/** Offre normalisée : la forme canonique manipulée par tout le reste du système. */
export const NormalizedJobSchema = z.object({
  source: JobSourceSchema,
  atsProvider: AtsProviderSchema,
  sourceJobId: z.string(),

  companyName: z.string(),
  companyNameNormalized: z.string(),
  companyDomain: z.string().optional(),

  title: z.string(),
  titleNormalized: z.string(),
  department: z.string().optional(),

  locationRaw: z.string().optional(),
  locations: z.array(LocationSchema).default([]),
  remotePolicy: RemotePolicySchema.default('unknown'),
  remoteConfidence: ConfidenceSchema.default('low'),

  employmentType: EmploymentTypeSchema.default('unknown'),
  seniority: SenioritySchema.default('unknown'),
  seniorityConfidence: ConfidenceSchema.default('low'),

  salary: SalarySchema.optional(),

  language: z.enum(['fr', 'en', 'unknown']).default('unknown'),

  descriptionRaw: z.string().default(''),
  descriptionText: z.string().default(''),
  sections: JobSectionsSchema.default({ requirements: [], responsibilities: [], benefits: [] }),
  skills: z.array(z.string()).default([]),

  applyUrl: z.string().optional(),
  canonicalUrl: z.string().optional(),

  postedAt: IsoDateTimeSchema.optional(),
  firstSeenAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema,
  lastChangedAt: IsoDateTimeSchema.optional(),
  expiresAt: IsoDateTimeSchema.optional(),

  seenCount: z.number().int().nonnegative().default(1),
  repostCount: z.number().int().nonnegative().default(0),

  status: JobStatusSchema.default('active'),

  /** Empreinte du contenu : change dès que la description change. */
  contentHash: z.string(),
  /** Empreinte d'identité : stable entre republications de la même offre. */
  identityKey: z.string(),
  duplicateGroupId: z.string().optional(),

  ghostScore: z.number().min(0).max(100).default(0),
  ghostSignals: z.array(GhostSignalSchema).default([]),

  rawPayload: z.unknown().optional(),
});
export type NormalizedJob = z.infer<typeof NormalizedJobSchema>;
