import type { GhostSignal, JobSections } from '../schemas/job.js';
import { assessGenericity } from '../jobs/sections.js';
import { canonicalize } from '../text/normalize.js';

/**
 * Score de suspicion « offre fantôme ».
 *
 * ⚠️ Ce score est un **signal faible**, pas un verdict. Une offre peut être
 * légitime et cocher plusieurs cases (une PME qui recrute en continu, un
 * poste réellement difficile à pourvoir). L'interface doit le présenter comme
 * un indice explicable, jamais comme une vérité, et ne doit jamais masquer
 * automatiquement une offre sur cette seule base.
 *
 * Chaque signal porte son poids et son explication : l'utilisateur doit
 * pouvoir contester le score en lisant ce qui l'a produit.
 */

export interface GhostScoreInput {
  firstSeenAt: string;
  lastSeenAt: string;
  /** Nombre de fois où l'offre a été revue lors d'une ingestion. */
  seenCount: number;
  /** Nombre de disparitions/réapparitions constatées. */
  repostCount: number;
  descriptionText: string;
  sections: JobSections;
  applyUrl?: string;
  canonicalUrl?: string;
  hasSalary: boolean;
  /** Nombre total d'offres actives publiées par la même entreprise. */
  companyActiveJobCount?: number;
  /** Taille connue de l'entreprise, si renseignée. */
  companyEmployeeCount?: number;
  /** Horodatage de référence pour le calcul d'âge. Injecté pour les tests. */
  now?: Date;
}

export interface GhostScoreResult {
  /** 0 = aucun signal, 100 = cumul maximal de signaux. */
  score: number;
  signals: GhostSignal[];
  /** Lecture destinée à l'humain. */
  band: 'clear' | 'watch' | 'suspicious';
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: Date): number {
  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((to.getTime() - start) / DAY_MS));
}

/** Formules qui trahissent une collecte de CV sans poste réel à pourvoir. */
const PIPELINE_BUILDING_PATTERNS = [
  'always looking for',
  'toujours a la recherche',
  'talent pool',
  'banque de candidatures',
  'banque de candidats',
  'future opportunities',
  'opportunites futures',
  'evergreen',
  'candidature spontanee',
  'general application',
  'no specific opening',
  'keep your resume on file',
  'garder votre cv en dossier',
];

export function scoreGhostJob(input: GhostScoreInput): GhostScoreResult {
  const now = input.now ?? new Date();
  const signals: GhostSignal[] = [];

  // --- 1. Ancienneté -----------------------------------------------------
  const ageDays = daysBetween(input.firstSeenAt, now);
  if (ageDays >= 180) {
    signals.push({
      code: 'age_very_old',
      label: 'Offre en ligne depuis plus de 6 mois',
      weight: 22,
      detail: `${ageDays} jours depuis la première détection`,
    });
  } else if (ageDays >= 90) {
    signals.push({
      code: 'age_old',
      label: 'Offre en ligne depuis plus de 3 mois',
      weight: 12,
      detail: `${ageDays} jours depuis la première détection`,
    });
  } else if (ageDays >= 45) {
    signals.push({
      code: 'age_aging',
      label: 'Offre en ligne depuis plus de 6 semaines',
      weight: 5,
      detail: `${ageDays} jours depuis la première détection`,
    });
  }

  // --- 2. Republications -------------------------------------------------
  if (input.repostCount >= 3) {
    signals.push({
      code: 'repost_frequent',
      label: 'Offre republiée à plusieurs reprises',
      weight: 18,
      detail: `${input.repostCount} republications détectées`,
    });
  } else if (input.repostCount === 2) {
    signals.push({
      code: 'repost_some',
      label: 'Offre republiée',
      weight: 8,
      detail: '2 republications détectées',
    });
  }

  // --- 3. Généricité de la description -----------------------------------
  const genericity = assessGenericity(input.descriptionText, input.sections);
  if (genericity.score >= 0.6) {
    signals.push({
      code: 'description_generic',
      label: 'Description très générique',
      weight: 16,
      detail:
        genericity.markers.length > 0
          ? `Formules relevées : ${genericity.markers.slice(0, 3).join(', ')}`
          : 'Peu de contenu concret',
    });
  } else if (genericity.score >= 0.35) {
    signals.push({
      code: 'description_vague',
      label: 'Description peu détaillée',
      weight: 7,
      detail: `Indice de généricité : ${genericity.score}`,
    });
  }

  // --- 4. Absence de détails concrets ------------------------------------
  const structuredCount =
    input.sections.requirements.length + input.sections.responsibilities.length;
  if (structuredCount === 0 && input.descriptionText.length > 0) {
    signals.push({
      code: 'no_structure',
      label: 'Ni exigences ni responsabilités identifiables',
      weight: 10,
    });
  }

  // --- 5. Constitution de vivier ------------------------------------------
  const canonical = canonicalize(input.descriptionText);
  const pipelineMarker = PIPELINE_BUILDING_PATTERNS.find((p) => canonical.includes(p));
  if (pipelineMarker) {
    // Signal le plus lourd du module, et le seul qui soit quasi définitionnel
    // plutôt que circonstanciel : « nous sommes toujours à la recherche » ou
    // « banque de candidatures » dit explicitement qu'aucun poste précis
    // n'est à pourvoir. Tous les autres signaux (âge, généricité, volume)
    // admettent des explications légitimes ; celui-ci beaucoup moins.
    signals.push({
      code: 'pipeline_building',
      label: 'Formulation de constitution de vivier de candidats',
      weight: 30,
      detail: `Expression relevée : « ${pipelineMarker} »`,
    });
  }

  // --- 6. Volume anormal côté entreprise ---------------------------------
  const activeJobs = input.companyActiveJobCount;
  const employees = input.companyEmployeeCount;
  if (activeJobs !== undefined && employees !== undefined && employees > 0) {
    const ratio = activeJobs / employees;
    // Recruter plus de 25 % de son effectif simultanément est inhabituel.
    if (ratio > 0.25) {
      signals.push({
        code: 'company_volume_anomaly',
        label: "Volume d'offres élevé par rapport à l'effectif",
        weight: 12,
        detail: `${activeJobs} offres pour ~${employees} employés`,
      });
    }
  } else if (activeJobs !== undefined && activeJobs > 200) {
    signals.push({
      code: 'company_volume_high',
      label: "Très grand nombre d'offres actives pour cette entreprise",
      weight: 6,
      detail: `${activeJobs} offres actives`,
    });
  }

  // --- 7. Traçabilité de la candidature ----------------------------------
  if (!input.applyUrl && !input.canonicalUrl) {
    signals.push({
      code: 'no_canonical_url',
      label: 'Aucune URL de candidature fiable',
      weight: 14,
    });
  }

  // --- 8. Opacité salariale sur une offre ancienne -----------------------
  // Isolément, l'absence de salaire est banale. Combinée à une offre qui
  // traîne, elle renforce le doute — d'où le poids faible et conditionnel.
  if (!input.hasSalary && ageDays >= 90) {
    signals.push({
      code: 'no_salary_old_posting',
      label: 'Aucune fourchette salariale sur une offre ancienne',
      weight: 5,
    });
  }

  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.min(100, Math.round(total));

  return {
    score,
    signals: signals.sort((a, b) => b.weight - a.weight),
    band: score >= 55 ? 'suspicious' : score >= 25 ? 'watch' : 'clear',
  };
}

export const GHOST_BAND_LABELS_FR: Record<GhostScoreResult['band'], string> = {
  clear: 'Aucun signal particulier',
  watch: 'Quelques signaux à surveiller',
  suspicious: 'Plusieurs signaux concordants',
};
