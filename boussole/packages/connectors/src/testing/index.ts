/**
 * Utilitaires de test exposés aux autres paquets.
 *
 * Sous-chemin dédié (`@boussole/connectors/testing`) plutôt que point
 * d'entrée principal : le simulateur de `fetch` et les fixtures ne doivent
 * jamais entrer dans un bundle applicatif.
 */
export * from './mockFetch.js';
