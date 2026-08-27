/**
 * `@boussole/core` — domaine métier pur.
 *
 * Contrat du paquet : **aucune I/O, aucun accès réseau, aucun état global.**
 * Tout est fonction pure ou schéma. C'est ce qui rend le scoring
 * reproductible, la normalisation rejouable et les tests instantanés.
 *
 * Les fonctions nécessitant `node:crypto` vivent dans `@boussole/core/server`
 * pour que ce point d'entrée reste importable côté navigateur.
 */

// --- Schémas -------------------------------------------------------------
export * from './schemas/common.js';
export * from './schemas/job.js';
export * from './schemas/profile.js';
export * from './schemas/application.js';

// --- Texte ---------------------------------------------------------------
export * from './text/normalize.js';
export * from './text/html.js';
export * from './text/tokens.js';

// --- Offres --------------------------------------------------------------
export * from './jobs/normalize.js';
export * from './jobs/salary.js';
export * from './jobs/location.js';
export * from './jobs/seniority.js';
export * from './jobs/sections.js';
export * from './jobs/fingerprint.js';

// --- Déduplication -------------------------------------------------------
export * from './dedup/similarity.js';
export * from './dedup/dedup.js';

// --- Offres fantômes -----------------------------------------------------
export * from './ghost/score.js';

// --- Correspondance et scoring ------------------------------------------
export * from './matching/taxonomy.js';
export * from './matching/skills.js';
export * from './matching/adjacency.js';
export * from './matching/keywordGap.js';
export * from './matching/score.js';

// --- Sécurité et vie privée ---------------------------------------------
export * from './security/redact.js';
export * from './security/minimize.js';

// --- Audit ---------------------------------------------------------------
export * from './audit/events.js';
