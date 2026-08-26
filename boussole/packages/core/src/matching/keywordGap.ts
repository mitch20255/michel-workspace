import type { CandidateProfile } from '../schemas/profile.js';
import type { NormalizedJob } from '../schemas/job.js';
import { canonicalize } from '../text/normalize.js';
import { extractSkills, isSameSkill, normalizeSkillNames } from './skills.js';

/**
 * Analyse d'écart de mots-clés entre une offre et le profil candidat.
 *
 * Le point crucial est la distinction entre trois statuts, et **seul le
 * premier autorise une action automatique** :
 *
 *  - `missing_from_cv` : le candidat possède la compétence (elle est dans son
 *    profil) mais elle n'apparaît pas dans la version du CV envoyée. C'est le
 *    seul cas où Boussole peut proposer d'injecter le mot-clé : l'affirmation
 *    reste vraie.
 *  - `not_in_profile`  : le candidat ne déclare pas cette compétence. Boussole
 *    la signale comme un écart réel à combler (formation, projet), et n'écrit
 *    JAMAIS ce mot-clé dans un document. L'ajouter serait un mensonge.
 *  - `matched`         : présente des deux côtés.
 *
 * Cette séparation est la barrière anti-hallucination du produit. Toute
 * évolution du module doit la préserver.
 */

export type GapStatus = 'matched' | 'missing_from_cv' | 'not_in_profile';

export interface KeywordGapItem {
  keyword: string;
  status: GapStatus;
  /** Exigence explicite de l'offre plutôt que simple mention. */
  required: boolean;
  occurrencesInJob: number;
  category: string;
  /** Où la compétence a été trouvée côté candidat, s'il y a lieu. */
  profileEvidence?: string;
  /** Action autorisée pour ce mot-clé. */
  advice: string;
}

export interface KeywordGapReport {
  items: KeywordGapItem[];
  matched: KeywordGapItem[];
  /** Vrais, à réintégrer dans le CV. Utilisables par la forge documentaire. */
  safeToAdd: KeywordGapItem[];
  /** Écarts réels. Jamais insérés dans un document. */
  realGaps: KeywordGapItem[];
  /** Part des exigences couvertes par le profil, 0–1. */
  coverage: number;
  /** Part des exigences *obligatoires* couvertes, 0–1. */
  requiredCoverage: number;
}

export interface KeywordGapOptions {
  /**
   * Texte du CV actuellement utilisé. Permet de distinguer « le candidat a la
   * compétence mais son CV ne la montre pas » de « le candidat ne l'a pas ».
   * Sans lui, tout ce que le profil contient est considéré comme déjà visible.
   */
  currentCvText?: string;
}

/** Index des compétences du candidat, tous emplacements confondus. */
function buildProfileSkillIndex(profile: CandidateProfile): Map<string, string> {
  const index = new Map<string, string>();

  const add = (name: string, where: string) => {
    const normalized = normalizeSkillNames([name])[0];
    if (!normalized) return;
    if (!index.has(normalized)) index.set(normalized, where);
  };

  for (const skill of profile.skills) add(skill.name, 'compétences déclarées');
  for (const exp of profile.experiences) {
    for (const skill of exp.skills) add(skill, `expérience chez ${exp.company}`);
    // Les compétences citées dans les puces comptent : elles sont attestées
    // par une réalisation concrète, ce qui est plus fort qu'une liste.
    for (const found of extractSkills(exp.bullets.join(' '), { includeAmbiguous: false })) {
      add(found.canonical, `expérience chez ${exp.company}`);
    }
  }
  for (const project of profile.projects) {
    for (const skill of project.skills) add(skill, `projet ${project.name}`);
    for (const found of extractSkills(project.bullets.join(' '), { includeAmbiguous: false })) {
      add(found.canonical, `projet ${project.name}`);
    }
  }
  for (const cert of profile.certifications) add(cert.name, `certification ${cert.name}`);

  return index;
}

export function analyzeKeywordGap(
  job: Pick<NormalizedJob, 'descriptionText' | 'sections' | 'title'>,
  profile: CandidateProfile,
  options: KeywordGapOptions = {},
): KeywordGapReport {
  const requirementText = [...job.sections.requirements, ...job.sections.responsibilities].join(
    '\n',
  );

  const jobSkills = extractSkills(`${job.title}\n${job.descriptionText}`, {
    requirementText,
    includeAmbiguous: false,
  });

  const profileIndex = buildProfileSkillIndex(profile);
  const profileNames = [...profileIndex.keys()];
  const cvText = options.currentCvText ? canonicalize(options.currentCvText) : undefined;

  const items: KeywordGapItem[] = jobSkills.map((jobSkill) => {
    const profileMatch = profileNames.find((name) => isSameSkill(name, jobSkill.canonical));

    if (!profileMatch) {
      return {
        keyword: jobSkill.canonical,
        status: 'not_in_profile',
        required: jobSkill.required,
        occurrencesInJob: jobSkill.occurrences,
        category: jobSkill.category,
        advice: jobSkill.required
          ? 'Exigence non couverte par votre profil. À ne pas ajouter au CV : à combler réellement, ou à assumer dans la lettre.'
          : "Souhait non couvert par votre profil. Ne pas l'ajouter au CV.",
      };
    }

    const visibleInCv = cvText ? cvText.includes(canonicalize(jobSkill.canonical)) : true;
    const evidence = profileIndex.get(profileMatch);

    if (!visibleInCv) {
      return {
        keyword: jobSkill.canonical,
        status: 'missing_from_cv',
        required: jobSkill.required,
        occurrencesInJob: jobSkill.occurrences,
        category: jobSkill.category,
        profileEvidence: evidence,
        advice: `Vous possédez cette compétence (${evidence ?? 'profil'}) mais elle n'apparaît pas dans ce CV. À faire ressortir.`,
      };
    }

    return {
      keyword: jobSkill.canonical,
      status: 'matched',
      required: jobSkill.required,
      occurrencesInJob: jobSkill.occurrences,
      category: jobSkill.category,
      profileEvidence: evidence,
      advice: 'Déjà couverte et visible.',
    };
  });

  const matched = items.filter((i) => i.status === 'matched');
  const safeToAdd = items.filter((i) => i.status === 'missing_from_cv');
  const realGaps = items.filter((i) => i.status === 'not_in_profile');

  const covered = matched.length + safeToAdd.length;
  const coverage = items.length === 0 ? 0 : covered / items.length;

  const requiredItems = items.filter((i) => i.required);
  const requiredCovered = requiredItems.filter((i) => i.status !== 'not_in_profile').length;
  // Une offre sans exigence identifiable ne peut pas être « couverte à 100 % » :
  // on retourne 0 et le scoring traite ce cas comme une inconnue, pas comme un succès.
  const requiredCoverage = requiredItems.length === 0 ? 0 : requiredCovered / requiredItems.length;

  return {
    items,
    matched,
    safeToAdd,
    realGaps,
    coverage: Number(coverage.toFixed(3)),
    requiredCoverage: Number(requiredCoverage.toFixed(3)),
  };
}

/**
 * Liste blanche des mots-clés que la forge documentaire a le droit
 * d'introduire. Volontairement séparée du rapport complet : le module de
 * génération ne reçoit que cette liste, jamais `realGaps`.
 */
export function allowedKeywordsForDocuments(report: KeywordGapReport): string[] {
  return report.safeToAdd.map((item) => item.keyword);
}
