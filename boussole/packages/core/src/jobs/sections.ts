import type { JobSections } from '../schemas/job.js';
import { canonicalize, collapseWhitespace } from '../text/normalize.js';

/**
 * Découpage d'une description en sections exploitables.
 *
 * Pourquoi c'est important : le scoring ne doit pas traiter « offert : REER
 * collectif » comme une exigence. Sans ce découpage, les avantages sociaux
 * polluent l'analyse d'écart de mots-clés et le CV généré met en avant les
 * mauvais termes.
 *
 * Méthode : repérage d'en-têtes bilingues, puis rattachement des puces qui
 * suivent. Une description sans en-tête reconnaissable retourne des sections
 * vides — c'est un signal en soi, exploité par le ghost scoring.
 */

type SectionKind = 'requirements' | 'responsibilities' | 'benefits' | 'other';

const HEADING_RULES: Array<{ kind: SectionKind; pattern: RegExp }> = [
  {
    kind: 'requirements',
    pattern:
      /^(?:.{0,4})?(?:exigences?|qualifications?|profil recherch[ée]|ce que (?:nous|l'?on) recherch\w*|comp[ée]tences? (?:requises?|recherch[ée]es?|essentielles?)|pr[ée]requis|pr[ée]-requis|requirements?|what you(?:'| a)?ll need|what we(?:'| a)?re looking for|must[- ]haves?|skills? (?:and|&) (?:experience|qualifications)|who you are|your profile|nice[- ]to[- ]haves?|atouts?)\s*:?\s*$/i,
  },
  {
    kind: 'responsibilities',
    pattern:
      /^(?:.{0,4})?(?:responsabilit[ée]s?|t[âa]ches?|mandat|vos? (?:d[ée]fis|missions?)|ce que vous (?:ferez|allez faire)|principales? fonctions?|r[ôo]le et responsabilit[ée]s|responsibilities|what you(?:'| wi)?ll do|the role|your (?:mission|impact|day)|day[- ]to[- ]day|about the role|key duties)\s*:?\s*$/i,
  },
  {
    kind: 'benefits',
    pattern:
      /^(?:.{0,4})?(?:avantages?|b[ée]n[ée]fices?|ce que (?:nous|l'?on) offr\w*|nos avantages|pourquoi nous rejoindre|conditions|r[ée]mun[ée]ration et avantages|benefits?|perks?|what we offer|why join us|compensation (?:and|&) benefits|our offer)\s*:?\s*$/i,
  },
];

/** Un en-tête doit être court : une phrase de 200 caractères n'en est pas un. */
const MAX_HEADING_LENGTH = 80;

function classifyHeading(line: string): SectionKind | undefined {
  const trimmed = collapseWhitespace(line).replace(/^[•\-*–—#\s]+/, '');
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) return undefined;

  for (const { kind, pattern } of HEADING_RULES) {
    if (pattern.test(trimmed)) return kind;
  }
  return undefined;
}

/** Une ligne de puce, quel que soit le marqueur utilisé par l'ATS. */
function isBullet(line: string): boolean {
  return /^\s*(?:[-*•·▪◦‣–—]|\d{1,2}[.)]\s)/.test(line);
}

function cleanBullet(line: string): string {
  return collapseWhitespace(line.replace(/^\s*(?:[-*•·▪◦‣–—]|\d{1,2}[.)])\s*/, ''));
}

export interface ExtractSectionsOptions {
  /** Longueur minimale d'une puce retenue. Écarte « - » et « N/A ». */
  minBulletLength?: number;
  /** Nombre maximal de puces conservées par section. */
  maxBulletsPerSection?: number;
}

/**
 * @param text Description en texte brut (passer par `htmlToText` d'abord).
 */
export function extractSections(text: string, options: ExtractSectionsOptions = {}): JobSections {
  const { minBulletLength = 8, maxBulletsPerSection = 40 } = options;

  const sections: JobSections = { requirements: [], responsibilities: [], benefits: [] };
  if (!text?.trim()) return sections;

  const lines = text.split('\n');
  let current: SectionKind | undefined;

  for (const line of lines) {
    const heading = classifyHeading(line);
    if (heading) {
      current = heading;
      continue;
    }

    if (!current || current === 'other') continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Un paragraphe long après un en-tête clôt implicitement la section :
    // les ATS enchaînent souvent « Exigences » puis un bloc « À propos de
    // nous » sans en-tête. Sans cette garde, tout le pied de page atterrit
    // dans les exigences.
    if (!isBullet(trimmed) && trimmed.length > 200) {
      current = undefined;
      continue;
    }

    const content = isBullet(trimmed) ? cleanBullet(trimmed) : trimmed;
    if (content.length < minBulletLength) continue;

    const bucket = sections[current];
    if (bucket.length < maxBulletsPerSection) bucket.push(content);
  }

  return sections;
}

/**
 * Score de généricité d'une description : 0 = très spécifique, 1 = passe-partout.
 * Utilisé par le ghost scoring — une annonce faite de formules creuses est un
 * signal faible de poste fantôme.
 */
const BOILERPLATE_MARKERS = [
  'fast paced environment',
  'environnement dynamique',
  'wear many hats',
  'rock star',
  'rockstar',
  'ninja',
  'work hard play hard',
  'competitive salary',
  'salaire competitif',
  'equal opportunity employer',
  'employeur souscrivant',
  'we are always looking',
  'nous sommes toujours a la recherche',
  'talent pool',
  'banque de candidatures',
  'future opportunities',
  'opportunites futures',
  'candidature spontanee',
  'self starter',
  'team player',
  'esprit d equipe',
  'excellent communication skills',
  'excellentes aptitudes en communication',
];

export interface GenericityAssessment {
  /** 0 → très spécifique, 1 → très générique. */
  score: number;
  markers: string[];
}

export function assessGenericity(text: string, sections: JobSections): GenericityAssessment {
  const canonical = canonicalize(text);
  const markers = BOILERPLATE_MARKERS.filter((m) => canonical.includes(m));

  let score = 0;

  // Chaque formule creuse pèse, mais on plafonne : une annonce peut être
  // précise ET contenir la mention légale d'employeur équitable.
  score += Math.min(markers.length * 0.12, 0.45);

  // Une description très courte ne dit rien de concret.
  const wordCount = canonical.split(' ').filter(Boolean).length;
  if (wordCount < 80) score += 0.3;
  else if (wordCount < 150) score += 0.15;

  // Aucune exigence ni responsabilité identifiable.
  const structured = sections.requirements.length + sections.responsibilities.length;
  if (structured === 0) score += 0.25;
  else if (structured < 3) score += 0.1;

  // Absence totale de termes techniques ou chiffrés.
  if (!/\d/.test(canonical)) score += 0.1;

  return { score: Math.min(1, Number(score.toFixed(3))), markers };
}
