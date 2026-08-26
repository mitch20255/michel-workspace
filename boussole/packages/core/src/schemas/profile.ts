import { z } from 'zod';
import { CurrencySchema, LocationSchema, RemotePolicySchema, SenioritySchema } from './common.js';

/**
 * Profil candidat structuré.
 *
 * Principe cardinal : **tout ce qui apparaît dans un document généré doit
 * exister ici.** La forge documentaire n'a pas le droit d'inventer un fait
 * absent du profil ; elle peut seulement reformuler ce qui s'y trouve.
 * Voir `documents/guardrails.ts`.
 */

export const SkillLevelSchema = z.enum(['notions', 'intermediate', 'advanced', 'expert']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const SkillSchema = z.object({
  name: z.string().min(1),
  level: SkillLevelSchema.optional(),
  /** Années d'usage réel, telles que déclarées par le candidat. Jamais déduites. */
  yearsOfExperience: z.number().min(0).max(60).optional(),
  category: z.string().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ExperienceSchema = z.object({
  id: z.string(),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}$/, 'Format AAAA-MM attendu'),
  /** `null` = poste en cours. */
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .default(null),
  summary: z.string().optional(),
  /**
   * Réalisations factuelles. Ce sont les seules phrases que la forge
   * documentaire a le droit de reformuler. Chaque puce doit rester vraie
   * après reformulation.
   */
  bullets: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  /** Chiffres vérifiables (ex. « équipe de 8 », « -30 % de latence »). */
  metrics: z.array(z.string()).default([]),
});
export type Experience = z.infer<typeof ExperienceSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .default(null),
});
export type Project = z.infer<typeof ProjectSchema>;

export const EducationSchema = z.object({
  id: z.string(),
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .default(null),
  /** `false` si le programme n'a pas été mené à terme. Ne jamais l'omettre. */
  completed: z.boolean().default(true),
  notes: z.string().optional(),
});
export type Education = z.infer<typeof EducationSchema>;

export const CertificationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  issuer: z.string().optional(),
  issuedAt: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .default(null),
  credentialId: z.string().optional(),
  url: z.string().optional(),
});
export type Certification = z.infer<typeof CertificationSchema>;

export const LanguageProficiencySchema = z.object({
  language: z.string().min(1),
  /** Échelle CECR, comprise des recruteurs francophones comme anglophones. */
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']),
});
export type LanguageProficiency = z.infer<typeof LanguageProficiencySchema>;

export const LinkSchema = z.object({
  label: z.string().min(1),
  url: z.string(),
});
export type Link = z.infer<typeof LinkSchema>;

// --- Préférences ---------------------------------------------------------

export const SalaryExpectationSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative().optional(),
  currency: CurrencySchema,
  period: z.enum(['hour', 'year']).default('year'),
  /** Si false, le champ « prétentions salariales » reste `needs_input`. */
  shareWithEmployers: z.boolean().default(false),
});
export type SalaryExpectation = z.infer<typeof SalaryExpectationSchema>;

export const WorkPreferencesSchema = z.object({
  targetTitles: z.array(z.string()).default([]),
  excludedTitles: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
  excludedCompanies: z.array(z.string()).default([]),
  remotePolicies: z.array(RemotePolicySchema).default(['remote', 'hybrid', 'onsite']),
  locations: z.array(LocationSchema).default([]),
  /** Rayon acceptable autour des localisations, en kilomètres. */
  maxCommuteKm: z.number().nonnegative().optional(),
  willingToRelocate: z.boolean().default(false),
  seniorityTargets: z.array(SenioritySchema).default([]),
  employmentTypes: z.array(z.string()).default([]),
  salaryExpectation: SalaryExpectationSchema.optional(),
  /** Contraintes libres (ex. « pas de garde de nuit », « max 20 % de voyage »). */
  constraints: z.array(z.string()).default([]),
  earliestStartDate: z.string().optional(),
});
export type WorkPreferences = z.infer<typeof WorkPreferencesSchema>;

// --- Champs sensibles ----------------------------------------------------

/**
 * Questions dont une mauvaise réponse a des conséquences légales ou
 * discriminatoires. Trois états seulement, jamais de valeur devinée :
 *
 * - `answered`  : le candidat a fourni la réponse exacte, réutilisable telle quelle.
 * - `needs_input`: pas de réponse enregistrée → l'assistant s'arrête et demande.
 * - `declined`  : le candidat refuse de répondre → ne jamais pré-remplir.
 */
export const SensitiveAnswerStateSchema = z.enum(['answered', 'needs_input', 'declined']);
export type SensitiveAnswerState = z.infer<typeof SensitiveAnswerStateSchema>;

export const SENSITIVE_FIELDS = [
  'work_authorization',
  'visa_sponsorship_needed',
  'disability_status',
  'gender',
  'ethnicity',
  'veteran_status',
  'eeo_other',
  'salary_expectation',
  'availability',
  'exact_location',
  'years_of_experience',
  'criminal_record',
  'legal_consent',
  'reference_contacts',
  'current_salary',
  'date_of_birth',
] as const;

export const SensitiveFieldKeySchema = z.enum(SENSITIVE_FIELDS);
export type SensitiveFieldKey = z.infer<typeof SensitiveFieldKeySchema>;

export const SensitiveAnswerSchema = z.object({
  key: SensitiveFieldKeySchema,
  state: SensitiveAnswerStateSchema,
  /** Présent uniquement si `state === 'answered'`. Chiffré au repos. */
  value: z.string().optional(),
  note: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type SensitiveAnswer = z.infer<typeof SensitiveAnswerSchema>;

/** Réponses réutilisables aux questions banales des formulaires ATS. */
export const CannedAnswerSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
export type CannedAnswer = z.infer<typeof CannedAnswerSchema>;

// --- Identité ------------------------------------------------------------

export const IdentitySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  headline: z.string().optional(),
  summary: z.string().optional(),
  pronouns: z.string().optional(),
});
export type Identity = z.infer<typeof IdentitySchema>;

/** Coordonnées : PII stricte. Chiffrées au repos, masquées dans les logs. */
export const ContactSchema = z.object({
  email: z.email(),
  phone: z.string().optional(),
  /** Ville/région affichée sur le CV — volontairement approximative. */
  publicLocation: z.string().optional(),
  address: z.string().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

// --- Profil complet ------------------------------------------------------

export const CandidateProfileSchema = z.object({
  id: z.string(),
  label: z.string().default('Profil principal'),
  locale: z.enum(['fr-CA', 'fr-FR', 'en-CA', 'en-US']).default('fr-CA'),

  identity: IdentitySchema,
  contact: ContactSchema,
  location: LocationSchema.optional(),

  experiences: z.array(ExperienceSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  languages: z.array(LanguageProficiencySchema).default([]),
  links: z.array(LinkSchema).default([]),

  // `prefault` et non `default` : la valeur par défaut traverse la validation,
  // ce qui applique en cascade les défauts internes de WorkPreferencesSchema.
  preferences: WorkPreferencesSchema.prefault({}),
  sensitiveAnswers: z.array(SensitiveAnswerSchema).default([]),
  cannedAnswers: z.array(CannedAnswerSchema).default([]),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

/**
 * Lit une réponse sensible sans jamais deviner.
 * Retourne `needs_input` si la clé est absente — état par défaut voulu.
 */
export function readSensitiveAnswer(
  profile: Pick<CandidateProfile, 'sensitiveAnswers'>,
  key: SensitiveFieldKey,
): SensitiveAnswer {
  const found = profile.sensitiveAnswers.find((a) => a.key === key);
  if (!found) return { key, state: 'needs_input' };
  // Un état « answered » sans valeur est incohérent : on retombe sur needs_input
  // plutôt que de laisser passer une chaîne vide dans un formulaire.
  if (found.state === 'answered' && !found.value?.trim()) {
    return { key, state: 'needs_input', note: found.note };
  }
  return found;
}
