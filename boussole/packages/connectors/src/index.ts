import type { AtsProvider } from '@boussole/core';
import { greenhouseConnector } from './greenhouse.js';
import { leverConnector } from './lever.js';
import { ashbyConnector } from './ashby.js';
import { personioConnector } from './personio.js';
import type { Connector } from './types.js';

export * from './types.js';
export { fetchWithPolicy, resetRateLimitState } from './http.js';
export { greenhouseConnector } from './greenhouse.js';
export { leverConnector } from './lever.js';
export { ashbyConnector } from './ashby.js';
export { personioConnector } from './personio.js';

/**
 * Registre des connecteurs disponibles.
 *
 * Workday est volontairement absent. Son API publique n'existe pas : chaque
 * client dispose d'un locataire distinct, les points d'accès sont des POST
 * internes non documentés, et leur forme change sans préavis. Un connecteur
 * Workday serait donc du scraping fragile déguisé — exactement ce que le
 * cahier des charges interdit. La justification complète et les conditions
 * d'une éventuelle réévaluation sont dans docs/modules/ingestion.md.
 */
export const CONNECTORS: Record<string, Connector> = {
  greenhouse: greenhouseConnector,
  lever: leverConnector,
  ashby: ashbyConnector,
  personio: personioConnector,
};

export function getConnector(provider: AtsProvider | string): Connector | undefined {
  return CONNECTORS[provider];
}

export function listConnectors(): Connector[] {
  return Object.values(CONNECTORS);
}
