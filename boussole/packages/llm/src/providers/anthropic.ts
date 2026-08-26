import Anthropic from '@anthropic-ai/sdk';
import {
  LlmProviderError,
  type LlmProvider,
  type LlmProviderConfig,
  type LlmRequest,
  type LlmResponse,
} from '../types.js';

/**
 * Fournisseur Anthropic, via le SDK officiel.
 *
 * Le SDK est préféré à un appel HTTP direct : il porte la gestion des
 * réessais, les classes d'erreur typées et le suivi des évolutions de l'API.
 * Réimplémenter tout cela à la main serait une dette permanente pour un gain
 * nul.
 */

/**
 * Modèle par défaut. `claude-opus-5` est le modèle courant le plus capable de
 * la gamme ; l'utilisateur reste libre d'en choisir un moins coûteux dans les
 * paramètres, c'est sa décision, pas la nôtre.
 */
const DEFAULT_MODEL = 'claude-opus-5';

export const anthropicProvider: LlmProvider = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  local: false,
  defaultModel: DEFAULT_MODEL,

  async complete(request: LlmRequest, config: LlmProviderConfig): Promise<LlmResponse> {
    if (!config.apiKey) {
      throw new LlmProviderError('Clé API Anthropic absente.', {
        provider: 'anthropic',
        retryable: false,
      });
    }

    const client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      ...(config.timeoutMs ? { timeout: config.timeoutMs } : {}),
    });

    const model = config.model ?? DEFAULT_MODEL;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4000,
        // Réflexion adaptative : le modèle décide lui-même de la profondeur.
        // `budget_tokens` est refusé par les modèles récents.
        thinking: { type: 'adaptive' },
        // Les tâches visées (questions d'entretien, reformulation de puces)
        // ne demandent pas d'effort maximal ; `medium` suffit et coûte moins
        // cher à l'utilisateur, qui paie sa propre clé.
        output_config: { effort: 'medium' },
        ...(request.system ? { system: request.system } : {}),
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      // Un refus de sécurité n'est pas une panne : on le remonte tel quel pour
      // que l'interface l'explique au lieu d'afficher une erreur technique.
      if (response.stop_reason === 'refusal') {
        throw new LlmProviderError(
          `Le modèle a décliné la demande${
            response.stop_details && 'category' in response.stop_details
              ? ` (motif : ${String(response.stop_details.category)})`
              : ''
          }.`,
          { provider: 'anthropic', retryable: false },
        );
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return {
        text,
        model: response.model,
        provider: 'anthropic',
        local: false,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw toProviderError(error);
    }
  },
};

/**
 * Traduit les erreurs du SDK en erreurs du domaine.
 * On utilise les classes typées du SDK plutôt que des comparaisons de chaînes :
 * un message d'erreur peut changer, une classe non.
 */
function toProviderError(error: unknown): LlmProviderError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new LlmProviderError('Clé API Anthropic refusée. Vérifier la clé dans les paramètres.', {
      provider: 'anthropic',
      status: error.status,
      retryable: false,
    });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmProviderError('Limite de débit atteinte chez Anthropic. Réessayer plus tard.', {
      provider: 'anthropic',
      status: error.status,
      retryable: true,
    });
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new LlmProviderError(`Requête refusée par Anthropic : ${error.message}`, {
      provider: 'anthropic',
      status: error.status,
      retryable: false,
    });
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmProviderError(`Erreur Anthropic (HTTP ${error.status}) : ${error.message}`, {
      provider: 'anthropic',
      status: error.status,
      // Les 5xx et les coupures réseau valent la peine d'être réessayés.
      retryable: typeof error.status === 'number' && error.status >= 500,
    });
  }
  return new LlmProviderError(
    `Appel au modèle impossible : ${error instanceof Error ? error.message : String(error)}`,
    { provider: 'anthropic', retryable: true },
  );
}
