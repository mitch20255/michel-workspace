import type { FastifyInstance } from 'fastify';
import { isTypstAvailable } from '@boussole/documents';
import { listConnectors } from '@boussole/connectors';
import type { AppContext } from '../context.js';
import { loadSettings } from '../context.js';

/**
 * Sondes de disponibilité.
 *
 * `/health` est volontairement accessible sans jeton : une sonde qui exige un
 * secret n'est pas utilisable par un superviseur. Elle ne révèle rien de
 * personnel — uniquement l'état des dépendances techniques.
 */
export async function registerHealthRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  app.get('/health', async () => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await context.prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch (error) {
      checks.database = {
        ok: false,
        detail: error instanceof Error ? error.message : 'inaccessible',
      };
    }

    const typstOk = await isTypstAvailable({ binary: context.config.TYPST_BIN });
    checks.typst = {
      ok: typstOk,
      // L'absence de Typst n'est pas une panne : mode dégradé documenté.
      detail: typstOk ? undefined : 'PDF indisponible ; sources et texte restent produits.',
    };

    const healthy = checks.database?.ok === true;

    return {
      status: healthy ? 'ok' : 'degraded',
      version: '0.1.0',
      checks,
    };
  });

  /** État de la configuration, sans jamais révéler de secret. */
  app.get('/status', async () => {
    const settings = await loadSettings(context);
    const [jobCount, activeJobCount, applicationCount, sourceCount] = await Promise.all([
      context.prisma.job.count(),
      context.prisma.job.count({ where: { status: 'active' } }),
      context.prisma.application.count({ where: { userId: context.userId } }),
      context.prisma.jobSource.count({ where: { userId: context.userId } }),
    ]);

    return {
      llm: {
        provider: settings.llmProvider,
        model: settings.llmModel,
        consent: settings.llmConsent,
        // Présence de la clé seulement : jamais la clé, ni un fragment.
        hasApiKey: Boolean(settings.llmApiKey),
      },
      connectors: listConnectors().map((connector) => ({
        id: connector.id,
        label: connector.label,
        boardHint: connector.boardHint,
        apiDocsUrl: connector.apiDocsUrl,
      })),
      counts: {
        jobs: jobCount,
        activeJobs: activeJobCount,
        applications: applicationCount,
        sources: sourceCount,
      },
    };
  });
}
