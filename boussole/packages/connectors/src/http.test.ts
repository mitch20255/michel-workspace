import { beforeEach, describe, expect, it } from 'vitest';
import { ConnectorError } from './types.js';
import { fetchWithPolicy, resetRateLimitState } from './http.js';
import { mockFetch, testContext } from './testing/mockFetch.js';

beforeEach(() => {
  resetRateLimitState();
});

const OPTIONS = { provider: 'greenhouse' as const, boardToken: 'test' };

describe('fetchWithPolicy — succès', () => {
  it('retourne le JSON analysé', async () => {
    const mock = mockFetch('{"ok":true}');
    const result = await fetchWithPolicy<{ ok: boolean }>(
      'https://exemple.test/a',
      testContext(mock.fetch),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
  });

  it('retourne le texte brut en mode texte', async () => {
    const mock = mockFetch('<xml/>');
    const result = await fetchWithPolicy<string>(
      'https://exemple.test/b',
      testContext(mock.fetch),
      { ...OPTIONS, as: 'text' },
    );
    expect(result).toBe('<xml/>');
  });

  it('envoie un User-Agent identifiant', async () => {
    const mock = mockFetch('{}');
    await fetchWithPolicy('https://exemple.test/c', testContext(mock.fetch), OPTIONS);

    const headers = mock.calls[0]?.init?.headers as Record<string, string>;
    expect(headers['user-agent']).toContain('Boussole');
  });
});

describe('fetchWithPolicy — erreurs', () => {
  it('signale un tableau d’offres introuvable comme non réessayable', async () => {
    const mock = mockFetch('not found', { status: 404 });
    await expect(
      fetchWithPolicy('https://exemple.test/d', testContext(mock.fetch), OPTIONS),
    ).rejects.toMatchObject({
      name: 'ConnectorError',
      details: { status: 404, retryable: false },
    });
  });

  it('ne tente jamais de contourner un accès refusé', async () => {
    const mock = mockFetch('forbidden', { status: 403 });
    const error = await fetchWithPolicy(
      'https://exemple.test/e',
      testContext(mock.fetch),
      OPTIONS,
    ).catch((e: unknown) => e as ConnectorError);

    expect(error).toBeInstanceOf(ConnectorError);
    expect((error as ConnectorError).message).toContain('ne tente pas de contourner');
    // Un seul appel : aucun réessai déguisé en contournement.
    expect(mock.calls).toHaveLength(1);
  });

  it('réessaie sur une erreur serveur puis réussit', async () => {
    const mock = mockFetch('', {
      sequence: [
        { status: 503, body: 'indisponible', headers: { 'retry-after': '0' } },
        { status: 200, body: '{"ok":true}' },
      ],
    });
    const result = await fetchWithPolicy<{ ok: boolean }>(
      'https://exemple.test/f',
      testContext(mock.fetch),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(mock.calls).toHaveLength(2);
  });

  it('respecte l’en-tête Retry-After sur 429', async () => {
    const mock = mockFetch('', {
      sequence: [
        { status: 429, body: 'trop de requêtes', headers: { 'retry-after': '0' } },
        { status: 200, body: '{"ok":true}' },
      ],
    });
    await fetchWithPolicy('https://exemple.test/g', testContext(mock.fetch), OPTIONS);
    expect(mock.calls).toHaveLength(2);
  });

  it('abandonne après un nombre borné de tentatives', async () => {
    const mock = mockFetch('erreur', { status: 500, headers: { 'retry-after': '0' } });
    await expect(
      fetchWithPolicy('https://exemple.test/h', testContext(mock.fetch), OPTIONS),
    ).rejects.toBeInstanceOf(ConnectorError);
    // Borné : on ne martèle pas une API offerte gratuitement.
    expect(mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('marque une panne réseau comme réessayable', async () => {
    const failing = async () => {
      throw new Error('ECONNRESET');
    };
    const error = await fetchWithPolicy(
      'https://exemple.test/i',
      { fetch: failing, minDelayMs: 0, timeoutMs: 50 },
      OPTIONS,
    ).catch((e: unknown) => e as ConnectorError);

    expect((error as ConnectorError).details.retryable).toBe(true);
  });

  it('s’arrête immédiatement sur annulation externe', async () => {
    const controller = new AbortController();
    controller.abort();

    const failing = async () => {
      throw new Error('aborted');
    };
    const error = await fetchWithPolicy(
      'https://exemple.test/j',
      { fetch: failing, minDelayMs: 0, timeoutMs: 50, signal: controller.signal },
      OPTIONS,
    ).catch((e: unknown) => e as ConnectorError);

    expect((error as ConnectorError).message).toContain('annulée');
    expect((error as ConnectorError).details.retryable).toBe(false);
  });
});

describe('fetchWithPolicy — politesse', () => {
  it('espace deux requêtes vers le même hôte', async () => {
    const mock = mockFetch('{}');
    const context = { fetch: mock.fetch, minDelayMs: 60, timeoutMs: 1000 };

    const start = Date.now();
    await fetchWithPolicy('https://poli.test/1', context, OPTIONS);
    await fetchWithPolicy('https://poli.test/2', context, OPTIONS);
    const elapsed = Date.now() - start;

    // Ces API sont offertes gratuitement : les marteler ferait fermer l'accès.
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});
