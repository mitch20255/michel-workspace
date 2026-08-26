import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConnectorContext, FetchLike } from '../types.js';

/**
 * Utilitaires de test.
 *
 * Les tests de connecteurs ne touchent jamais le réseau : une suite qui
 * interroge un ATS tiers échoue le jour où celui-ci modifie une offre, et
 * n'est plus un test mais une sonde de disponibilité.
 */

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

export interface MockFetchOptions {
  status?: number;
  headers?: Record<string, string>;
  /** Réponses successives : la dernière est répétée si les appels continuent. */
  sequence?: Array<{ status: number; body: string; headers?: Record<string, string> }>;
}

export interface MockFetch {
  fetch: FetchLike;
  /** URL de chaque appel, dans l'ordre. */
  calls: Array<{ url: string; init?: RequestInit }>;
}

export function mockFetch(body: string, options: MockFetchOptions = {}): MockFetch {
  const calls: MockFetch['calls'] = [];
  let index = 0;

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });

    const step = options.sequence?.[Math.min(index, options.sequence.length - 1)];
    index += 1;

    const status = step?.status ?? options.status ?? 200;
    const payload = step?.body ?? body;
    const headers = new Headers({
      'content-type': 'application/json',
      ...options.headers,
      ...step?.headers,
    });

    return new Response(payload, { status, headers });
  };

  return { fetch: fetchImpl, calls };
}

/** Contexte de test : aucune temporisation, pour garder la suite rapide. */
export function testContext(fetchImpl: FetchLike): ConnectorContext {
  return { fetch: fetchImpl, minDelayMs: 0, timeoutMs: 1000 };
}
