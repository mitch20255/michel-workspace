import type { CandidateProfile, KeywordGapReport, NormalizedJob } from '@boussole/core';
import { allowedKeywordsForDocuments, bridgePhrasing } from '@boussole/core';
import { GuardrailError, verifyLetter } from './guardrails.js';
import { rewriteBullets, summarizeEdits, type ImpactTone, type RewrittenBullet } from './impact.js';
import { selectExperiences } from './selection.js';
import { renderLetterTypst } from './templates/letter.js';
import { compileTypst, TypstUnavailableError } from './typst.js';
import { hashProfile, resolveLanguage, type BuiltDocument } from './cv.js';

/**
 * Génération d'une lettre de motivation.
 *
 * **Approche du MVP : assemblage déterministe, sans LLM.** Les paragraphes
 * sont construits à partir de phrases du profil et de faits de l'offre. Le
 * résultat est plus sobre qu'une lettre écrite par un modèle, mais il a trois
 * propriétés qu'aucune génération libre ne garantit :
 *
 *  - il ne contient aucune affirmation absente du profil ;
 *  - il est reproductible à l'identique ;
 *  - il ne coûte rien et ne transmet aucune donnée à un tiers.
 *
 * La réécriture par LLM est prévue en V1 : elle passera par les mêmes
 * garde-fous (`verifyLetter`) et exigera une relecture explicite avant envoi.
 * L'ordre est délibéré : d'abord la garantie, ensuite la fluidité.
 */

export interface BuildLetterOptions {
  keywordGap?: KeywordGapReport;
  language?: 'fr' | 'en';
  tone?: ImpactTone;
  /**
   * Inclure un paragraphe sur les compétences exigées que le candidat approche
   * sans les posséder. Actif par défaut : ne rien dire d'une exigence
   * manquante laisse le recruteur conclure au pire.
   */
  addressTransferableGaps?: boolean;
  /** Nom du destinataire. Jamais inventé : omis s'il est inconnu. */
  recipientName?: string;
  /** Paragraphes rédigés ou relus par l'utilisateur, utilisés tels quels. */
  customParagraphs?: string[];
  renderPdf?: boolean;
  typstBinary?: string;
  /** Date affichée. Injectée pour rendre les tests déterministes. */
  date?: Date;
}

export async function buildCoverLetter(
  profile: CandidateProfile,
  job: NormalizedJob,
  options: BuildLetterOptions = {},
): Promise<BuiltDocument> {
  const language = resolveLanguage(job, profile, options.language);
  const tone = options.tone ?? 'confident';
  const allowedKeywords = options.keywordGap ? allowedKeywordsForDocuments(options.keywordGap) : [];

  const rewrites: RewrittenBullet[] = [];
  const composed =
    options.customParagraphs?.length && options.customParagraphs.length > 0
      ? { paragraphs: options.customParagraphs, rewrites: [] }
      : composeParagraphs(profile, job, language, {
          tone,
          keywordGap: options.addressTransferableGaps === false ? undefined : options.keywordGap,
        });
  const paragraphs = composed.paragraphs;
  rewrites.push(...composed.rewrites);

  const sourceTypst = renderLetterTypst({
    profile,
    companyName: job.companyName,
    jobTitle: job.title,
    recipientName: options.recipientName,
    language,
    date: (options.date ?? new Date()).toISOString(),
    paragraphs,
  });

  const plainText = [
    `${profile.identity.firstName} ${profile.identity.lastName}`,
    [profile.contact.email, profile.contact.phone].filter(Boolean).join(' · '),
    '',
    job.companyName,
    '',
    language === 'fr'
      ? `Objet : Candidature au poste de ${job.title}`
      : `Subject: Application for the position of ${job.title}`,
    '',
    ...paragraphs,
    '',
    `${profile.identity.firstName} ${profile.identity.lastName}`,
  ].join('\n');

  // Les compétences transférables peuvent être nommées dans la lettre, mais
  // uniquement niées : `verifyLetter` rejette toute mention affirmative.
  const negatable = (options.keywordGap?.transferable ?? []).map((item) => item.keyword);

  const guardrails = verifyLetter(plainText, profile, job.companyName, allowedKeywords, {
    negatable,
  });
  if (!guardrails.ok) throw new GuardrailError(guardrails);

  const document: BuiltDocument = {
    kind: 'cover_letter',
    language,
    sourceTypst,
    plainText,
    injectedKeywords: allowedKeywords.filter((keyword) =>
      plainText.toLowerCase().includes(keyword.toLowerCase()),
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
    if (error instanceof TypstUnavailableError) {
      document.pdfUnavailableReason = error.message;
    } else {
      throw error;
    }
  }

  return document;
}

/**
 * Compose les paragraphes à partir de faits vérifiables.
 *
 * Chaque phrase est soit une formule fixe, soit une reprise littérale du
 * profil. Aucune inférence : on ne écrit pas « passionné par votre mission »
 * — Boussole n'a aucun moyen de savoir si c'est vrai.
 */
function composeParagraphs(
  profile: CandidateProfile,
  job: NormalizedJob,
  language: 'fr' | 'en',
  options: { tone: ImpactTone; keywordGap?: KeywordGapReport },
): { paragraphs: string[]; rewrites: RewrittenBullet[] } {
  const fr = language === 'fr';
  const paragraphs: string[] = [];
  const rewrites: RewrittenBullet[] = [];

  // 1. Objet de la candidature — factuel.
  //
  // Le nom d'entreprise est fréquemment suffixé d'un point (« … Inc. ») : y
  // ajouter la ponctuation de fin produit « Inc.. ». Le nom n'est pas
  // modifié pour autant — seul le point de la phrase est omis.
  const company = job.companyName;
  const companySentenceEnd = company.endsWith('.') ? '' : '.';
  paragraphs.push(
    fr
      ? `Je vous soumets ma candidature au poste de ${job.title} chez ${company}${companySentenceEnd}`
      : `I am writing to apply for the ${job.title} position at ${company}${companySentenceEnd}`,
  );

  // 2. Parcours — reprise du résumé du profil, ou de l'expérience la plus récente.
  const mostRecent = [...profile.experiences].sort((a, b) =>
    (b.endDate ?? '9999-99').localeCompare(a.endDate ?? '9999-99'),
  )[0];

  if (profile.identity.summary) {
    paragraphs.push(profile.identity.summary);
  } else if (mostRecent) {
    paragraphs.push(
      fr
        ? `J'occupe actuellement le poste de ${mostRecent.title} chez ${mostRecent.company}.`
        : `I currently work as ${mostRecent.title} at ${mostRecent.company}.`,
    );
  }

  // 3. Éléments d'expérience pertinents, réécrits selon le cadran d'impact.
  const relevant = selectExperiences(profile, job, {
    maxExperiences: 2,
    maxBulletsPerExperience: 2,
  });
  const rewritten = rewriteBullets(relevant.flatMap((entry) => entry.bullets).slice(0, 3), {
    tone: options.tone,
    language,
    jobSkills: job.skills,
  });
  rewrites.push(...rewritten);
  const highlights = rewritten.map((entry) => entry.text);

  if (highlights.length > 0) {
    paragraphs.push(
      (fr
        ? 'Les éléments de mon parcours qui rejoignent le plus vos besoins : '
        : 'The parts of my experience most relevant to your needs: ') +
        highlights.map((bullet) => bullet.replace(/\.$/, '')).join(' ; ') +
        '.',
    );
  }

  // 4. Exigences approchées mais non possédées.
  //
  // Le silence est la pire option : un recruteur qui ne voit pas Kubernetes
  // dans le dossier conclut à l'absence totale d'expérience de conteneurs.
  // Nommer la compétence voisine **et** l'écart transforme un rejet
  // automatique en question d'entretien. La phrase vient de `bridgePhrasing`,
  // dont les deux moitiés sont indissociables : impossible de garder
  // « j'opère des conteneurs » en supprimant « pas de Kubernetes ».
  const bridges = (options.keywordGap?.transferable ?? [])
    .filter((item) => item.required && item.transferable)
    .slice(0, 3);

  if (bridges.length > 0) {
    // Chaque passerelle porte déjà son propre point-virgule, entre la
    // compétence possédée et l'écart. Les enchaîner avec un point-virgule de
    // plus rendrait le couple illisible : une passerelle = une phrase.
    const sentences = bridges.map((item) =>
      // Régénérée dans la langue de la lettre plutôt que reprise du rapport,
      // qui est toujours en français.
      bridgePhrasing(item.transferable!, language),
    );
    paragraphs.push(
      (fr
        ? "Sur les technologies que vous mentionnez et que je n'ai pas encore pratiquées en poste. "
        : 'On the technologies you list that I have not yet used professionally. ') +
        sentences.join(' '),
    );
  }

  // 5. Clôture — formule neutre, sans affirmation d'enthousiasme non vérifiable.
  paragraphs.push(
    fr
      ? 'Je demeure disponible pour un entretien afin de vous exposer plus en détail ce que je peux apporter à votre équipe.'
      : 'I would welcome the opportunity to discuss how I can contribute to your team.',
  );

  return { paragraphs, rewrites };
}
