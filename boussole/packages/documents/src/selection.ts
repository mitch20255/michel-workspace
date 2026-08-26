import type { CandidateProfile, Experience, NormalizedJob, Project } from '@boussole/core';
import { canonicalize, isSameSkill, normalizeSkillNames, tokenSet } from '@boussole/core';
import { jaccard } from '@boussole/core';

/**
 * Sélection et ordonnancement du contenu d'un CV ciblé.
 *
 * Ce que ce module fait : choisir **quelles** expériences, quels projets et
 * quelles puces mettre en avant pour une offre donnée, et dans quel ordre.
 *
 * Ce qu'il ne fait pas, jamais : modifier le contenu d'une puce. Le texte
 * affiché est celui du profil, mot pour mot. Réordonner et sélectionner sont
 * des opérations honnêtes ; réécrire ne l'est qu'encadré par les garde-fous
 * (V1, avec relecture humaine obligatoire).
 */

export interface ScoredExperience {
  experience: Experience;
  relevance: number;
  /** Puces retenues, dans l'ordre de pertinence, texte inchangé. */
  bullets: string[];
  matchedSkills: string[];
}

export interface ScoredProject {
  project: Project;
  relevance: number;
  bullets: string[];
  matchedSkills: string[];
}

export interface SelectionOptions {
  /** Nombre maximal d'expériences retenues. */
  maxExperiences?: number;
  /** Nombre maximal de puces par expérience. */
  maxBulletsPerExperience?: number;
  maxProjects?: number;
  /**
   * Conserver systématiquement l'expérience la plus récente, même peu
   * pertinente : un trou inexpliqué dans un CV attire plus l'attention
   * qu'une expérience hors sujet.
   */
  alwaysKeepMostRecent?: boolean;
}

/** Pertinence d'un texte vis-à-vis d'une offre : recouvrement lexical simple. */
function textRelevance(text: string, jobTokens: Set<string>): number {
  if (!text.trim()) return 0;
  return jaccard(tokenSet(text), jobTokens);
}

function skillOverlap(skills: string[], jobSkills: string[]): string[] {
  const normalized = normalizeSkillNames(skills);
  return normalized.filter((skill) => jobSkills.some((jobSkill) => isSameSkill(skill, jobSkill)));
}

/** Date de fin, `null` (poste en cours) triant en premier. */
function recencyKey(endDate: string | null): string {
  return endDate ?? '9999-99';
}

export function selectExperiences(
  profile: CandidateProfile,
  job: NormalizedJob,
  options: SelectionOptions = {},
): ScoredExperience[] {
  const { maxExperiences = 5, maxBulletsPerExperience = 4, alwaysKeepMostRecent = true } = options;

  const jobTokens = tokenSet(`${job.title} ${job.descriptionText}`);
  const jobSkills = job.skills;

  const scored: ScoredExperience[] = profile.experiences.map((experience) => {
    const matchedSkills = skillOverlap([...experience.skills, ...experience.bullets], jobSkills);

    // Les puces sont classées par pertinence mais leur texte reste intact.
    const bullets = [...experience.bullets]
      .map((bullet) => ({ bullet, score: textRelevance(bullet, jobTokens) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxBulletsPerExperience)
      .map((entry) => entry.bullet);

    const titleRelevance = textRelevance(experience.title, jobTokens);
    const contentRelevance = textRelevance(experience.bullets.join(' '), jobTokens);
    const skillRelevance = jobSkills.length === 0 ? 0 : matchedSkills.length / jobSkills.length;

    // L'intitulé pèse le plus : un recruteur balaie la colonne des titres
    // avant de lire quoi que ce soit d'autre.
    const relevance = titleRelevance * 0.4 + skillRelevance * 0.4 + contentRelevance * 0.2;

    return {
      experience,
      relevance: Number(relevance.toFixed(4)),
      bullets,
      matchedSkills,
    };
  });

  const mostRecent = [...scored].sort((a, b) =>
    recencyKey(b.experience.endDate).localeCompare(recencyKey(a.experience.endDate)),
  )[0];

  const selected = [...scored].sort((a, b) => b.relevance - a.relevance).slice(0, maxExperiences);

  if (alwaysKeepMostRecent && mostRecent && !selected.includes(mostRecent)) {
    // On remplace la moins pertinente plutôt que d'allonger le CV.
    selected[selected.length - 1] = mostRecent;
  }

  // Affichage final en ordre antichronologique : c'est la convention attendue,
  // et un CV trié par pertinence déroute le lecteur.
  return selected.sort((a, b) =>
    recencyKey(b.experience.endDate).localeCompare(recencyKey(a.experience.endDate)),
  );
}

export function selectProjects(
  profile: CandidateProfile,
  job: NormalizedJob,
  options: SelectionOptions = {},
): ScoredProject[] {
  const { maxProjects = 2, maxBulletsPerExperience = 3 } = options;
  const jobTokens = tokenSet(`${job.title} ${job.descriptionText}`);

  return (
    profile.projects
      .map((project) => {
        const matchedSkills = skillOverlap([...project.skills, ...project.bullets], job.skills);
        const relevance =
          textRelevance(`${project.name} ${project.description ?? ''}`, jobTokens) * 0.5 +
          (job.skills.length === 0 ? 0 : matchedSkills.length / job.skills.length) * 0.5;

        return {
          project,
          relevance: Number(relevance.toFixed(4)),
          bullets: project.bullets.slice(0, maxBulletsPerExperience),
          matchedSkills,
        };
      })
      // Un projet sans lien avec l'offre occupe de la place sans rien apporter.
      .filter((entry) => entry.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxProjects)
  );
}

/**
 * Ordonne les compétences du candidat en plaçant d'abord celles que l'offre
 * demande. Aucune compétence n'est ajoutée ni retirée : seul l'ordre change.
 */
export function orderSkillsForJob(
  profile: CandidateProfile,
  job: NormalizedJob,
  limit = 18,
): string[] {
  const names = normalizeSkillNames(profile.skills.map((s) => s.name));
  const requiredSet = new Set(
    job.sections.requirements.flatMap((requirement) => canonicalize(requirement).split(' ')),
  );

  return [...names]
    .map((name) => {
      const inJob = job.skills.some((jobSkill) => isSameSkill(jobSkill, name));
      const inRequirements = requiredSet.has(canonicalize(name));
      return { name, weight: (inJob ? 2 : 0) + (inRequirements ? 1 : 0) };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((entry) => entry.name);
}
