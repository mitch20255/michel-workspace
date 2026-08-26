import { canTransition, STAGE_LABELS_FR, type PipelineStage } from '@boussole/core';
import { jobRowToDomain } from '@boussole/db';
import type { AppContext } from '../context.js';
import { badRequest, conflict, notFound } from '../errors.js';

/**
 * Service CRM.
 *
 * Deux garanties :
 *
 * 1. **Chaque changement d'étape laisse une trace.** Un CRM sans historique ne
 *    répond pas à « quand ai-je postulé ? » ni à « depuis combien de temps
 *    est-ce sans nouvelles ? », qui sont les deux questions qu'on lui pose.
 * 2. **Les transitions absurdes sont refusées.** Passer de « à examiner » à
 *    « offre » rendrait toute statistique de conversion ininterprétable.
 *    Le rejet et l'archivage restent possibles depuis n'importe quelle étape :
 *    une candidature peut mourir à tout moment.
 */

export async function createApplication(
  context: AppContext,
  input: { jobId: string; profileId: string; stage?: PipelineStage },
) {
  const job = await context.prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job) throw notFound('Offre');

  const existing = await context.prisma.application.findUnique({
    where: { profileId_jobId: { profileId: input.profileId, jobId: input.jobId } },
  });
  if (existing) {
    throw conflict('Une candidature existe déjà pour cette offre et ce profil.');
  }

  const score = await context.prisma.jobScore.findUnique({
    where: { jobId_profileId: { jobId: input.jobId, profileId: input.profileId } },
  });

  const application = await context.prisma.application.create({
    data: {
      userId: context.userId,
      jobId: input.jobId,
      profileId: input.profileId,
      stage: input.stage ?? 'to_review',
      // Copie de l'offre : les ATS retirent les annonces, et sans copie locale
      // le contexte de sa propre candidature disparaît.
      jobSnapshot: jobRowToDomain(job) as object,
      scoreAtShortlist: score?.score ?? null,
      events: {
        create: {
          type: 'stage_changed',
          toStage: input.stage ?? 'to_review',
          actor: 'user',
          message: 'Candidature créée',
        },
      },
    },
    include: { events: true },
  });

  await context.audit({
    action: 'application.created',
    targetType: 'application',
    targetId: application.id,
    metadata: { jobId: input.jobId, stage: application.stage },
    summary: `Candidature créée : ${job.title} — ${job.companyName}`,
  });

  return application;
}

export async function changeStage(
  context: AppContext,
  applicationId: string,
  toStage: PipelineStage,
  message?: string,
) {
  const application = await context.prisma.application.findFirst({
    where: { id: applicationId, userId: context.userId },
    include: { job: true },
  });
  if (!application) throw notFound('Candidature');

  const fromStage = application.stage as PipelineStage;

  if (!canTransition(fromStage, toStage)) {
    throw badRequest(
      `Transition refusée : « ${STAGE_LABELS_FR[fromStage]} » → « ${STAGE_LABELS_FR[toStage]} ». ` +
        'Les statistiques du CRM ne seraient plus interprétables. Passer par les étapes intermédiaires.',
    );
  }

  // `appliedAt` marque le moment de la soumission — jamais renseigné
  // automatiquement ailleurs : c'est l'utilisateur qui déclare avoir postulé.
  const appliedAt =
    toStage === 'applied' && !application.appliedAt ? new Date() : application.appliedAt;

  const updated = await context.prisma.application.update({
    where: { id: applicationId },
    data: {
      stage: toStage,
      appliedAt,
      events: {
        create: {
          type: toStage === 'applied' ? 'applied' : 'stage_changed',
          fromStage,
          toStage,
          message,
          actor: 'user',
        },
      },
    },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });

  await context.audit({
    action: toStage === 'applied' ? 'application.marked_applied' : 'application.stage_changed',
    targetType: 'application',
    targetId: applicationId,
    metadata: { from: fromStage, to: toStage },
    summary: `${application.job.title} : ${STAGE_LABELS_FR[fromStage]} → ${STAGE_LABELS_FR[toStage]}`,
  });

  return updated;
}

export async function addNote(context: AppContext, applicationId: string, body: string) {
  const application = await context.prisma.application.findFirst({
    where: { id: applicationId, userId: context.userId },
  });
  if (!application) throw notFound('Candidature');

  return context.prisma.applicationNote.create({ data: { applicationId, body } });
}

export async function addReminder(
  context: AppContext,
  applicationId: string,
  input: { label: string; dueAt: Date },
) {
  const application = await context.prisma.application.findFirst({
    where: { id: applicationId, userId: context.userId },
  });
  if (!application) throw notFound('Candidature');

  const reminder = await context.prisma.reminder.create({
    data: { applicationId, label: input.label, dueAt: input.dueAt },
  });

  await context.prisma.application.update({
    where: { id: applicationId },
    data: { nextAction: input.label, nextActionDueAt: input.dueAt },
  });

  return reminder;
}

/** Tableau Kanban : les candidatures groupées par colonne. */
export async function loadBoard(context: AppContext, profileId?: string) {
  const applications = await context.prisma.application.findMany({
    where: { userId: context.userId, ...(profileId ? { profileId } : {}) },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
          locationRaw: true,
          remotePolicy: true,
          applyUrl: true,
          ghostScore: true,
          status: true,
        },
      },
      _count: { select: { notes: true, documents: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const scores = await context.prisma.jobScore.findMany({
    where: { jobId: { in: applications.map((application) => application.jobId) } },
    select: { jobId: true, profileId: true, score: true, decision: true },
  });
  const scoreByKey = new Map(scores.map((score) => [`${score.jobId}:${score.profileId}`, score]));

  const columns = Object.keys(STAGE_LABELS_FR) as PipelineStage[];

  return columns.map((stage) => ({
    stage,
    label: STAGE_LABELS_FR[stage],
    applications: applications
      .filter((application) => application.stage === stage)
      .map((application) => ({
        id: application.id,
        stage: application.stage,
        appliedAt: application.appliedAt,
        nextAction: application.nextAction,
        nextActionDueAt: application.nextActionDueAt,
        noteCount: application._count.notes,
        documentCount: application._count.documents,
        job: application.job,
        score: scoreByKey.get(`${application.jobId}:${application.profileId}`)?.score ?? null,
      })),
  }));
}

/** Statistiques simples du pipeline. */
export async function loadStats(context: AppContext, profileId?: string) {
  const where = { userId: context.userId, ...(profileId ? { profileId } : {}) };

  const [byStage, total, applied, interviews, offers] = await Promise.all([
    context.prisma.application.groupBy({ by: ['stage'], where, _count: true }),
    context.prisma.application.count({ where }),
    context.prisma.application.count({ where: { ...where, appliedAt: { not: null } } }),
    context.prisma.application.count({
      where: { ...where, stage: { in: ['interview', 'technical_test', 'offer'] } },
    }),
    context.prisma.application.count({ where: { ...where, stage: 'offer' } }),
  ]);

  return {
    total,
    applied,
    interviews,
    offers,
    // Taux calculés sur les candidatures réellement soumises : rapporter les
    // entretiens au total inclurait les offres jamais envoyées et donnerait
    // un taux artificiellement bas.
    interviewRate: applied === 0 ? null : Number((interviews / applied).toFixed(3)),
    offerRate: applied === 0 ? null : Number((offers / applied).toFixed(3)),
    byStage: byStage.map((entry) => ({
      stage: entry.stage,
      label: STAGE_LABELS_FR[entry.stage as PipelineStage] ?? entry.stage,
      count: entry._count,
    })),
  };
}
