import type { Confidence, EmploymentType, Seniority } from '../schemas/common.js';
import { SENIORITY_LADDER } from '../schemas/common.js';
import { canonicalize } from '../text/normalize.js';

/**
 * Inférence de niveau et de type de contrat.
 *
 * L'intitulé prime toujours sur la description : « Senior Engineer » dans le
 * titre est un fait, « you will work with senior engineers » dans le corps
 * n'en est pas un. C'est la source d'erreur classique de ce genre de moteur.
 */

const TITLE_RULES: Array<{ seniority: Seniority; pattern: RegExp }> = [
  { seniority: 'intern', pattern: /\b(intern(ship)?|stagiaire|stage|coop|co-op|apprenti)\b/ },
  {
    seniority: 'executive',
    pattern: /\b(cto|ceo|cio|coo|cfo|chief|vp|vice president|vice-president)\b/,
  },
  {
    seniority: 'director',
    pattern: /\b(director|directeur|directrice|head of|responsable de la|chef de service)\b/,
  },
  {
    seniority: 'manager',
    pattern: /\b(manager|gestionnaire|superviseur|supervisor|chef d equipe|team lead(er)?)\b/,
  },
  { seniority: 'principal', pattern: /\b(principal|architecte principal|distinguished)\b/ },
  { seniority: 'staff', pattern: /\b(staff)\b/ },
  { seniority: 'lead', pattern: /\b(lead|responsable technique|tech lead)\b/ },
  {
    seniority: 'senior',
    pattern: /\b(senior|sr\.?|principal[e]? conseill|expert|confirme|iii|iv)\b/,
  },
  { seniority: 'junior', pattern: /\b(junior|jr\.?|entry level|debutant|niveau 1|i)\b/ },
  { seniority: 'mid', pattern: /\b(intermediaire|intermediate|mid level|ii)\b/ },
];

/** « 5+ ans d'expérience », « at least 3 years of experience ». */
const YEARS_PATTERNS = [
  /(\d{1,2})\s*\+?\s*(?:ans?|years?)\b[^.]{0,40}?(?:experience|exp[ée]rience)/i,
  /(?:minimum|at least|au moins|min\.?)\s*(?:de\s*)?(\d{1,2})\s*(?:ans?|years?)/i,
  /(?:experience|exp[ée]rience)[^.]{0,40}?(\d{1,2})\s*\+?\s*(?:ans?|years?)/i,
];

export interface SeniorityDetection {
  seniority: Seniority;
  confidence: Confidence;
  /** Années d'expérience exigées, si le texte les indique explicitement. */
  yearsRequired?: number;
  evidence?: string;
}

/** Traduit un nombre d'années en niveau. Repères usuels du marché nord-américain. */
function seniorityFromYears(years: number): Seniority {
  if (years <= 1) return 'junior';
  if (years <= 4) return 'mid';
  if (years <= 8) return 'senior';
  return 'staff';
}

export function detectSeniority(title: string, description = ''): SeniorityDetection {
  const canonicalTitle = canonicalize(title);

  for (const { seniority, pattern } of TITLE_RULES) {
    const match = pattern.exec(canonicalTitle);
    if (match) {
      return { seniority, confidence: 'high', evidence: `titre: « ${match[0]} »` };
    }
  }

  // Pas de marqueur dans le titre : on se rabat sur les années exigées.
  for (const pattern of YEARS_PATTERNS) {
    const match = pattern.exec(description);
    const captured = match?.[1];
    if (captured) {
      const years = Number.parseInt(captured, 10);
      if (Number.isFinite(years) && years >= 0 && years <= 40) {
        return {
          seniority: seniorityFromYears(years),
          confidence: 'medium',
          yearsRequired: years,
          evidence: match[0].trim(),
        };
      }
    }
  }

  return { seniority: 'unknown', confidence: 'low' };
}

/**
 * Distance entre deux niveaux sur l'échelle.
 * @returns `undefined` si l'un des deux est inconnu — une distance nulle
 *          serait interprétée à tort comme « parfaitement aligné ».
 */
export function seniorityDistance(a: Seniority, b: Seniority): number | undefined {
  if (a === 'unknown' || b === 'unknown') return undefined;
  const indexA = SENIORITY_LADDER.indexOf(a as (typeof SENIORITY_LADDER)[number]);
  const indexB = SENIORITY_LADDER.indexOf(b as (typeof SENIORITY_LADDER)[number]);
  if (indexA < 0 || indexB < 0) return undefined;
  return Math.abs(indexA - indexB);
}

const EMPLOYMENT_RULES: Array<{ type: EmploymentType; pattern: RegExp }> = [
  { type: 'internship', pattern: /\b(intern(ship)?|stage|stagiaire|coop|co-op)\b/i },
  {
    type: 'contract',
    pattern:
      /\b(contrat|contract|contractuel(?:le)?|cdd|fixed[- ]term|dur[ée]e d[ée]termin[ée]e|mandat)\b/i,
  },
  {
    type: 'freelance',
    pattern: /\b(freelance|pigiste|consultant ind[ée]pendant|self[- ]employed)\b/i,
  },
  {
    type: 'temporary',
    pattern: /\b(temporary|temporaire|interim|int[ée]rim|seasonal|saisonnier)\b/i,
  },
  { type: 'part_time', pattern: /\b(part[- ]time|temps partiel|mi[- ]temps)\b/i },
  { type: 'full_time', pattern: /\b(full[- ]time|temps plein|permanent|cdi|regular)\b/i },
];

export function detectEmploymentType(raw: string | undefined, title = ''): EmploymentType {
  const haystack = `${raw ?? ''} ${title}`;
  if (!haystack.trim()) return 'unknown';
  for (const { type, pattern } of EMPLOYMENT_RULES) {
    if (pattern.test(haystack)) return type;
  }
  return 'unknown';
}
