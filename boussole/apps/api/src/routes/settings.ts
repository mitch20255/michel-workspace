import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEFAULT_WEIGHTS } from '@boussole/core';
import { IMPACT_TONE_CAVEATS_FR, IMPACT_TONE_LABELS_FR } from '@boussole/documents';
import { encrypt } from '@boussole/core/server';
import { LlmProviderIdSchema, listProviders } from '@boussole/llm';
import type { AppContext } from '../context.js';
import { loadSettings } from '../context.js';

const UpdateSettingsInput = z.object({
  llmProvider: LlmProviderIdSchema.optional(),
  llmModel: z.string().nullable().optional(),
  /** Clé BYOK en clair. Chiffrée immédiatement, jamais renvoyée ensuite. */
  llmApiKey: z.string().nullable().optional(),
  llmConsent: z.boolean().optional(),
  scoringWeights: z.record(z.string(), z.number()).optional(),
  documentTone: z.enum(['factual', 'confident', 'assertive']).optional(),
});

export async function registerSettingsRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  app.get('/settings', async () => {
    const settings = await loadSettings(context);

    return {
      llm: {
        provider: settings.llmProvider,
        model: settings.llmModel,
        consent: settings.llmConsent,
        // Jamais la clé, ni un fragment : sa seule présence est une
        // information suffisante pour l'interface.
        hasApiKey: Boolean(settings.llmApiKey),
        available: listProviders().map((provider) => ({
          id: provider.id,
          label: provider.label,
          local: provider.local,
          defaultModel: provider.defaultModel,
        })),
      },
      scoring: {
        weights:
          Object.keys((settings.scoringWeights ?? {}) as object).length > 0
            ? settings.scoringWeights
            : DEFAULT_WEIGHTS,
        defaults: DEFAULT_WEIGHTS,
      },
      documents: {
        tone: settings.documentTone,
        // Les mises en garde partent avec les libellés : un cadran dont on ne
        // voit que le nom des crans invite à monter au maximum sans savoir ce
        // que le dernier cran déplace.
        available: (['factual', 'confident', 'assertive'] as const).map((tone) => ({
          id: tone,
          label: IMPACT_TONE_LABELS_FR[tone],
          caveat: IMPACT_TONE_CAVEATS_FR[tone],
        })),
      },
    };
  });

  app.put('/settings', async (request) => {
    const input = UpdateSettingsInput.parse(request.body);
    const current = await loadSettings(context);

    /**
     * Changer de fournisseur réinitialise le consentement.
     *
     * Accepter d'envoyer ses données à un service ne vaut pas acceptation
     * pour un autre. Sans cette remise à zéro, basculer d'Ollama (local) vers
     * un service en nuage transporterait un consentement qui n'a jamais été
     * donné pour ce destinataire.
     */
    const providerChanged =
      input.llmProvider !== undefined && input.llmProvider !== current.llmProvider;

    const data: Record<string, unknown> = {};

    if (input.llmProvider !== undefined) data.llmProvider = input.llmProvider;
    if (input.llmModel !== undefined) data.llmModel = input.llmModel;
    if (input.scoringWeights !== undefined) data.scoringWeights = input.scoringWeights;
    if (input.documentTone !== undefined) data.documentTone = input.documentTone;

    if (input.llmApiKey !== undefined) {
      data.llmApiKey = input.llmApiKey ? encrypt(input.llmApiKey, context.encryptionKey) : null;
    }

    if (providerChanged) {
      data.llmConsent = false;
    }
    if (input.llmConsent !== undefined) {
      data.llmConsent = input.llmConsent;
    }

    const updated = await context.prisma.userSettings.update({
      where: { userId: context.userId },
      data,
    });

    if (input.llmApiKey) {
      await context.audit({
        action: 'llm.key_stored',
        metadata: { provider: updated.llmProvider },
        summary: `Clé API enregistrée pour ${updated.llmProvider}`,
      });
    }

    await context.audit({
      action: 'settings.updated',
      metadata: {
        llmProvider: updated.llmProvider,
        llmConsent: updated.llmConsent,
        consentResetByProviderChange: providerChanged && input.llmConsent === undefined,
        documentTone: updated.documentTone,
      },
      summary: 'Paramètres mis à jour',
    });

    return {
      llm: {
        provider: updated.llmProvider,
        model: updated.llmModel,
        consent: updated.llmConsent,
        hasApiKey: Boolean(updated.llmApiKey),
      },
      scoring: { weights: updated.scoringWeights },
      documents: { tone: updated.documentTone },
      ...(providerChanged && input.llmConsent === undefined
        ? {
            notice:
              'Le consentement a été réinitialisé : accepter un fournisseur ne vaut pas acceptation pour un autre.',
          }
        : {}),
    };
  });
}
