import type { FetchLike } from '@boussole/connectors';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConnector, listConnectors } from '@boussole/connectors';
import type { AppContext } from '../context.js';
import { badRequest, notFound } from '../errors.js';
import { runAllSources, runIngestion } from '../services/ingestion.js';

const CreateSourceInput = z.object({
  provider: z.string().min(1),
  boardToken: z.string().min(1),
  label: z.string().optional(),
  enabled: z.boolean().default(true),
});

export async function registerSourceRoutes(
  app: FastifyInstance,
  context: AppContext,
  fetchImpl: FetchLike,
): Promise<void> {
  app.get('/connectors', async () =>
    listConnectors().map((connector) => ({
      id: connector.id,
      label: connector.label,
      boardHint: connector.boardHint,
      apiDocsUrl: connector.apiDocsUrl,
    })),
  );

  app.get('/sources', async () =>
    context.prisma.jobSource.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: 'asc' },
      include: {
        runs: { orderBy: { startedAt: 'desc' }, take: 5 },
      },
    }),
  );

  app.post('/sources', async (request, reply) => {
    const input = CreateSourceInput.parse(request.body);

    if (!getConnector(input.provider)) {
      throw badRequest(
        `Fournisseur « ${input.provider} » non pris en charge. Disponibles : ${listConnectors()
          .map((connector) => connector.id)
          .join(', ')}.`,
      );
    }

    const source = await context.prisma.jobSource.upsert({
      where: {
        userId_provider_boardToken: {
          userId: context.userId,
          provider: input.provider,
          boardToken: input.boardToken,
        },
      },
      create: { ...input, userId: context.userId },
      update: { label: input.label, enabled: input.enabled },
    });

    void reply.status(201);
    return source;
  });

  app.delete('/sources/:id', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const source = await context.prisma.jobSource.findFirst({
      where: { id, userId: context.userId },
    });
    if (!source) throw notFound("Source d'offres");

    await context.prisma.jobSource.delete({ where: { id } });
    return { deleted: true };
  });

  /**
   * Ingestion d'une source.
   *
   * Synchrone dans le MVP : une source publie quelques dizaines à quelques
   * centaines d'offres, ce qui tient dans une requête HTTP. Une file d'attente
   * (Redis/BullMQ) est prévue en V1, quand l'ingestion sera planifiée plutôt
   * que déclenchée à la main — l'infrastructure est déjà dans le
   * docker-compose.
   */
  app.post('/sources/:id/ingest', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return runIngestion(context, id, fetchImpl);
  });

  app.post('/sources/ingest-all', async () => {
    const summaries = await runAllSources(context, fetchImpl);
    return {
      summaries,
      // Récapitulatif : une source en échec ne doit pas passer inaperçue au
      // milieu de dix succès.
      failed: summaries.filter((summary) => summary.status === 'failed').length,
      created: summaries.reduce((sum, summary) => sum + summary.created, 0),
      updated: summaries.reduce((sum, summary) => sum + summary.updated, 0),
    };
  });
}
