import { z } from 'zod';

/**
 * Vocabulaire partagé par tout le domaine.
 *
 * Règle : toute valeur qui traverse une frontière (API, base, connecteur, LLM)
 * passe par un schéma Zod. On ne fait jamais confiance à une source externe.
 */

// --- Identifiants --------------------------------------------------------

export const IdSchema = z.string().min(1).max(64);
export type Id = z.infer<typeof IdSchema>;

export const IsoDateTimeSchema = z.iso.datetime({ offset: true }).or(z.iso.datetime());
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

// --- Sources d'offres ----------------------------------------------------

export const AtsProviderSchema = z.enum([
  'greenhouse',
  'lever',
  'ashby',
  'personio',
  'workday',
  'manual',
  'unknown',
]);
export type AtsProvider = z.infer<typeof AtsProviderSchema>;

/**
 * `source` décrit *comment* l'offre est entrée dans le système, `ats_provider`
 * décrit *quel logiciel* héberge la candidature. Les deux diffèrent souvent :
 * une offre saisie à la main peut pointer vers un formulaire Greenhouse.
 */
export const JobSourceSchema = z.enum(['connector', 'manual', 'import']);
export type JobSource = z.infer<typeof JobSourceSchema>;

// --- Caractéristiques de poste ------------------------------------------

export const RemotePolicySchema = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
export type RemotePolicy = z.infer<typeof RemotePolicySchema>;

export const EmploymentTypeSchema = z.enum([
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
  'freelance',
  'unknown',
]);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

/**
 * Échelle ordonnée : l'ordre du tableau est significatif, le scoring compare
 * les index. Ne jamais réordonner sans adapter `seniorityDistance`.
 */
export const SENIORITY_LADDER = [
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'lead',
  'manager',
  'director',
  'executive',
] as const;

export const SenioritySchema = z.enum([...SENIORITY_LADDER, 'unknown']);
export type Seniority = z.infer<typeof SenioritySchema>;

export const SalaryPeriodSchema = z.enum(['hour', 'day', 'week', 'month', 'year']);
export type SalaryPeriod = z.infer<typeof SalaryPeriodSchema>;

export const CurrencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Code ISO 4217 attendu (ex. CAD, USD, EUR)');
export type Currency = z.infer<typeof CurrencySchema>;

export const JobStatusSchema = z.enum(['active', 'inactive', 'expired', 'unknown']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// --- Localisation --------------------------------------------------------

export const LocationSchema = z.object({
  /** Ville telle que normalisée, sans accent parasite. Ex. "Montréal". */
  city: z.string().optional(),
  /** Région/province/état. Ex. "Québec", "Ontario", "CA-QC". */
  region: z.string().optional(),
  /** Code pays ISO 3166-1 alpha-2. Ex. "CA". */
  country: z.string().length(2).optional(),
  /** Chaîne d'origine, conservée telle quelle pour l'audit. */
  raw: z.string(),
});
export type Location = z.infer<typeof LocationSchema>;

// --- Confiance -----------------------------------------------------------

/**
 * Toute valeur *inférée* (salaire deviné, séniorité déduite, localisation
 * parsée) porte un niveau de confiance. L'interface doit distinguer
 * visuellement « extrait de la source » de « deviné par Boussole ».
 */
export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ProvenanceSchema = z.enum(['source', 'inferred', 'user']);
export type Provenance = z.infer<typeof ProvenanceSchema>;
