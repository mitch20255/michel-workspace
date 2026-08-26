import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { KeywordGapReport } from '@boussole/core';
import { jobRowToDomain } from '@boussole/db';
import { LlmGateway, buildInterviewPrep } from '@boussole/llm';
import { decrypt } from '@boussole/core/server';
import type { AppContext } from '../context.js';
import { loadProfile, loadSettings } from '../context.js';
import { notFound } from '../errors.js';

export async function registerInterviewRoutes(
  app: FastifyInstance,
  context: AppContext,
): Promise<void> {
  /**
   * Préparation d'entretien.
   *
   * Répond toujours, avec ou sans modèle de langage. Quand aucun modèle n'est
   * disponible, `llmUnavailableReason` explique pourquoi et le socle
   * déterministe est renvoyé — l'utilisateur n'obtient jamais une page vide.
   */
  app.get('/jobs/:id/interview-prep', async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const profile = await loadProfile(context);
    const row = await context.prisma.job.findUnique({
      where: { id },
      include: { scores: { where: { profileId: profile.id } } },
    });
    if (!row) throw notFound('Offre');

    const job = jobRowToDomain(row);
    const keywordGap = row.scores[0]?.keywordGap as KeywordGapReport | undefined;

    const gateway = await buildGateway(context, profile);
    return buildInterviewPrep(job, profile, gateway, keywordGap);
  });
}

/**
 * Construit la passerelle à partir des paramètres enregistrés.
 *
 * La clé BYOK est déchiffrée ici, au dernier moment, et n'est jamais renvoyée
 * par l'API ni journalisée.
 */
export async function buildGateway(
  context: AppContext,
  profile: Awaited<ReturnType<typeof loadProfile>>,
): Promise<LlmGateway> {
  const settings = await loadSettings(context);

  const apiKey = settings.llmApiKey
    ? decrypt(settings.llmApiKey, context.encryptionKey)
    : undefined;

  return new LlmGateway({
    provider: settings.llmProvider as never,
    model: settings.llmModel ?? undefined,
    apiKey,
    consent: settings.llmConsent,
    profile,
    maxPromptChars: context.config.LLM_MAX_PROMPT_CHARS,
    onAudit: async (event) => {
      await context.audit({
        action: event.action,
        actor: event.actor,
        metadata: event.metadata,
        summary: event.summary,
      });
    },
  });
}
