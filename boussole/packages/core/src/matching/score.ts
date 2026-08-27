import type { NormalizedJob } from '../schemas/job.js';
import type { CandidateProfile } from '../schemas/profile.js';
import { locationAffinity } from '../jobs/location.js';
import { toAnnual } from '../jobs/salary.js';
import { seniorityDistance } from '../jobs/seniority.js';
import { canonicalize } from '../text/normalize.js';
import { jaroWinkler, trigramSimilarity } from '../dedup/similarity.js';
import { analyzeKeywordGap, TRANSFERABLE_CREDIT, type KeywordGapReport } from './keywordGap.js';

/**
 * Moteur de scoring déterministe.
 *
 * Trois propriétés non négociables :
 *
 *  1. **Explicable** — chaque critère produit son score, son poids et une
 *     phrase en français. Un score sans justification est inutilisable pour
 *     décider où investir son temps.
 *  2. **Honnête sur l'inconnu** — un critère non évaluable (salaire absent,
 *     séniorité indéterminée) est *exclu du calcul* et son poids redistribué,
 *     au lieu d'être compté 0. Compter 0 pénaliserait les offres discrètes,
 *     pas les mauvaises offres.
 *  3. **Gratuit** — aucun appel réseau, aucun LLM. Le LLM n'intervient
 *     qu'ensuite, sur les offres survivantes, pour affiner.
 */

export type CriterionKey =
  | 'title_alignment'
  | 'required_skills'
  | 'preferred_skills'
  | 'seniority'
  | 'location'
  | 'remote_policy'
  | 'salary'
  | 'industry'
  | 'experience_depth';

export interface CriterionScore {
  key: CriterionKey;
  label: string;
  /** 0–1. */
  score: number;
  weight: number;
  /** Faux si le critère n'a pas pu être évalué : poids redistribué. */
  evaluated: boolean;
  explanation: string;
}

export type Decision = 'reject' | 'maybe' | 'shortlist' | 'generate_documents';

export interface ScoreResult {
  /** 0–100. */
  score: number;
  decision: Decision;
  criteria: CriterionScore[];
  /** Éliminations déterministes ; si non vide, `decision` vaut `reject`. */
  blockers: string[];
  /** Signaux à mentionner sans bloquer (ex. score fantôme élevé). */
  warnings: string[];
  keywordGap: KeywordGapReport;
  /** Résumé lisible, prêt à afficher. */
  summary: string;
}

/**
 * Poids par défaut. Somme = 1 quand tous les critères sont évaluables.
 * Modifiables par utilisateur : quelqu'un qui déménage ne pondère pas la
 * localisation comme quelqu'un qui a un bail.
 */
export const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  title_alignment: 0.18,
  required_skills: 0.26,
  preferred_skills: 0.08,
  seniority: 0.12,
  location: 0.1,
  remote_policy: 0.08,
  salary: 0.1,
  industry: 0.04,
  experience_depth: 0.04,
};

/**
 * Plafonds appliqués quand trop peu de critères sont évaluables.
 *
 * Choisis pour rester sous les seuils de décision : moins de quatre critères
 * ne peut pas dépasser « à considérer », moins de six ne peut pas atteindre
 * « prioritaire — générer les documents ». Une offre mal documentée peut donc
 * être examinée, jamais recommandée en priorité.
 */
const CONFIDENCE_CAP_SPARSE = 60;
const CONFIDENCE_CAP_PARTIAL = 78;

export interface ScoreOptions {
  weights?: Partial<Record<CriterionKey, number>>;
  /** Texte du CV courant, pour l'analyse d'écart. */
  currentCvText?: string;
  /** Seuils de décision. */
  thresholds?: { shortlist?: number; maybe?: number; generate?: number };
}

const CRITERION_LABELS: Record<CriterionKey, string> = {
  title_alignment: 'Alignement du poste',
  required_skills: 'Compétences exigées',
  preferred_skills: 'Compétences souhaitées',
  seniority: 'Niveau de séniorité',
  location: 'Localisation',
  remote_policy: 'Mode de travail',
  salary: 'Rémunération',
  industry: 'Secteur',
  experience_depth: "Profondeur d'expérience",
};

export function scoreJob(
  job: NormalizedJob,
  profile: CandidateProfile,
  options: ScoreOptions = {},
): ScoreResult {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const thresholds = { shortlist: 70, maybe: 45, generate: 82, ...options.thresholds };

  const blockers: string[] = [];
  const warnings: string[] = [];

  const keywordGap = analyzeKeywordGap(job, profile, {
    currentCvText: options.currentCvText,
  });

  // --- Filtres déterministes ---------------------------------------------
  // Peu coûteux et appliqués en premier : inutile de scorer une offre que le
  // candidat a explicitement exclue.
  const prefs = profile.preferences;

  const excludedCompany = prefs.excludedCompanies.find(
    (c) => canonicalize(c) === canonicalize(job.companyName),
  );
  if (excludedCompany) blockers.push(`Entreprise exclue par vos préférences : ${excludedCompany}`);

  const excludedTitle = prefs.excludedTitles.find((t) =>
    canonicalize(job.title).includes(canonicalize(t)),
  );
  if (excludedTitle) blockers.push(`Intitulé exclu par vos préférences : « ${excludedTitle} »`);

  if (job.status === 'expired') blockers.push('Offre expirée');

  if (
    prefs.remotePolicies.length > 0 &&
    job.remotePolicy !== 'unknown' &&
    !prefs.remotePolicies.includes(job.remotePolicy)
  ) {
    blockers.push(`Mode de travail non souhaité : ${job.remotePolicy}`);
  }

  // --- Critères ----------------------------------------------------------
  const criteria: CriterionScore[] = [
    scoreTitleAlignment(job, profile, weights.title_alignment),
    scoreRequiredSkills(keywordGap, weights.required_skills),
    scorePreferredSkills(keywordGap, weights.preferred_skills),
    scoreSeniority(job, profile, weights.seniority),
    scoreLocation(job, profile, weights.location),
    scoreRemotePolicy(job, profile, weights.remote_policy),
    scoreSalary(job, profile, weights.salary),
    scoreIndustry(job, profile, weights.industry),
    scoreExperienceDepth(job, profile, weights.experience_depth),
  ];

  // Redistribution : seuls les critères évaluables comptent.
  const evaluated = criteria.filter((c) => c.evaluated);
  const totalWeight = evaluated.reduce((sum, c) => sum + c.weight, 0);
  const raw =
    totalWeight === 0 ? 0 : evaluated.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;

  let score = Math.round(raw * 100);

  // --- Avertissements ----------------------------------------------------
  if (job.ghostScore >= 55) {
    warnings.push(
      `Signaux d'offre fantôme (score ${job.ghostScore}/100) : vérifier avant d'investir du temps.`,
    );
    // Pénalité modérée et plafonnée : le score fantôme reste un signal faible,
    // il informe la priorisation sans disqualifier une offre.
    score = Math.max(0, score - 8);
  } else if (job.ghostScore >= 25) {
    warnings.push(`Quelques signaux d'offre fantôme (score ${job.ghostScore}/100).`);
  }

  /**
   * Plafond de confiance.
   *
   * Redistribuer le poids des critères non évaluables évite de pénaliser une
   * offre discrète, mais produit un effet pervers si on s'arrête là : une
   * annonce quasi vide ne peut échouer nulle part, et un simple intitulé bien
   * aligné suffit alors à la faire monter très haut. Une offre fantôme sans
   * exigence, sans salaire et sans lieu se retrouvait ainsi recommandée en
   * priorité — l'inverse exact de ce qu'on veut.
   *
   * Un avertissement ne suffit pas : c'est le score qui pilote le tri, et
   * personne ne lit l'avertissement d'une offre classée première. On plafonne
   * donc explicitement. « On ne sait pas » ne doit jamais se présenter comme
   * « c'est excellent ».
   */
  if (evaluated.length < 4) {
    warnings.push(
      'Offre trop peu documentée pour être notée sérieusement : le score est plafonné.',
    );
    score = Math.min(score, CONFIDENCE_CAP_SPARSE);
  } else if (evaluated.length < 6) {
    warnings.push('Offre partiellement documentée : plusieurs critères n’ont pas pu être évalués.');
    score = Math.min(score, CONFIDENCE_CAP_PARTIAL);
  }

  const hardGaps = keywordGap.realGaps.filter((g) => g.required && g.status === 'not_in_profile');
  if (hardGaps.length > 0) {
    const missing = hardGaps.map((g) => g.keyword).slice(0, 5);
    warnings.push(`Exigences non couvertes par votre profil : ${missing.join(', ')}.`);
  }

  // Les exigences transférables méritent leur propre message : les mêler aux
  // écarts francs pousserait à écarter des offres réellement accessibles.
  const bridgeable = keywordGap.transferable.filter((g) => g.required);
  if (bridgeable.length > 0) {
    const pairs = bridgeable
      .slice(0, 4)
      .map((g) => `${g.keyword} (via ${g.transferable?.via ?? 'compétence voisine'})`);
    warnings.push(
      `Exigences approchées par des compétences voisines : ${pairs.join(', ')}. À défendre dans la lettre, jamais à écrire dans le CV.`,
    );
  }

  // --- Décision ----------------------------------------------------------
  let decision: Decision;
  if (blockers.length > 0) {
    decision = 'reject';
    score = 0;
  } else if (score >= thresholds.generate) decision = 'generate_documents';
  else if (score >= thresholds.shortlist) decision = 'shortlist';
  else if (score >= thresholds.maybe) decision = 'maybe';
  else decision = 'reject';

  return {
    score,
    decision,
    criteria,
    blockers,
    warnings,
    keywordGap,
    summary: buildSummary(score, decision, criteria, blockers),
  };
}

// --- Critères individuels -------------------------------------------------

function scoreTitleAlignment(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  const targets = profile.preferences.targetTitles;
  const pastTitles = profile.experiences.map((e) => e.title);
  const pool = [...targets, ...pastTitles];

  if (pool.length === 0) {
    return unevaluated('title_alignment', weight, 'Aucun intitulé cible ni expérience renseignés.');
  }

  const jobTitle = canonicalize(job.title);
  let best = 0;
  let bestMatch = '';
  for (const candidate of pool) {
    const c = canonicalize(candidate);
    const similarity = Math.max(jaroWinkler(jobTitle, c), trigramSimilarity(jobTitle, c));
    if (similarity > best) {
      best = similarity;
      bestMatch = candidate;
    }
  }

  // Un intitulé cible explicite vaut plus qu'un ancien poste : bonus modéré.
  const isTargeted = targets.some((t) => canonicalize(t) === canonicalize(bestMatch));
  const score = Math.min(1, isTargeted ? best * 1.1 : best);

  return {
    key: 'title_alignment',
    label: CRITERION_LABELS.title_alignment,
    score: round(score),
    weight,
    evaluated: true,
    explanation:
      best >= 0.75
        ? `Proche de « ${bestMatch} »${isTargeted ? ' (intitulé recherché)' : ' (poste occupé)'}.`
        : best >= 0.5
          ? `Partiellement proche de « ${bestMatch} ».`
          : `Éloigné de vos intitulés (plus proche : « ${bestMatch} »).`,
  };
}

function scoreRequiredSkills(gap: KeywordGapReport, weight: number): CriterionScore {
  const required = gap.items.filter((i) => i.required);
  if (required.length === 0) {
    return unevaluated(
      'required_skills',
      weight,
      "Aucune exigence explicite identifiable dans l'offre.",
    );
  }
  const held = required.filter((i) => i.status === 'matched' || i.status === 'missing_from_cv');
  const bridged = required.filter((i) => i.status === 'transferable');
  // Demi-crédit pour une compétence voisine : voir `TRANSFERABLE_CREDIT`.
  const covered = held.length + bridged.length * TRANSFERABLE_CREDIT;
  const score = covered / required.length;

  const bridgeNote =
    bridged.length > 0
      ? ` — ${bridged.length} approchée(s) par une compétence voisine, comptée(s) à moitié`
      : '';

  return {
    key: 'required_skills',
    label: CRITERION_LABELS.required_skills,
    score: round(score),
    weight,
    evaluated: true,
    explanation: `${held.length}/${required.length} exigences couvertes par votre profil${bridgeNote}${
      held.length + bridged.length < required.length
        ? ` — manquantes : ${required
            .filter((i) => i.status === 'not_in_profile')
            .map((i) => i.keyword)
            .slice(0, 4)
            .join(', ')}`
        : ''
    }.`,
  };
}

function scorePreferredSkills(gap: KeywordGapReport, weight: number): CriterionScore {
  const preferred = gap.items.filter((i) => !i.required);
  if (preferred.length === 0) {
    return unevaluated('preferred_skills', weight, 'Aucune compétence souhaitée identifiée.');
  }
  const covered = preferred.filter((i) => i.status !== 'not_in_profile');
  return {
    key: 'preferred_skills',
    label: CRITERION_LABELS.preferred_skills,
    score: round(covered.length / preferred.length),
    weight,
    evaluated: true,
    explanation: `${covered.length}/${preferred.length} compétences souhaitées couvertes.`,
  };
}

function scoreSeniority(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  const targets = profile.preferences.seniorityTargets.filter((s) => s !== 'unknown');
  if (job.seniority === 'unknown' || targets.length === 0) {
    return unevaluated(
      'seniority',
      weight,
      job.seniority === 'unknown'
        ? "Niveau non déterminable dans l'offre."
        : 'Aucun niveau cible renseigné dans votre profil.',
    );
  }

  const distances = targets
    .map((t) => seniorityDistance(job.seniority, t))
    .filter((d): d is number => d !== undefined);

  if (distances.length === 0) {
    return unevaluated('seniority', weight, 'Niveaux non comparables.');
  }

  const distance = Math.min(...distances);
  // Un écart d'un cran est courant et sans gravité ; au-delà de trois, le
  // poste n'est plus le bon.
  const score = distance === 0 ? 1 : distance === 1 ? 0.8 : distance === 2 ? 0.45 : 0.1;

  return {
    key: 'seniority',
    label: CRITERION_LABELS.seniority,
    score,
    weight,
    evaluated: true,
    explanation:
      distance === 0
        ? `Niveau ${job.seniority} : correspond exactement à votre cible.`
        : `Niveau ${job.seniority} : ${distance} cran(s) d'écart avec votre cible.`,
  };
}

function scoreLocation(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  // Un poste entièrement à distance rend la localisation sans objet.
  if (job.remotePolicy === 'remote') {
    return {
      key: 'location',
      label: CRITERION_LABELS.location,
      score: 1,
      weight,
      evaluated: true,
      explanation: 'Poste à distance : localisation sans contrainte.',
    };
  }

  const preferences = profile.preferences.locations;
  if (job.locations.length === 0 || preferences.length === 0) {
    return unevaluated(
      'location',
      weight,
      job.locations.length === 0
        ? "Localisation absente de l'offre."
        : 'Aucune localisation renseignée dans vos préférences.',
    );
  }

  let best = 0;
  for (const jobLocation of job.locations) {
    for (const preference of preferences) {
      best = Math.max(best, locationAffinity(jobLocation, preference));
    }
  }

  if (best === 0 && profile.preferences.willingToRelocate) {
    return {
      key: 'location',
      label: CRITERION_LABELS.location,
      score: 0.5,
      weight,
      evaluated: true,
      explanation: 'Hors de vos zones, mais vous êtes ouvert à la relocalisation.',
    };
  }

  return {
    key: 'location',
    label: CRITERION_LABELS.location,
    score: round(best),
    weight,
    evaluated: true,
    explanation:
      best >= 1
        ? 'Même ville que vos préférences.'
        : best >= 0.6
          ? 'Même région que vos préférences.'
          : best > 0
            ? 'Même pays, mais région différente.'
            : 'Hors de vos zones géographiques.',
  };
}

function scoreRemotePolicy(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  if (job.remotePolicy === 'unknown') {
    return unevaluated('remote_policy', weight, "Mode de travail non précisé dans l'offre.");
  }
  const accepted = profile.preferences.remotePolicies;
  if (accepted.length === 0) {
    return unevaluated('remote_policy', weight, 'Aucune préférence de mode de travail définie.');
  }

  const matches = accepted.includes(job.remotePolicy);
  // La confiance de détection module le score : une déduction faite à partir
  // d'un mot isolé ne vaut pas un champ structuré de l'ATS.
  const confidenceFactor =
    job.remoteConfidence === 'high' ? 1 : job.remoteConfidence === 'medium' ? 0.9 : 0.75;

  return {
    key: 'remote_policy',
    label: CRITERION_LABELS.remote_policy,
    score: matches ? round(confidenceFactor) : 0,
    weight,
    evaluated: true,
    explanation: matches
      ? `Mode « ${job.remotePolicy} » compatible avec vos préférences${
          job.remoteConfidence === 'low' ? ' (détection peu fiable, à vérifier)' : ''
        }.`
      : `Mode « ${job.remotePolicy} » hors de vos préférences.`,
  };
}

function scoreSalary(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  const expectation = profile.preferences.salaryExpectation;
  const salary = job.salary;

  if (!expectation || !salary?.min) {
    return unevaluated(
      'salary',
      weight,
      !expectation
        ? 'Aucune prétention salariale renseignée dans votre profil.'
        : "Aucune fourchette salariale dans l'offre.",
    );
  }

  const jobAnnualMax = toAnnual(salary.max ?? salary.min, salary.period);
  const jobAnnualMin = toAnnual(salary.min, salary.period);
  const wantedAnnual = toAnnual(expectation.min, expectation.period);

  if (jobAnnualMax === undefined || jobAnnualMin === undefined || wantedAnnual === undefined) {
    return unevaluated('salary', weight, 'Périodicité de rémunération indéterminée.');
  }

  // Devises différentes : on refuse de comparer plutôt que d'appliquer un
  // taux de change inventé.
  if (salary.currency && expectation.currency && salary.currency !== expectation.currency) {
    return unevaluated(
      'salary',
      weight,
      `Devises différentes (${salary.currency} vs ${expectation.currency}) : comparaison non fiable.`,
    );
  }

  let score: number;
  let explanation: string;
  if (jobAnnualMax >= wantedAnnual) {
    score = 1;
    explanation = `Le haut de fourchette (${format(jobAnnualMax)}) atteint votre attente (${format(wantedAnnual)}).`;
  } else {
    const ratio = jobAnnualMax / wantedAnnual;
    // En dessous de 80 % de l'attente, le score chute vite : c'est un
    // désalignement structurel, pas un détail de négociation.
    score = ratio >= 0.9 ? 0.7 : ratio >= 0.8 ? 0.4 : ratio >= 0.7 ? 0.15 : 0;
    explanation = `Le haut de fourchette (${format(jobAnnualMax)}) est ${Math.round((1 - ratio) * 100)} % sous votre attente (${format(wantedAnnual)}).`;
  }

  if (salary.confidence === 'low') {
    explanation += ' Estimation peu fiable, à vérifier dans l’annonce.';
  }

  return {
    key: 'salary',
    label: CRITERION_LABELS.salary,
    score,
    weight,
    evaluated: true,
    explanation,
  };
}

function scoreIndustry(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  const targets = profile.preferences.targetIndustries;
  if (targets.length === 0) {
    return unevaluated('industry', weight, 'Aucun secteur cible renseigné.');
  }
  const haystack = canonicalize(
    `${job.companyName} ${job.department ?? ''} ${job.descriptionText}`,
  );
  const hit = targets.find((t) => haystack.includes(canonicalize(t)));
  return {
    key: 'industry',
    label: CRITERION_LABELS.industry,
    score: hit ? 1 : 0.3,
    weight,
    evaluated: true,
    explanation: hit
      ? `Secteur recherché détecté : ${hit}.`
      : "Aucun de vos secteurs cibles n'est mentionné.",
  };
}

function scoreExperienceDepth(
  job: NormalizedJob,
  profile: CandidateProfile,
  weight: number,
): CriterionScore {
  if (profile.experiences.length === 0) {
    return unevaluated('experience_depth', weight, 'Aucune expérience renseignée.');
  }

  const jobSkillNames = new Set(job.skills.map((s) => canonicalize(s)));
  if (jobSkillNames.size === 0) {
    return unevaluated('experience_depth', weight, "Aucune compétence extraite de l'offre.");
  }

  // Années d'expérience *déclarées* sur les compétences que l'offre demande.
  // On ne déduit jamais les années à partir des dates d'emploi : un poste de
  // 5 ans ne signifie pas 5 ans sur chaque technologie citée.
  const relevant = profile.skills.filter(
    (s) => jobSkillNames.has(canonicalize(s.name)) && s.yearsOfExperience !== undefined,
  );

  if (relevant.length === 0) {
    return unevaluated(
      'experience_depth',
      weight,
      "Années d'expérience non renseignées sur les compétences demandées.",
    );
  }

  const average =
    relevant.reduce((sum, s) => sum + (s.yearsOfExperience ?? 0), 0) / relevant.length;
  const score = average >= 5 ? 1 : average >= 3 ? 0.8 : average >= 1 ? 0.5 : 0.25;

  return {
    key: 'experience_depth',
    label: CRITERION_LABELS.experience_depth,
    score,
    weight,
    evaluated: true,
    explanation: `Environ ${average.toFixed(1)} an(s) d'expérience déclarés sur les compétences demandées.`,
  };
}

// --- Utilitaires ----------------------------------------------------------

function unevaluated(key: CriterionKey, weight: number, reason: string): CriterionScore {
  return {
    key,
    label: CRITERION_LABELS[key],
    score: 0,
    weight,
    evaluated: false,
    explanation: `Non évalué : ${reason}`,
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function format(value: number): string {
  return `${Math.round(value).toLocaleString('fr-CA')} $`;
}

const DECISION_LABELS: Record<Decision, string> = {
  reject: 'Écartée',
  maybe: 'À considérer',
  shortlist: 'Shortlist',
  generate_documents: 'Prioritaire — générer les documents',
};

export const DECISION_LABELS_FR = DECISION_LABELS;

function buildSummary(
  score: number,
  decision: Decision,
  criteria: CriterionScore[],
  blockers: string[],
): string {
  if (blockers.length > 0) return `Écartée : ${blockers.join(' ; ')}.`;

  const evaluated = criteria.filter((c) => c.evaluated);
  const strengths = [...evaluated]
    .filter((c) => c.score >= 0.75)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);
  const weaknesses = [...evaluated]
    .filter((c) => c.score <= 0.4)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);

  const parts = [`${score}/100 — ${DECISION_LABELS[decision]}`];
  if (strengths.length > 0) {
    parts.push(`Points forts : ${strengths.map((c) => c.label.toLowerCase()).join(', ')}`);
  }
  if (weaknesses.length > 0) {
    parts.push(`Points faibles : ${weaknesses.map((c) => c.label.toLowerCase()).join(', ')}`);
  }
  const skipped = criteria.length - evaluated.length;
  if (skipped > 0) parts.push(`${skipped} critère(s) non évaluable(s)`);

  return `${parts.join('. ')}.`;
}
