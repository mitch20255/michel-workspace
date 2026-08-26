import { z } from 'zod';

/**
 * Contrat commun des fournisseurs de modèles de langage.
 *
 * Principes du module :
 *
 * 1. **Désactivé par défaut.** Le fournisseur `none` est le défaut. Tant qu'il
 *    est actif, aucune donnée ne quitte la machine — ce n'est pas une option de
 *    configuration à cocher, c'est l'état initial.
 * 2. **BYOK.** La clé appartient à l'utilisateur, est chiffrée au repos et
 *    n'est jamais journalisée.
 * 3. **Consentement explicite.** Configurer un fournisseur ne suffit pas :
 *    l'utilisateur doit accepter séparément que ses données partent chez un
 *    tiers. Deux gestes distincts pour deux décisions distinctes.
 * 4. **Aucun repli silencieux.** Si le fournisseur local échoue, on échoue.
 *    Basculer vers un service en nuage sans le dire serait une fuite.
 */

export const LlmProviderIdSchema = z.enum(['none', 'anthropic', 'openai', 'ollama']);
export type LlmProviderId = z.infer<typeof LlmProviderIdSchema>;

export const LlmMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type LlmMessage = z.infer<typeof LlmMessageSchema>;

export interface LlmRequest {
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
  /** Identifiant de la tâche, journalisé pour l'audit. Jamais le contenu. */
  purpose: LlmPurpose;
}

/**
 * Usages autorisés. Liste fermée volontairement : elle sert de documentation
 * exhaustive de ce pour quoi Boussole peut appeler un modèle, et rend visible
 * en revue de code tout nouvel usage introduit.
 */
export const LLM_PURPOSES = [
  'interview_questions',
  'interview_feedback',
  'bullet_rewrite',
  'letter_draft',
  'job_summary',
] as const;

export const LlmPurposeSchema = z.enum(LLM_PURPOSES);
export type LlmPurpose = z.infer<typeof LlmPurposeSchema>;

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  provider: LlmProviderId;
  usage: LlmUsage;
  /** Vrai si le traitement est resté sur la machine de l'utilisateur. */
  local: boolean;
}

export interface LlmProviderConfig {
  provider: LlmProviderId;
  model?: string;
  /** Clé déchiffrée. Ne doit jamais être journalisée ni renvoyée par l'API. */
  apiKey?: string;
  baseUrl?: string;
  /** Refuse tout prompt plus long, pour éviter un envoi massif accidentel. */
  maxPromptChars?: number;
  timeoutMs?: number;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly label: string;
  /** Vrai si le traitement reste sur la machine de l'utilisateur. */
  readonly local: boolean;
  /** Modèle utilisé faute de choix explicite. */
  readonly defaultModel: string;
  complete(request: LlmRequest, config: LlmProviderConfig): Promise<LlmResponse>;
}

export class LlmDisabledError extends Error {
  constructor() {
    super(
      "Aucun fournisseur de modèle n'est configuré. Boussole fonctionne sans modèle de langage : " +
        'la préparation d’entretien et la génération documentaire ont des versions déterministes. ' +
        'Pour activer un modèle, configurer un fournisseur et accepter explicitement l’envoi de données.',
    );
    this.name = 'LlmDisabledError';
  }
}

export class LlmConsentError extends Error {
  constructor(provider: LlmProviderId) {
    super(
      `Le fournisseur « ${provider} » est configuré mais vous n'avez pas encore accepté l'envoi de vos données à un service externe. ` +
        'Cette acceptation est distincte de la configuration : configurer une clé ne vaut pas consentement.',
    );
    this.name = 'LlmConsentError';
  }
}

export class LlmPayloadTooLargeError extends Error {
  constructor(size: number, limit: number) {
    super(
      `Prompt de ${size} caractères, au-delà de la limite de ${limit}. ` +
        'Cette limite existe pour empêcher un envoi massif accidentel de données personnelles.',
    );
    this.name = 'LlmPayloadTooLargeError';
  }
}

export class LlmPiiLeakError extends Error {
  constructor(readonly violations: string[]) {
    super(
      `Envoi bloqué : la charge utile contient des données identifiantes (${violations.join(', ')}). ` +
        'Boussole minimise systématiquement ce qui part vers un tiers ; ceci est une erreur de programmation, pas une configuration.',
    );
    this.name = 'LlmPiiLeakError';
  }
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly details: { provider: LlmProviderId; status?: number; retryable: boolean },
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
