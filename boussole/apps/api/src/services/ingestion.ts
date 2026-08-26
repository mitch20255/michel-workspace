import { getConnector, type ConnectorContext, type FetchLike } from '@boussole/connectors';
import {
  dedupeJobs,
  normalizeJob,
  type DedupCandidate,
  type NormalizedJob,
  type RawJobInput,
} from '@boussole/core';
import { jobRowToDomain, jobToRow } from '@boussole/db';
import type { AppContext } from '../context.js';
import { badRequest, notFound } from '../errors.js';

/**
 * Service d'ingestion : de l'ATS jusqu'à la base.
 *
 * Enchaînement : connecteur → normalisation → rapprochement avec l'existant →
 * écriture → déduplication → désactivation des offres disparues.
 *
 * Décisions structurantes :
 *
 * 1. **Une offre disparue est désactivée, jamais supprimée.** Elle peut être
 *    liée à une candidature en cours, et sa réapparition ultérieure est le
 *    signal de republication le plus fort du score fantôme.
 * 2. **La normalisation reçoit l'état précédent.** Sans lui, `firstSeenAt` est
 *    réécrit à chaque passage et l'ancienneté — donc tout le score fantôme —
 *    devient fausse.
 * 3. **Un échec de source n'interrompt pas les autres.** Chaque source a sa
 *    propre trace d'exécution ; une source cassée ne doit pas priver
 *    l'utilisateur des autres.
 * 4. **La déduplication s'exécute après écriture, sur l'ensemble du corpus.**
 *    Deux offres identiques venant de deux sources différentes ne peuvent être
 *    rapprochées qu'une fois les deux présentes.
 */

export interface IngestionSummary {
  sourceId: string;
  provider: string;
  boardToken: string;
  status: 'success' | 'failed';
  fetched: number;
  created: number;
  updated: number;
  deactivated: number;
  duplicateGroups: number;
  warnings: string[];
  error?: string;
  durationMs: number;
}

export async function runIngestion(
  context: AppContext,
  sourceId: string,
  fetchImpl: FetchLike = fetch,
): Promise<IngestionSummary> {
  const source = await context.prisma.jobSource.findFirst({
    where: { id: sourceId, userId: context.userId },
  });
  if (!source) throw notFound("Source d'offres");

  const connector = getConnector(source.provider);
  if (!connector) {
    throw badRequest(`Aucun connecteur pour le fournisseur « ${source.provider} ».`);
  }

  const startedAt = Date.now();
  const run = await context.prisma.ingestionRun.create({
    data: { sourceId: source.id, status: 'running' },
  });

  await context.audit({
    action: 'ingestion.started',
    actor: 'system',
    targetType: 'job_source',
    targetId: source.id,
    metadata: { provider: source.provider, boardToken: source.boardToken },
    summary: `Ingestion démarrée : ${source.provider}/${source.boardToken}`,
  });

  const connectorContext: ConnectorContext = {
    fetch: fetchImpl,
    minDelayMs: context.config.INGEST_MIN_DELAY_MS,
    timeoutMs: context.config.INGEST_TIMEOUT_MS,
    userAgent: context.config.INGEST_USER_AGENT,
  };

  try {
    const result = await connector.fetchJobs(source.boardToken, connectorContext);

    const now = new Date();
    let created = 0;
    let updated = 0;
    const seenSourceJobIds = new Set<string>();

    for (const rawJob of result.jobs) {
      seenSourceJobIds.add(rawJob.sourceJobId);

      const existingRow = await context.prisma.job.findUnique({
        where: {
          atsProvider_sourceJobId: {
            atsProvider: rawJob.atsProvider,
            sourceJobId: rawJob.sourceJobId,
          },
        },
      });

      // L'état précédent est indispensable : sans lui, `firstSeenAt` serait
      // réécrit à chaque passage et l'offre paraîtrait éternellement neuve.
      const previous = existingRow ? jobRowToDomain(existingRow) : undefined;
      const normalized = normalizeJob(rawJob, { now, previous });
      const row = jobToRow(normalized);

      if (existingRow) {
        await context.prisma.job.update({ where: { id: existingRow.id }, data: row });
        updated += 1;
      } else {
        await context.prisma.job.create({ data: row });
        created += 1;
      }
    }

    // Offres connues de cette source qui n'ont pas reparu.
    const deactivated = await deactivateMissing(context, source.provider, seenSourceJobIds);

    const duplicateGroups = await refreshDuplicateGroups(context);

    const durationMs = Date.now() - startedAt;

    await context.prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        fetched: result.fetched,
        created,
        updated,
        inactive: deactivated,
        warnings: result.warnings,
      },
    });

    await context.prisma.jobSource.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastRunOk: true,
        lastRunNote: `${created} nouvelle(s), ${updated} mise(s) à jour, ${deactivated} désactivée(s)`,
      },
    });

    await context.audit({
      action: 'ingestion.completed',
      actor: 'system',
      targetType: 'job_source',
      targetId: source.id,
      metadata: { fetched: result.fetched, created, updated, deactivated, durationMs },
      summary: `Ingestion terminée : ${created} nouvelle(s), ${updated} mise(s) à jour`,
    });

    return {
      sourceId: source.id,
      provider: source.provider,
      boardToken: source.boardToken,
      status: 'success',
      fetched: result.fetched,
      created,
      updated,
      deactivated,
      duplicateGroups,
      warnings: result.warnings,
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await context.prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: 'failed', finishedAt: new Date(), error: message },
    });
    await context.prisma.jobSource.update({
      where: { id: source.id },
      data: { lastRunAt: new Date(), lastRunOk: false, lastRunNote: message },
    });
    await context.audit({
      action: 'ingestion.failed',
      actor: 'system',
      targetType: 'job_source',
      targetId: source.id,
      metadata: { provider: source.provider },
      summary: `Ingestion en échec : ${message}`,
    });

    return {
      sourceId: source.id,
      provider: source.provider,
      boardToken: source.boardToken,
      status: 'failed',
      fetched: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      duplicateGroups: 0,
      warnings: [],
      error: message,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Lance toutes les sources actives.
 * Un échec est capturé par source : une source cassée ne prive pas
 * l'utilisateur des autres.
 */
export async function runAllSources(
  context: AppContext,
  fetchImpl: FetchLike = fetch,
): Promise<IngestionSummary[]> {
  const sources = await context.prisma.jobSource.findMany({
    where: { userId: context.userId, enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  const summaries: IngestionSummary[] = [];
  for (const source of sources) {
    // Séquentiel et non parallèle : les connecteurs partagent une limitation
    // de débit par hôte, et rien ne presse une ingestion de fond.
    summaries.push(await runIngestion(context, source.id, fetchImpl));
  }
  return summaries;
}

async function deactivateMissing(
  context: AppContext,
  provider: string,
  seenSourceJobIds: Set<string>,
): Promise<number> {
  const active = await context.prisma.job.findMany({
    where: { atsProvider: provider, status: 'active' },
    select: { id: true, sourceJobId: true },
  });

  const missing = active.filter((job) => !seenSourceJobIds.has(job.sourceJobId));
  if (missing.length === 0) return 0;

  // Mise à jour groupée : le statut est la seule colonne concernée.
  await context.prisma.job.updateMany({
    where: { id: { in: missing.map((job) => job.id) } },
    data: { status: 'inactive' },
  });

  return missing.length;
}

/**
 * Recalcule les groupes de doublons sur l'ensemble des offres actives.
 *
 * Recalcul complet plutôt qu'incrémental : la déduplication est transitive,
 * une nouvelle offre peut relier deux groupes existants. Un rapprochement
 * incrémental produirait des groupes incohérents selon l'ordre d'arrivée.
 */
export async function refreshDuplicateGroups(context: AppContext): Promise<number> {
  const jobs = await context.prisma.job.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      atsProvider: true,
      sourceJobId: true,
      identityKey: true,
      companyName: true,
      title: true,
      locationRaw: true,
      descriptionText: true,
      duplicateGroupId: true,
      lastSeenAt: true,
    },
  });

  if (jobs.length === 0) return 0;

  const candidates: DedupCandidate[] = jobs.map((job) => ({
    id: job.id,
    source: job.atsProvider,
    sourceJobId: job.sourceJobId,
    identityKey: job.identityKey,
    companyName: job.companyName,
    title: job.title,
    primaryLocation: job.locationRaw ?? undefined,
    descriptionText: job.descriptionText,
  }));

  const { groups } = dedupeJobs(candidates);

  // Seuls les groupes de plus d'un membre sont matérialisés : créer une ligne
  // par offre unique gonflerait la table sans rien apporter.
  const multiMemberGroups = groups.filter((group) => group.memberIds.length > 1);

  const byJobId = new Map(jobs.map((job) => [job.id, job]));

  for (const group of multiMemberGroups) {
    const members = group.memberIds
      .map((id) => byJobId.get(id))
      .filter((job): job is NonNullable<typeof job> => Boolean(job));

    // Représentante : la description la plus complète, puis la plus récente.
    const canonical = [...members].sort((a, b) => {
      const lengthDiff = b.descriptionText.length - a.descriptionText.length;
      if (lengthDiff !== 0) return lengthDiff;
      return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    })[0];

    const existingGroupId = members.find((member) => member.duplicateGroupId)?.duplicateGroupId;

    const groupRow = existingGroupId
      ? await context.prisma.duplicateGroup.update({
          where: { id: existingGroupId },
          data: { canonicalJobId: canonical?.id ?? null },
        })
      : await context.prisma.duplicateGroup.create({
          data: { canonicalJobId: canonical?.id ?? null },
        });

    await context.prisma.job.updateMany({
      where: { id: { in: group.memberIds } },
      data: { duplicateGroupId: groupRow.id },
    });
  }

  // Offres redevenues uniques : on détache plutôt que de laisser un
  // rattachement obsolète.
  const groupedIds = new Set(multiMemberGroups.flatMap((group) => group.memberIds));
  const orphanIds = jobs
    .filter((job) => job.duplicateGroupId && !groupedIds.has(job.id))
    .map((job) => job.id);

  if (orphanIds.length > 0) {
    await context.prisma.job.updateMany({
      where: { id: { in: orphanIds } },
      data: { duplicateGroupId: null },
    });
  }

  if (multiMemberGroups.length > 0) {
    await context.audit({
      action: 'job.deduplicated',
      actor: 'system',
      metadata: {
        groups: multiMemberGroups.length,
        jobs: multiMemberGroups.reduce((sum, group) => sum + group.memberIds.length, 0),
      },
      summary: `${multiMemberGroups.length} groupe(s) de doublons identifié(s)`,
    });
  }

  return multiMemberGroups.length;
}

/** Ingestion manuelle d'une offre saisie ou collée par l'utilisateur. */
export async function ingestManualJob(
  context: AppContext,
  input: RawJobInput,
): Promise<NormalizedJob> {
  const existingRow = await context.prisma.job.findUnique({
    where: {
      atsProvider_sourceJobId: {
        atsProvider: input.atsProvider ?? 'manual',
        sourceJobId: input.sourceJobId,
      },
    },
  });

  const normalized = normalizeJob(
    { ...input, source: 'manual' },
    { now: new Date(), previous: existingRow ? jobRowToDomain(existingRow) : undefined },
  );

  const row = jobToRow(normalized);
  if (existingRow) {
    await context.prisma.job.update({ where: { id: existingRow.id }, data: row });
  } else {
    await context.prisma.job.create({ data: row });
  }

  await context.audit({
    action: 'job.imported',
    targetType: 'job',
    metadata: { source: 'manual', company: normalized.companyName },
    summary: `Offre ajoutée manuellement : ${normalized.title} — ${normalized.companyName}`,
  });

  return normalized;
}
