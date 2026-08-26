import 'server-only';

/**
 * Client de l'API, **exclusivement côté serveur**.
 *
 * `import 'server-only'` fait échouer la compilation si ce module est importé
 * depuis un composant client. C'est délibéré : le jeton d'API donne accès à
 * l'intégralité des données personnelles, et il ne doit jamais atteindre le
 * navigateur. Toutes les lectures passent par des composants serveur, toutes
 * les écritures par des actions serveur.
 *
 * Conséquence assumée : pas de rafraîchissement optimiste côté client dans le
 * MVP. C'est un compromis en faveur de la simplicité et de la sécurité.
 */

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
const TOKEN = process.env.API_TOKEN ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /**
   * Durée de mise en cache, en secondes. `0` (défaut) = jamais.
   * Des données de candidature périmées induisent en erreur : on préfère un
   * aller-retour supplémentaire.
   */
  revalidate?: number;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!TOKEN) {
    throw new ApiError(
      500,
      'config',
      "API_TOKEN n'est pas défini côté web. Copier .env.example vers .env et renseigner le même jeton que l'API.",
    );
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(options.revalidate ? { next: { revalidate: options.revalidate } } : { cache: 'no-store' }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as ApiErrorBody)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'unknown',
      error?.message ?? `Erreur ${response.status}`,
      error?.details,
    );
  }

  return payload as T;
}

/**
 * Variante tolérante : renvoie `undefined` au lieu de lever.
 *
 * Utilisée par les pages qui doivent rester affichables même si une partie
 * des données manque — un tableau de bord ne doit pas devenir une page
 * d'erreur parce qu'aucun profil n'existe encore.
 */
export async function apiSafe<T>(path: string, options: ApiOptions = {}): Promise<T | undefined> {
  try {
    return await api<T>(path, options);
  } catch {
    return undefined;
  }
}
