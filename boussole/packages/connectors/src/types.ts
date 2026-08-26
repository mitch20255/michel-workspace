import type { AtsProvider, RawJob } from '@boussole/core';

/**
 * Contrat commun des connecteurs.
 *
 * Trois règles qui découlent des contraintes du projet :
 *
 * 1. **Endpoints publics et documentés uniquement.** Aucun contournement de
 *    protection anti-bot, aucun scraping HTML quand une API structurée
 *    existe. Un connecteur qui ne peut pas respecter cette règle n'est pas
 *    implémenté (cas de Workday, voir docs/modules/ingestion.md).
 * 2. **`fetch` est injecté.** Les tests s'exécutent sur des fixtures, jamais
 *    sur le réseau : une suite de tests qui dépend d'un ATS tiers casse dès
 *    qu'ils modifient une offre.
 * 3. **Aucune authentification.** Ces connecteurs ne lisent que des pages
 *    d'emploi publiques. Aucun identifiant candidat n'est stocké ni transmis.
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ConnectorContext {
  fetch: FetchLike;
  /** Délai minimum entre deux requêtes vers le même hôte, en millisecondes. */
  minDelayMs?: number;
  timeoutMs?: number;
  userAgent?: string;
  /** Signal d'annulation propagé jusqu'à `fetch`. */
  signal?: AbortSignal;
}

export interface ConnectorResult {
  jobs: RawJob[];
  /** Anomalies non bloquantes : offres ignorées, champs manquants. */
  warnings: string[];
  /** Nombre d'entrées reçues avant filtrage, pour l'audit d'ingestion. */
  fetched: number;
}

export interface Connector {
  /** Identifiant stable, utilisé en base et dans la configuration. */
  readonly id: AtsProvider;
  readonly label: string;
  /**
   * Description de ce qu'il faut fournir comme identifiant de tableau
   * d'offres, affichée dans l'interface de configuration.
   */
  readonly boardHint: string;
  /** Documentation de référence de l'API utilisée. */
  readonly apiDocsUrl: string;
  fetchJobs(boardToken: string, context: ConnectorContext): Promise<ConnectorResult>;
}

/** Échec d'ingestion identifiable, distinct d'un bug de programmation. */
export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly details: {
      provider: AtsProvider;
      boardToken: string;
      /** Code HTTP, si l'échec vient d'une réponse. */
      status?: number;
      /** Vrai si réessayer plus tard a des chances d'aboutir. */
      retryable: boolean;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}
