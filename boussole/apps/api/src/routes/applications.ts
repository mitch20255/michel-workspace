import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PipelineStageSchema } from '@boussole/core';
import type { AppContext } from '../context.js';
import { loadProfile } from '../context.js';
import { notFound } from '../errors.js';
import {
  addNote,
  addReminder,
  changeStage,
  createApplication,
  loadBoard,
  loadStats,
} from '../services/applications.js';

export async function registerApplicationRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  app.get('/board', async () => {
    const profile = await loadProfile(context);
    return loadBoard(context, profile.id);
  });

  app.get('/stats', async () => {
    const profile = await loadProfile(context);
    return loadStats(context, profile.id);
  });

  app.get('/applications/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const application = await context.prisma.application.findFirst({
      where: { id, userId: context.userId },
      include: {
        job: true,
        notes: { orderBy: { createdAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' } },
        reminders: { orderBy: { dueAt: 'asc' } },
        documents: {
          select: {
            id: true,
            kind: true,
            version: true,
            language: true,
            pdfPath: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!application) throw notFound('Candidature');

    return application;
  });

  app.post('/applications', async (request, reply) => {
    const input = z
      .object({ jobId: z.string().min(1), stage: PipelineStageSchema.optional() })
      .parse(request.body);

    const profile = await loadProfile(context);
    const application = await createApplication(context, {
      jobId: input.jobId,
      profileId: profile.id,
      stage: input.stage,
    });

    void reply.status(201);
    return application;
  });

  /**
   * Changement d'étape.
   *
   * Point important du produit : **aucune candidature n'est marquée « soumise »
   * automatiquement.** Cette route est le seul chemin vers l'étape `applied`,
   * et elle est toujours déclenchée par un geste explicite de l'utilisateur.
   */
  app.patch('/applications/:id/stage', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({ stage: PipelineStageSchema, message: z.string().optional() })
      .parse(request.body);

    return changeStage(context, id, input.stage, input.message);
  });

  app.post('/applications/:id/notes', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ body: z.string().min(1) }).parse(request.body);

    void reply.status(201);
    return addNote(context, id, input.body);
  });

  app.post('/applications/:id/reminders', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z
      .object({ label: z.string().min(1), dueAt: z.iso.datetime() })
      .parse(request.body);

    void reply.status(201);
    return addReminder(context, id, { label: input.label, dueAt: new Date(input.dueAt) });
  });

  /** Rappels échus ou à venir : alimente le tableau de bord. */
  app.get('/reminders', async (request) => {
    const query = z
      .object({ days: z.coerce.number().int().min(0).max(365).default(14) })
      .parse(request.query);

    const horizon = new Date(Date.now() + query.days * 24 * 60 * 60 * 1000);

    return context.prisma.reminder.findMany({
      where: {
        done: false,
        dueAt: { lte: horizon },
        application: { userId: context.userId },
      },
      include: {
        application: {
          select: {
            id: true,
            stage: true,
            job: { select: { title: true, companyName: true } },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  });

  app.patch('/reminders/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ done: z.boolean() }).parse(request.body);

    const reminder = await context.prisma.reminder.findFirst({
      where: { id, application: { userId: context.userId } },
    });
    if (!reminder) throw notFound('Rappel');

    return context.prisma.reminder.update({
      where: { id },
      data: { done: input.done, doneAt: input.done ? new Date() : null },
    });
  });
}
