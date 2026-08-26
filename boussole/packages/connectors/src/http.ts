import type { AtsProvider } from '@boussole/core';
import { ConnectorError, type ConnectorContext } from './types.js';

/**
 * Client HTTP poli.
 *
 * « Poli » n'est pas de la décoration : ces API sont offertes gratuitement par
 * les ATS. Les marteler ferait fermer l'accès pour tout le monde. D'où :
 *  - un délai minimum entre deux requêtes vers le même hôte ;
 *  - un User-Agent identifiant et joignable ;
 *  - le respect de `Retry-After` sur 429 et 503 ;
 *  - un nombre de tentatives volontairement bas.
 *
 * Aucune tentative de contourner une limite de débit ou une protection
 * anti-bot : un 403 persistant est une réponse, pas un obstacle à franchir.
 */

const DEFAULT_MIN_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_USER_AGENT = 'Boussole/0.1 (assistant personnel de recherche d’emploi)';
const MAX_ATTEMPTS = 3;
/** Au-delà, on abandonne plutôt que d'attendre : l'ingestion est réessayable. */
const MAX_RETRY_AFTER_MS = 30000;

/** Dernière requête émise par hôte, pour espacer les appels. */
const lastRequestAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit(url: string, minDelayMs: number): Promise<void> {
  const host = new URL(url).host;
  const last = lastRequestAt.get(host);
  const now = Date.now();
  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < minDelayMs) await sleep(minDelayMs - elapsed);
  }
  lastRequestAt.set(host, Date.now());
}

/** Remet à zéro l'état de limitation. Réservé aux tests. */
export function resetRateLimitState(): void {
  lastRequestAt.clear();
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
  }
  return undefined;
}

/** 408, 429 et 5xx sont transitoires ; 4xx (hors ces deux-là) ne le sont pas. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

export interface FetchJsonOptions {
  provider: AtsProvider;
  boardToken: string;
  /** `json` par défaut ; `text` pour les flux XML. */
  as?: 'json' | 'text';
}

/**
 * Récupère une ressource distante avec politesse, réessais et diagnostics.
 *
 * @throws {ConnectorError} avec `retryable` renseigné, pour que l'appelant
 *         puisse distinguer « à réessayer » de « configuration erronée ».
 */
export async function fetchWithPolicy<T>(
  url: string,
  context: ConnectorContext,
  options: FetchJsonOptions,
): Promise<T> {
  const {
    fetch: fetchImpl,
    minDelayMs = DEFAULT_MIN_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent = DEFAULT_USER_AGENT,
    signal,
  } = context;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await respectRateLimit(url, minDelayMs);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Une annulation externe (arrêt du serveur) doit interrompre la requête.
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: options.as === 'text' ? 'application/xml, text/xml' : 'application/json',
          'user-agent': userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        if (retryable && attempt < MAX_ATTEMPTS) {
          const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
          // Repli exponentiel si le serveur n'indique pas de délai.
          await sleep(retryAfter ?? 500 * 2 ** (attempt - 1));
          continue;
        }
        throw new ConnectorError(describeStatus(response.status, options), {
          provider: options.provider,
          boardToken: options.boardToken,
          status: response.status,
          retryable,
        });
      }

      return options.as === 'text'
        ? ((await response.text()) as T)
        : ((await response.json()) as T);
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      lastError = error;

      // Une annulation demandée par l'appelant n'est pas un échec à réessayer.
      if (signal?.aborted) {
        throw new ConnectorError('Ingestion annulée.', {
          provider: options.provider,
          boardToken: options.boardToken,
          retryable: false,
          cause: error,
        });
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  throw new ConnectorError(
    `Impossible de joindre ${new URL(url).host} après ${MAX_ATTEMPTS} tentatives.`,
    {
      provider: options.provider,
      boardToken: options.boardToken,
      retryable: true,
      cause: lastError,
    },
  );
}

function describeStatus(status: number, options: FetchJsonOptions): string {
  switch (status) {
    case 404:
      return `Tableau d'offres « ${options.boardToken} » introuvable chez ${options.provider}. Vérifier l'identifiant.`;
    case 401:
    case 403:
      // Cas explicitement non contourné : on le signale et on s'arrête.
      return `Accès refusé par ${options.provider} (HTTP ${status}). Ce tableau d'offres n'est pas public ; Boussole ne tente pas de contourner cette restriction.`;
    case 429:
      return `Limite de débit atteinte chez ${options.provider}. Réessayer plus tard.`;
    default:
      return `Réponse HTTP ${status} de ${options.provider} pour « ${options.boardToken} ».`;
  }
}
