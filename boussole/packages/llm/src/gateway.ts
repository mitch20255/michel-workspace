import type { CandidateProfile } from '@boussole/core';
import { assertNoPii, buildAuditEvent, type AuditEvent } from '@boussole/core';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { ollamaProvider } from './providers/ollama.js';
import {
  LlmConsentError,
  LlmDisabledError,
  LlmPayloadTooLargeError,
  LlmPiiLeakError,
  type LlmProvider,
  type LlmProviderConfig,
  type LlmProviderId,
  type LlmRequest,
  type LlmResponse,
} from './types.js';

/**
 * Passerelle LLM : le **seul** chemin par lequel Boussole peut appeler un
 * modèle de langage.
 *
 * Aucun module applicatif n'appelle un fournisseur directement. Tout passe
 * ici, ce qui garantit que les quatre contrôles ci-dessous s'appliquent à
 * chaque appel, sans exception possible par oubli :
 *
 *  1. **Fournisseur actif ?** `none` par défaut → rien ne sort.
 *  2. **Consentement donné ?** Distinct de la configuration : avoir une clé
 *     ne vaut pas accord pour envoyer ses données.
 *  3. **Aucune PII ?** Contrôle mécanique de dernière ligne. Une fuite est
 *     alors une erreur bruyante, pas un envoi silencieux.
 *  4. **Taille bornée ?** Empêche l'envoi massif accidentel.
 *
 * Chaque appel produit un événement d'audit contenant l'usage, le fournisseur
 * et les compteurs de jetons — **jamais** le contenu du prompt.
 */

const PROVIDERS: Record<Exclude<LlmProviderId, 'none'>, LlmProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  ollama: ollamaProvider,
};

export function listProviders(): LlmProvider[] {
  return Object.values(PROVIDERS);
}

export function getProvider(id: LlmProviderId): LlmProvider | undefined {
  return id === 'none' ? undefined : PROVIDERS[id];
}

/** Limite par défaut. Volontairement basse : un prompt légitime tient dedans. */
const DEFAULT_MAX_PROMPT_CHARS = 24000;

export interface GatewayOptions extends LlmProviderConfig {
  /**
   * Consentement explicite de l'utilisateur à l'envoi de données vers un
   * service externe. Ignoré pour un fournisseur local, qui n'envoie rien.
   */
  consent: boolean;
  /**
   * Profil du candidat, utilisé pour vérifier qu'aucune donnée identifiante
   * ne figure dans la charge utile. Obligatoire : sans lui, le contrôle
   * anti-fuite ne peut pas s'exécuter.
   */
  profile: CandidateProfile;
  /** Réception des événements d'audit. */
  onAudit?: (event: AuditEvent) => void | Promise<void>;
  /**
   * Remplace le registre de fournisseurs. Sert aux tests, qui ne doivent
   * jamais appeler un service réel, et permettra d'ajouter un fournisseur
   * sans modifier la passerelle.
   */
  providers?: Partial<Record<LlmProviderId, LlmProvider>>;
}

export class LlmGateway {
  constructor(private readonly options: GatewayOptions) {}

  /** Résout un fournisseur en tenant compte du registre injecté. */
  private resolve(id: LlmProviderId): LlmProvider | undefined {
    return this.options.providers?.[id] ?? getProvider(id);
  }

  /** Vrai si un appel est possible en l'état actuel de la configuration. */
  isEnabled(): boolean {
    if (this.options.provider === 'none') return false;
    const provider = this.resolve(this.options.provider);
    if (!provider) return false;
    return provider.local || this.options.consent;
  }

  /** Explique en français pourquoi le modèle est indisponible, s'il l'est. */
  unavailableReason(): string | undefined {
    if (this.options.provider === 'none') return new LlmDisabledError().message;
    const provider = this.resolve(this.options.provider);
    if (!provider) return `Fournisseur inconnu : ${this.options.provider}`;
    if (!provider.local && !this.options.consent) {
      return new LlmConsentError(this.options.provider).message;
    }
    return undefined;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const { provider: providerId, profile, consent } = this.options;

    // --- 1. Fournisseur actif ---------------------------------------------
    if (providerId === 'none') {
      await this.audit('llm.disabled_by_policy', {
        purpose: request.purpose,
        reason: 'provider_none',
      });
      throw new LlmDisabledError();
    }

    const provider = this.resolve(providerId);
    if (!provider) {
      throw new LlmDisabledError();
    }

    // --- 2. Consentement ---------------------------------------------------
    // Un fournisseur local n'envoie rien : exiger un consentement pour un
    // traitement qui ne sort pas de la machine serait du théâtre.
    if (!provider.local && !consent) {
      await this.audit('llm.disabled_by_policy', {
        purpose: request.purpose,
        provider: providerId,
        reason: 'consent_missing',
      });
      throw new LlmConsentError(providerId);
    }

    const payload = [request.system ?? '', ...request.messages.map((m) => m.content)].join('\n');

    // --- 3. Taille ---------------------------------------------------------
    const limit = this.options.maxPromptChars ?? DEFAULT_MAX_PROMPT_CHARS;
    if (payload.length > limit) {
      throw new LlmPayloadTooLargeError(payload.length, limit);
    }

    // --- 4. Absence de PII -------------------------------------------------
    // Le contrôle s'applique aussi au fournisseur local : il coûte quelques
    // microsecondes et transforme une erreur de programmation en échec
    // bruyant plutôt qu'en habitude dangereuse.
    const violations = assertNoPii(payload, profile);
    if (violations.length > 0) {
      await this.audit('llm.disabled_by_policy', {
        purpose: request.purpose,
        provider: providerId,
        reason: 'pii_detected',
        // Les catégories, jamais les valeurs.
        categories: violations,
      });
      throw new LlmPiiLeakError(violations);
    }

    const startedAt = Date.now();
    const response = await provider.complete(request, this.options);

    await this.audit('llm.request', {
      purpose: request.purpose,
      provider: providerId,
      model: response.model,
      local: response.local,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      durationMs: Date.now() - startedAt,
      promptChars: payload.length,
    });

    return response;
  }

  private async audit(
    action: 'llm.request' | 'llm.disabled_by_policy',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.options.onAudit) return;
    await this.options.onAudit(
      buildAuditEvent({
        action,
        actor: 'system',
        metadata,
        summary:
          action === 'llm.request'
            ? `Appel au modèle (${String(metadata.provider)}) pour « ${String(metadata.purpose)} »${
                metadata.local === true ? ', en local' : ''
              }`
            : `Appel au modèle bloqué : ${String(metadata.reason)}`,
      }),
    );
  }
}
