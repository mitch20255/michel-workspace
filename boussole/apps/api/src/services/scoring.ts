import { scoreJob, type CandidateProfile, type ScoreResult } from '@boussole/core';
import { jobRowToDomain, toJson } from '@boussole/db';
import type { AppContext } from '../context.js';
import { loadSettings } from '../context.js';
import { notFound } from '../errors.js';

/**
 * Service de scoring.
 *
 * Les résultats sont **stockés** plutôt que recalculés à chaque affichage.
 * Ce n'est pas une optimisation : un score dépend du profil au moment du
 * calcul, et l'utilisateur doit pouvoir constater qu'une offre a changé de
 * note après une mise à jour de son profil. Recalculer silencieusement
 * effacerait cette information.
 */

export interface ScoredJobSummary {
  jobId: string;
  score: number;
  decision: ScoreResult['decision'];
  summary: string;
}

/** Recalcule le score d'une offre pour un profil et l'enregistre. */
export async function scoreOne(
  context: AppContext,
  jobId: string,
  profile: CandidateProfile,
): Promise<ScoreResult> {
  const row = await context.prisma.job.findUnique({ where: { id: jobId } });
  if (!row) throw notFound('Offre');

  const settings = await loadSettings(context);
  const weights = (settings.scoringWeights ?? {}) as Record<string, number>;

  const result = scoreJob(jobRowToDomain(row), profile, {
    weights: Object.keys(weights).length > 0 ? weights : undefined,
  });

  await persistScore(context, jobId, profile.id, result);
  return result;
}

/**
 * Recalcule tous les scores d'un profil.
 *
 * Utilisé après une modification du profil ou des pondérations : sans cela,
 * l'utilisateur verrait des scores calculés avec un profil qui n'existe plus.
 */
export async function scoreAll(
  context: AppContext,
  profile: CandidateProfile,
): Promise<ScoredJobSummary[]> {
  const rows = await context.prisma.job.findMany({
    where: { status: { in: ['active', 'unknown'] } },
    orderBy: { lastSeenAt: 'desc' },
  });

  const settings = await loadSettings(context);
  const weights = (settings.scoringWeights ?? {}) as Record<string, number>;
  const scoringOptions = Object.keys(weights).length > 0 ? { weights } : undefined;

  const summaries: ScoredJobSummary[] = [];

  for (const row of rows) {
    const result = scoreJob(jobRowToDomain(row), profile, scoringOptions);
    await persistScore(context, row.id, profile.id, result);
    summaries.push({
      jobId: row.id,
      score: result.score,
      decision: result.decision,
      summary: result.summary,
    });
  }

  await context.audit({
    action: 'job.scored',
    actor: 'system',
    metadata: { count: summaries.length, profileId: profile.id },
    summary: `${summaries.length} offre(s) évaluée(s)`,
  });

  return summaries.sort((a, b) => b.score - a.score);
}

async function persistScore(
  context: AppContext,
  jobId: string,
  profileId: string,
  result: ScoreResult,
): Promise<void> {
  const data = {
    score: result.score,
    decision: result.decision,
    criteria: toJson(result.criteria),
    blockers: toJson(result.blockers),
    warnings: toJson(result.warnings),
    // Le rapport complet d'écart de mots-clés est conservé : c'est lui qui
    // alimente la forge documentaire et l'affichage détaillé.
    keywordGap: toJson(result.keywordGap),
    summary: result.summary,
    computedAt: new Date(),
  };

  await context.prisma.jobScore.upsert({
    where: { jobId_profileId: { jobId, profileId } },
    create: { jobId, profileId, ...data },
    update: data,
  });
}
