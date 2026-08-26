import type { CandidateProfile } from '../schemas/profile.js';
import type { NormalizedJob } from '../schemas/job.js';

/**
 * Minimisation des données envoyées à un fournisseur LLM externe.
 *
 * Constat : pour reformuler une puce de CV ou générer des questions
 * d'entretien, un modèle n'a **aucun** besoin du nom, du courriel, du
 * téléphone, de l'adresse ni des réponses EEO du candidat. Les envoyer serait
 * une fuite gratuite vers un tiers.
 *
 * Ce module produit une vue « pseudonymisée » du profil. Les identités réelles
 * sont réinjectées localement, après la réponse du modèle, par la forge
 * documentaire. Le modèle ne voit jamais l'identité.
 *
 * Aucune donnée sensible (`sensitiveAnswers`) n'est jamais transmise, quelle
 * que soit l'option choisie. C'est une propriété du type de retour, pas une
 * politique révocable.
 */

export interface MinimizedProfile {
  /** Étiquette neutre. Le vrai nom n'est jamais transmis. */
  pseudonym: 'LE_CANDIDAT';
  headline?: string;
  summary?: string;
  /** Région seulement, jamais l'adresse. */
  generalLocation?: string;
  experiences: Array<{
    ref: string;
    /** Employeur anonymisé sauf autorisation explicite. */
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
    skills: string[];
    metrics: string[];
  }>;
  projects: Array<{ ref: string; name: string; bullets: string[]; skills: string[] }>;
  education: Array<{ degree: string; field?: string; institution: string; completed: boolean }>;
  certifications: string[];
  skills: Array<{ name: string; level?: string; yearsOfExperience?: number }>;
  languages: Array<{ language: string; level: string }>;
}

export interface MinimizeOptions {
  /**
   * Transmettre les vrais noms d'employeurs. Utile pour une lettre qui doit
   * citer un parcours vérifiable ; à laisser désactivé par défaut.
   */
  includeCompanyNames?: boolean;
  /** Nombre maximal d'expériences transmises. Les plus récentes d'abord. */
  maxExperiences?: number;
}

export function minimizeProfileForLlm(
  profile: CandidateProfile,
  options: MinimizeOptions = {},
): MinimizedProfile {
  const { includeCompanyNames = false, maxExperiences = 8 } = options;

  const sorted = [...profile.experiences].sort((a, b) =>
    (b.endDate ?? '9999-99').localeCompare(a.endDate ?? '9999-99'),
  );

  return {
    pseudonym: 'LE_CANDIDAT',
    headline: profile.identity.headline,
    summary: profile.identity.summary,
    // Région/pays seulement : « Québec, CA » suffit à adapter un ton, une rue non.
    generalLocation:
      [profile.location?.region, profile.location?.country].filter(Boolean).join(', ') || undefined,
    experiences: sorted.slice(0, maxExperiences).map((exp, index) => ({
      ref: exp.id,
      company: includeCompanyNames ? exp.company : `ENTREPRISE_${index + 1}`,
      title: exp.title,
      startDate: exp.startDate,
      endDate: exp.endDate,
      bullets: exp.bullets,
      skills: exp.skills,
      metrics: exp.metrics,
    })),
    projects: profile.projects.map((p) => ({
      ref: p.id,
      name: p.name,
      bullets: p.bullets,
      skills: p.skills,
    })),
    education: profile.education.map((e) => ({
      degree: e.degree,
      field: e.field,
      institution: e.institution,
      completed: e.completed,
    })),
    certifications: profile.certifications.map((c) => c.name),
    skills: profile.skills.map((s) => ({
      name: s.name,
      level: s.level,
      yearsOfExperience: s.yearsOfExperience,
    })),
    languages: profile.languages.map((l) => ({ language: l.language, level: l.level })),
  };
}

export interface MinimizedJob {
  title: string;
  company: string;
  department?: string;
  seniority: string;
  remotePolicy: string;
  language: string;
  requirements: string[];
  responsibilities: string[];
  skills: string[];
  /** Description tronquée : au-delà, c'est du texte de marque employeur. */
  descriptionExcerpt: string;
}

/**
 * L'offre est publique : rien à anonymiser. On la tronque néanmoins pour
 * limiter le coût et le bruit — les 6 000 premiers caractères contiennent
 * toujours le poste et les exigences.
 */
export function minimizeJobForLlm(job: NormalizedJob, maxChars = 6000): MinimizedJob {
  return {
    title: job.title,
    company: job.companyName,
    department: job.department,
    seniority: job.seniority,
    remotePolicy: job.remotePolicy,
    language: job.language,
    requirements: job.sections.requirements.slice(0, 25),
    responsibilities: job.sections.responsibilities.slice(0, 25),
    skills: job.skills,
    descriptionExcerpt: job.descriptionText.slice(0, maxChars),
  };
}

/**
 * Vérifie qu'aucune PII connue ne subsiste dans une charge utile prête à
 * partir. Garde-fou de dernière ligne : appelée par le client LLM avant tout
 * envoi réseau, elle transforme une erreur de programmation en échec bruyant
 * plutôt qu'en fuite silencieuse.
 *
 * @returns Liste des fragments interdits trouvés. Vide = envoi autorisé.
 */
export function assertNoPii(payload: string, profile: CandidateProfile): string[] {
  const violations: string[] = [];
  const needles: Array<[string, string | undefined]> = [
    ['courriel', profile.contact.email],
    ['téléphone', profile.contact.phone],
    ['adresse', profile.contact.address],
    ['nom', `${profile.identity.firstName} ${profile.identity.lastName}`],
  ];

  const haystack = payload.toLowerCase();
  for (const [label, needle] of needles) {
    if (!needle) continue;
    const trimmed = needle.trim().toLowerCase();
    // Les valeurs très courtes produiraient des faux positifs (« li », « an »).
    if (trimmed.length < 5) continue;
    if (haystack.includes(trimmed)) violations.push(label);
  }

  for (const answer of profile.sensitiveAnswers) {
    if (answer.state !== 'answered' || !answer.value) continue;
    const value = answer.value.trim().toLowerCase();
    if (value.length < 5) continue;
    if (haystack.includes(value)) violations.push(`réponse sensible « ${answer.key} »`);
  }

  return violations;
}
