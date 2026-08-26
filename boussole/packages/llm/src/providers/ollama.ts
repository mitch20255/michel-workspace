import {
  LlmProviderError,
  type LlmProvider,
  type LlmProviderConfig,
  type LlmRequest,
  type LlmResponse,
} from '../types.js';

/**
 * Fournisseur Ollama — exécution locale.
 *
 * C'est l'option la plus protectrice de la vie privée : aucune donnée ne
 * quitte la machine, aucune clé n'est nécessaire, aucun tiers n'observe le
 * profil du candidat. `local: true` est propagé jusqu'à l'interface pour que
 * l'utilisateur voie, à chaque appel, si ses données sont sorties ou non.
 */

const DEFAULT_MODEL = 'llama3.1';
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

interface OllamaChatResponse {
  model?: string;
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

export const ollamaProvider: LlmProvider = {
  id: 'ollama',
  label: 'Ollama (modèle local)',
  local: true,
  defaultModel: DEFAULT_MODEL,

  async complete(request: LlmRequest, config: LlmProviderConfig): Promise<LlmResponse> {
    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = config.model ?? DEFAULT_MODEL;

    const messages = [
      ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
      ...request.messages,
    ];

    const controller = new AbortController();
    // Un modèle local sur processeur est lent : le délai par défaut est
    // volontairement large, sinon la génération est coupée avant la fin.
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 180000);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { num_predict: request.maxTokens ?? 4000 },
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as OllamaChatResponse;

      if (!response.ok) {
        throw new LlmProviderError(
          `Erreur Ollama (HTTP ${response.status})${payload.error ? ` : ${payload.error}` : ''}`,
          {
            provider: 'ollama',
            status: response.status,
            retryable: response.status >= 500,
          },
        );
      }

      return {
        text: payload.message?.content?.trim() ?? '',
        model: payload.model ?? model,
        provider: 'ollama',
        local: true,
        usage: {
          inputTokens: payload.prompt_eval_count,
          outputTokens: payload.eval_count,
        },
      };
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError(
        `Ollama injoignable sur ${baseUrl}. Vérifier qu'il est démarré (« ollama serve »).`,
        { provider: 'ollama', retryable: true },
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
