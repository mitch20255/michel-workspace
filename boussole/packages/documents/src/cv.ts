import type { CandidateProfile, KeywordGapReport, NormalizedJob } from '@boussole/core';
import { allowedKeywordsForDocuments, stableHash } from '@boussole/core';
import { GuardrailError, verifyDocument, type GuardrailReport } from './guardrails.js';
import {
  rewriteBullets,
  summarizeEdits,
  type ImpactEdit,
  type ImpactTone,
  type RewrittenBullet,
} from './impact.js';
import { orderSkillsForJob, selectExperiences, selectProjects } from './selection.js';
import { formatMonth, renderCvTypst } from './templates/cv.js';
import { compileTypst, TypstUnavailableError } from './typst.js';

/**
 * Génération d'un CV ciblé.
 *
 * Chaîne complète : sélection → mise en page → **vérification** → compilation.
 * La vérification est placée avant la compilation, volontairement : un
 * document qui échoue aux garde-fous ne doit jamais exister sous forme de PDF,
 * même dans un dossier temporaire. Un fichier produit finit toujours par être
 * envoyé.
 */

export interface BuildCvOptions {
  /** Rapport d'écart de mots-clés, source de la liste blanche. */
  keywordGap?: KeywordGapReport;
  /** Langue du document. Par défaut, celle de l'offre, sinon celle du profil. */
  language?: 'fr' | 'en';
  maxExperiences?: number;
  maxBulletsPerExperience?: number;
  /**
   * Niveau de réécriture d'impact. `factual` reproduit le profil mot pour mot.
   * Voir `impact.ts` pour ce que chaque niveau déplace exactement.
   */
  tone?: ImpactTone;
  /** Produire le PDF. Faux pour prévisualiser sans dépendre de Typst. */
  renderPdf?: boolean;
  typstBinary?: string;
}

export interface BuiltDocument {
  kind: 'cv' | 'cover_letter';
  language: 'fr' | 'en';
  /** Source Typst, conservée pour reproduire le document à l'identique. */
  sourceTypst: string;
  /** Texte extractible, tel qu'un ATS le lira. */
  plainText: string;
  pdf?: Uint8Array;
  /** Renseigné si le PDF n'a pas pu être produit. */
  pdfUnavailableReason?: string;
  /** Mots-clés effectivement mis en avant, tous issus du profil. */
  injectedKeywords: string[];
  /** Empreinte du profil au moment de la génération. */
  profileHash: string;
  guardrails: GuardrailReport;
  /** Niveau de réécriture appliqué. */
  tone: ImpactTone;
  /**
   * Chaque puce réécrite, avec son original et le détail des transformations.
   * L'interface l'affiche avant tout envoi : une réécriture assumée et relue
   * est défendable, une réécriture silencieuse ne l'est pas.
   */
  rewrites: RewrittenBullet[];
  /**
   * Transformations ayant déplacé la portée d'une affirmation (niveau
   * `assertive` uniquement). Signalées à part parce que ce sont les seules
   * que l'utilisateur doit pouvoir défendre en entretien.
   */
  scopeChangingEdits: ImpactEdit[];
}

/** Langue du document : celle de l'offre prime, le profil sert de repli. */
export function resolveLanguage(
  job: Pick<NormalizedJob, 'language'>,
  profile: CandidateProfile,
  override?: 'fr' | 'en',
): 'fr' | 'en' {
  if (override) return override;
  if (job.language === 'fr' || job.language === 'en') return job.language;
  return profile.locale.startsWith('en') ? 'en' : 'fr';
}

/**
 * Empreinte du contenu du profil. Permet de détecter qu'un document ne
 * reflète plus le profil courant, sans conserver de copie du profil.
 */
export function hashProfile(profile: CandidateProfile): string {
  return stableHash(
    JSON.stringify({
      experiences: profile.experiences,
      projects: profile.projects,
      education: profile.education,
      certifications: profile.certifications,
      skills: profile.skills,
      identity: profile.identity,
    }),
  );
}

export async function buildCv(
  profile: CandidateProfile,
  job: NormalizedJob,
  options: BuildCvOptions = {},
): Promise<BuiltDocument> {
  const language = resolveLanguage(job, profile, options.language);

  const tone = options.tone ?? 'confident';

  const selected = selectExperiences(profile, job, {
    maxExperiences: options.maxExperiences,
    maxBulletsPerExperience: options.maxBulletsPerExperience,
  });
  const selectedProjects = selectProjects(profile, job);
  const skills = orderSkillsForJob(profile, job);

  // Seuls les mots-clés que le candidat possède réellement peuvent être mis en
  // avant. `realGaps` n'est jamais transmis ici — c'est la garantie du produit.
  const allowedKeywords = options.keywordGap ? allowedKeywordsForDocuments(options.keywordGap) : [];

  // La réécriture d'impact ne peut que supprimer, permuter et renommer une
  // compétence en son synonyme : `assertNoNewFacts` le vérifie à chaque puce.
  // Les garde-fous s'appliquent ensuite au texte réécrit, comme au texte brut.
  const rewrites: RewrittenBullet[] = [];
  const rewriteOptions = { tone, language, jobSkills: job.skills } as const;

  const experiences = selected.map((entry) => {
    const rewritten = rewriteBullets(entry.bullets, rewriteOptions);
    rewrites.push(...rewritten);
    return { ...entry, bullets: rewritten.map((r) => r.text) };
  });

  const projects = selectedProjects.map((entry) => {
    const rewritten = rewriteBullets(entry.bullets, rewriteOptions);
    rewrites.push(...rewritten);
    return { ...entry, bullets: rewritten.map((r) => r.text) };
  });

  const sourceTypst = renderCvTypst({
    profile,
    experiences,
    projects,
    skills,
    language,
    targetTitle: job.title,
    summary: profile.identity.summary,
  });

  const plainText = buildCvPlainText({ profile, experiences, projects, skills, language, job });

  const guardrails = verifyDocument(plainText, profile, allowedKeywords);
  if (!guardrails.ok) throw new GuardrailError(guardrails);

  const document: BuiltDocument = {
    kind: 'cv',
    language,
    sourceTypst,
    plainText,
    injectedKeywords: skills.filter((skill) =>
      allowedKeywords.some((keyword) => keyword.toLowerCase() === skill.toLowerCase()),
    ),
    profileHash: hashProfile(profile),
    guardrails,
    tone,
    rewrites: rewrites.filter((r) => r.edits.length > 0),
    scopeChangingEdits: summarizeEdits(rewrites).scopeChanging,
  };

  if (options.renderPdf === false) return document;

  try {
    document.pdf = await compileTypst(sourceTypst, { binary: options.typstBinary });
  } catch (error) {
    // Une absence de Typst dégrade le résultat sans faire échouer la
    // génération : la source et le texte restent exploitables.
    if (error instanceof TypstUnavailableError) {
      document.pdfUnavailableReason = error.message;
    } else {
      throw error;
    }
  }

  return document;
}

/**
 * Version texte du CV.
 *
 * Ce n'est pas un sous-produit : c'est la représentation qui sert à vérifier
 * les garde-fous, à alimenter l'analyse d'écart de mots-clés et à comparer ce
 * qu'un ATS lira avec ce que le PDF affiche. Elle est donc construite à partir
 * des mêmes données que le gabarit, jamais extraite du PDF.
 */
function buildCvPlainText(data: {
  profile: CandidateProfile;
  experiences: ReturnType<typeof selectExperiences>;
  projects: ReturnType<typeof selectProjects>;
  skills: string[];
  language: 'fr' | 'en';
  job: NormalizedJob;
}): string {
  const { profile, experiences, projects, skills, language } = data;
  const fr = language === 'fr';
  const lines: string[] = [];

  lines.push(`${profile.identity.firstName} ${profile.identity.lastName}`);
  if (profile.identity.headline) lines.push(profile.identity.headline);
  lines.push(
    [profile.contact.email, profile.contact.phone, profile.contact.publicLocation]
      .filter(Boolean)
      .join(' · '),
  );
  for (const link of profile.links) lines.push(`${link.label}: ${link.url}`);
  lines.push('');

  if (profile.identity.summary) {
    lines.push(fr ? 'PROFIL' : 'SUMMARY', profile.identity.summary, '');
  }

  if (experiences.length > 0) {
    lines.push(fr ? 'EXPÉRIENCE PROFESSIONNELLE' : 'PROFESSIONAL EXPERIENCE');
    for (const { experience, bullets } of experiences) {
      lines.push(
        `${experience.title} — ${experience.company} (${formatMonth(
          experience.startDate,
          language,
        )} – ${formatMonth(experience.endDate, language)})`,
      );
      for (const bullet of bullets) lines.push(`- ${bullet}`);
      lines.push('');
    }
  }

  if (projects.length > 0) {
    lines.push(fr ? 'PROJETS' : 'PROJECTS');
    for (const { project, bullets } of projects) {
      lines.push(project.name);
      for (const bullet of bullets) lines.push(`- ${bullet}`);
      lines.push('');
    }
  }

  if (profile.education.length > 0) {
    lines.push(fr ? 'FORMATION' : 'EDUCATION');
    for (const education of profile.education) {
      const degree = education.completed
        ? education.degree
        : `${education.degree} (${fr ? 'non complété' : 'not completed'})`;
      lines.push(`${degree} — ${education.institution}`);
    }
    lines.push('');
  }

  if (profile.certifications.length > 0) {
    lines.push(fr ? 'CERTIFICATIONS' : 'CERTIFICATIONS');
    for (const certification of profile.certifications) {
      lines.push([certification.name, certification.issuer].filter(Boolean).join(' — '));
    }
    lines.push('');
  }

  if (skills.length > 0) {
    lines.push(fr ? 'COMPÉTENCES' : 'SKILLS', skills.join(' · '), '');
  }

  if (profile.languages.length > 0) {
    lines.push(
      fr ? 'LANGUES' : 'LANGUAGES',
      profile.languages.map((entry) => `${entry.language} (${entry.level})`).join(' · '),
      '',
    );
  }

  return lines.join('\n').trim();
}
