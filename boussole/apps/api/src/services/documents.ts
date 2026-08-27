import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CandidateProfile, KeywordGapReport } from '@boussole/core';
import { slugify } from '@boussole/core';
import {
  buildCoverLetter,
  buildCv,
  type BuiltDocument,
  type ImpactTone,
} from '@boussole/documents';
import { jobRowToDomain, toJson } from '@boussole/db';
import type { AppContext } from '../context.js';
import { loadSettings } from '../context.js';
import { notFound } from '../errors.js';

const IMPACT_TONES: readonly ImpactTone[] = ['factual', 'confident', 'assertive'];

/**
 * La colonne est une chaîne libre côté base. Une valeur inattendue retombe
 * sur le niveau le plus prudent plutôt que de faire échouer la génération :
 * un réglage corrompu ne doit pas produire un document plus agressif que
 * demandé.
 */
function toImpactTone(value: string): ImpactTone {
  return IMPACT_TONES.includes(value as ImpactTone) ? (value as ImpactTone) : 'factual';
}

/**
 * Service de génération documentaire.
 *
 * Chaque génération crée une **nouvelle version**. Un document déjà envoyé
 * n'est jamais écrasé : savoir exactement quel CV a été transmis à quel
 * employeur est indispensable en entretien, et une version écrasée est
 * définitivement perdue.
 */

export interface GenerateDocumentsOptions {
  jobId: string;
  profile: CandidateProfile;
  /** `cv`, `cover_letter`, ou les deux. */
  kinds?: Array<'cv' | 'cover_letter'>;
  language?: 'fr' | 'en';
  recipientName?: string;
  customParagraphs?: string[];
  applicationId?: string;
  /**
   * Surcharge ponctuelle du niveau de réécriture. Sans elle, le réglage
   * enregistré dans les paramètres s'applique.
   */
  tone?: ImpactTone;
}

export interface GeneratedDocumentRecord {
  id: string;
  kind: 'cv' | 'cover_letter';
  language: string;
  version: number;
  pdfPath: string | null;
  pdfUnavailableReason?: string;
  injectedKeywords: string[];
  plainText: string;
  tone: ImpactTone;
  /** Puces réécrites, avec original et justification de chaque transformation. */
  rewrites: BuiltDocument['rewrites'];
  /**
   * Sous-ensemble des transformations qui déplacent la portée d'une
   * affirmation. Remonté séparément pour que l'interface puisse exiger une
   * relecture explicite plutôt que de les noyer dans le reste.
   */
  scopeChangingEdits: BuiltDocument['scopeChangingEdits'];
}

export async function generateDocuments(
  context: AppContext,
  options: GenerateDocumentsOptions,
): Promise<GeneratedDocumentRecord[]> {
  const jobRow = await context.prisma.job.findUnique({ where: { id: options.jobId } });
  if (!jobRow) throw notFound('Offre');

  const job = jobRowToDomain(jobRow);
  const kinds = options.kinds ?? ['cv', 'cover_letter'];

  // Le rapport d'écart déjà calculé fournit la liste blanche de mots-clés.
  // Sans lui, la forge ne met en avant que ce qui est déjà visible : correct,
  // mais moins utile.
  const scoreRow = await context.prisma.jobScore.findUnique({
    where: { jobId_profileId: { jobId: options.jobId, profileId: options.profile.id } },
  });
  const keywordGap = scoreRow?.keywordGap as KeywordGapReport | undefined;

  const settings = await loadSettings(context);
  const tone = options.tone ?? toImpactTone(settings.documentTone);

  const records: GeneratedDocumentRecord[] = [];

  for (const kind of kinds) {
    const built =
      kind === 'cv'
        ? await buildCv(options.profile, job, {
            keywordGap,
            language: options.language,
            tone,
            typstBinary: context.config.TYPST_BIN,
          })
        : await buildCoverLetter(options.profile, job, {
            keywordGap,
            language: options.language,
            tone,
            recipientName: options.recipientName,
            customParagraphs: options.customParagraphs,
            typstBinary: context.config.TYPST_BIN,
          });

    records.push(await persist(context, job.companyName, job.title, options, kind, built));
  }

  return records;
}

async function persist(
  context: AppContext,
  companyName: string,
  jobTitle: string,
  options: GenerateDocumentsOptions,
  kind: 'cv' | 'cover_letter',
  built: BuiltDocument,
): Promise<GeneratedDocumentRecord> {
  // La version est dérivée de l'existant plutôt que d'un compteur : deux
  // générations concurrentes ne peuvent pas se voir attribuer le même numéro
  // sans qu'on s'en aperçoive à la lecture.
  const previousCount = await context.prisma.generatedDocument.count({
    where: { profileId: options.profile.id, kind, applicationId: options.applicationId ?? null },
  });
  const version = previousCount + 1;

  let pdfPath: string | null = null;
  if (built.pdf) {
    const directory = join(context.config.STORAGE_DIR, 'documents', options.profile.id);
    await mkdir(directory, { recursive: true });

    const fileName = `${slugify(companyName)}-${slugify(jobTitle)}-${kind}-v${version}.pdf`;
    await writeFile(join(directory, fileName), built.pdf);
    // Chemin relatif en base : déplacer le dossier de stockage ne doit pas
    // invalider toutes les lignes.
    pdfPath = join('documents', options.profile.id, fileName);
  }

  const row = await context.prisma.generatedDocument.create({
    data: {
      userId: context.userId,
      profileId: options.profile.id,
      applicationId: options.applicationId ?? null,
      jobId: options.jobId,
      kind,
      language: built.language,
      version,
      sourceTypst: built.sourceTypst,
      plainText: built.plainText,
      pdfPath,
      injectedKeywords: built.injectedKeywords,
      profileHash: built.profileHash,
      tone: built.tone,
      rewrites: toJson(built.rewrites),
    },
  });

  await context.audit({
    action: 'document.generated',
    targetType: 'generated_document',
    targetId: row.id,
    metadata: {
      kind,
      version,
      language: built.language,
      pdf: Boolean(pdfPath),
      injectedKeywordCount: built.injectedKeywords.length,
      tone: built.tone,
      // Compteurs seulement : le journal d'audit ne contient jamais le texte
      // du document, pas plus que le prompt d'un appel au modèle.
      rewrittenBullets: built.rewrites.length,
      scopeChangingEdits: built.scopeChangingEdits.length,
    },
    summary: `${kind === 'cv' ? 'CV' : 'Lettre'} v${version} généré pour ${jobTitle} — ${companyName}`,
  });

  return {
    id: row.id,
    kind,
    language: built.language,
    version,
    pdfPath,
    pdfUnavailableReason: built.pdfUnavailableReason,
    injectedKeywords: built.injectedKeywords,
    plainText: built.plainText,
    tone: built.tone,
    rewrites: built.rewrites,
    scopeChangingEdits: built.scopeChangingEdits,
  };
}
