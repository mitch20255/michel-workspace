import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ConnectorError } from '@boussole/connectors';
import { GuardrailError } from '@boussole/documents';
import {
  LlmConsentError,
  LlmDisabledError,
  LlmPayloadTooLargeError,
  LlmPiiLeakError,
  LlmProviderError,
} from '@boussole/llm';
import { DecryptionError } from '@boussole/core/server';

/**
 * Traduction des erreurs du domaine en réponses HTTP.
 *
 * Deux règles :
 *
 * 1. **Le message destiné à l'utilisateur est en français et actionnable.**
 *    « Génération refusée : Terraform n'apparaît pas dans votre profil » est
 *    utile ; « 500 Internal Server Error » ne l'est pas.
 * 2. **Aucun détail interne ne fuit.** Les traces d'exécution partent dans les
 *    journaux du serveur, jamais dans la réponse : elles révèlent la structure
 *    du code et parfois des données.
 */

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    /** Détails structurés, sûrs à afficher (violations de garde-fous, etc.). */
    details?: unknown;
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} introuvable.`);

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'bad_request', message, details);

export const conflict = (message: string) => new HttpError(409, 'conflict', message);

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    const { status, body } = translate(error);

    // Les 5xx sont des anomalies : on les journalise intégralement côté
    // serveur. Les 4xx sont des usages incorrects attendus, un niveau warn
    // suffit et évite de noyer les journaux.
    if (status >= 500) {
      request.log.error({ err: error, url: request.url }, 'Erreur non gérée');
    } else {
      request.log.warn({ code: body.error.code, url: request.url }, body.error.message);
    }

    void reply.status(status).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: { code: 'not_found', message: `Route inconnue : ${request.method} ${request.url}` },
    } satisfies ErrorBody);
  });
}

function translate(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'validation_error',
          message: 'Les données envoyées sont invalides.',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  // --- Erreurs du domaine ------------------------------------------------

  if (error instanceof GuardrailError) {
    // 422 et non 400 : la requête est bien formée, c'est le résultat qui est
    // refusé. La distinction compte pour l'interface, qui doit afficher les
    // violations plutôt qu'un message de validation de formulaire.
    return {
      status: 422,
      body: {
        error: {
          code: 'guardrail_violation',
          message: error.message,
          details: error.report.violations,
        },
      },
    };
  }

  if (error instanceof LlmDisabledError) {
    return { status: 409, body: { error: { code: 'llm_disabled', message: error.message } } };
  }
  if (error instanceof LlmConsentError) {
    return {
      status: 403,
      body: { error: { code: 'llm_consent_required', message: error.message } },
    };
  }
  if (error instanceof LlmPiiLeakError) {
    return {
      status: 500,
      body: {
        error: {
          code: 'llm_pii_blocked',
          message: error.message,
          details: { categories: error.violations },
        },
      },
    };
  }
  if (error instanceof LlmPayloadTooLargeError) {
    return {
      status: 413,
      body: { error: { code: 'llm_payload_too_large', message: error.message } },
    };
  }
  if (error instanceof LlmProviderError) {
    return {
      status: error.details.retryable ? 503 : 502,
      body: { error: { code: 'llm_provider_error', message: error.message } },
    };
  }

  if (error instanceof ConnectorError) {
    return {
      status: error.details.retryable ? 503 : 502,
      body: {
        error: {
          code: 'connector_error',
          message: error.message,
          details: { provider: error.details.provider, retryable: error.details.retryable },
        },
      },
    };
  }

  if (error instanceof DecryptionError) {
    // Presque toujours une clé de chiffrement changée ou perdue. Le dire
    // explicitement évite des heures de recherche.
    return {
      status: 500,
      body: {
        error: {
          code: 'decryption_failed',
          message:
            "Déchiffrement impossible. La clé ENCRYPTION_KEY a probablement changé depuis l'enregistrement des données.",
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'internal_error',
        // Le message d'origine reste dans les journaux, pas dans la réponse.
        message: 'Erreur interne. Consulter les journaux du serveur pour le détail.',
      },
    },
  };
}
