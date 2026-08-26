import {
  LlmProviderError,
  type LlmProvider,
  type LlmProviderConfig,
  type LlmRequest,
  type LlmResponse,
} from '../types.js';

/**
 * Fournisseur compatible OpenAI.
 *
 * Appel HTTP direct plutôt que SDK : le point d'accès
 * `/v1/chat/completions` est stable depuis des années et implémenté à
 * l'identique par de nombreux services (Groq, Together, vLLM, LM Studio…).
 * Passer par `fetch` permet à l'utilisateur de pointer vers n'importe lequel
 * d'entre eux en changeant une URL, sans dépendance supplémentaire.
 */

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string };
}

export const openaiProvider: LlmProvider = {
  id: 'openai',
  label: 'OpenAI (ou service compatible)',
  local: false,
  defaultModel: DEFAULT_MODEL,

  async complete(request: LlmRequest, config: LlmProviderConfig): Promise<LlmResponse> {
    if (!config.apiKey) {
      throw new LlmProviderError('Clé API absente pour le fournisseur compatible OpenAI.', {
        provider: 'openai',
        retryable: false,
      });
    }

    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = config.model ?? DEFAULT_MODEL;

    const messages = [
      ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
      ...request.messages,
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 60000);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: request.maxTokens ?? 4000,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;

      if (!response.ok) {
        throw new LlmProviderError(
          `Erreur du fournisseur (HTTP ${response.status})${
            payload.error?.message ? ` : ${payload.error.message}` : ''
          }`,
          {
            provider: 'openai',
            status: response.status,
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      const text = payload.choices?.[0]?.message?.content?.trim() ?? '';

      return {
        text,
        model: payload.model ?? model,
        provider: 'openai',
        local: false,
        usage: {
          inputTokens: payload.usage?.prompt_tokens,
          outputTokens: payload.usage?.completion_tokens,
        },
      };
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError(
        `Appel au fournisseur impossible : ${error instanceof Error ? error.message : String(error)}`,
        { provider: 'openai', retryable: true },
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
