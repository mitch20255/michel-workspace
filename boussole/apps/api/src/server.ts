import type { FetchLike } from '@boussole/connectors';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { safeCompare } from '@boussole/core/server';
import type { AppConfig } from './config.js';
import type { AppContext } from './context.js';
import { registerErrorHandler } from './errors.js';
import { registerRoutes } from './routes/index.js';

/**
 * Construction du serveur HTTP.
 *
 * Choix d'authentification pour le MVP : **jeton statique unique**.
 *
 * L'application est mono-utilisateur et destinée à tourner en local. Ajouter
 * OAuth, des sessions et une gestion de mots de passe apporterait une surface
 * d'attaque et une complexité réelles pour protéger un service qui n'écoute
 * que sur la boucle locale. Le modèle de données est en revanche
 * multi-utilisateur dès maintenant : passer à de vrais comptes sera l'ajout
 * d'une couche d'authentification, pas une refonte.
 *
 * Ce choix est documenté dans SECURITY.md avec ses limites explicites.
 */

export interface BuildServerOptions {
  config: AppConfig;
  context: AppContext;
  /** Injecté par les tests pour éviter tout appel réseau réel. */
  fetchImpl?: FetchLike;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { config, context } = options;

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      /**
       * Masquage au niveau du journaliseur, en plus de `redactForLogs`.
       * Deux barrières indépendantes : celle-ci attrape ce qu'un appelant
       * aurait oublié de faire passer par la première.
       */
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.contact',
          'req.body.email',
          'req.body.phone',
          'req.body.address',
          'req.body.value',
          'req.body.apiKey',
          'req.body.llmApiKey',
        ],
        censor: '[masqué]',
      },
    },
    // Un profil complet avec expériences détaillées dépasse facilement la
    // limite par défaut de 1 Mo.
    bodyLimit: 8 * 1024 * 1024,
    // Les identifiants de requête aident au diagnostic sans rien révéler.
    genReqId: () => `req_${Math.random().toString(36).slice(2, 12)}`,
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  registerErrorHandler(app);

  /**
   * Contrôle d'accès. `/health` reste ouvert : une sonde de disponibilité qui
   * exige un secret n'est pas utilisable par un superviseur.
   */
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    if (request.url === '/health' || request.url.startsWith('/health?')) return;

    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

    // Comparaison à temps constant : `===` sur un secret fuit sa longueur et
    // son préfixe par le temps de réponse.
    if (!token || !safeCompare(token, config.API_TOKEN)) {
      await reply.status(401).send({
        error: {
          code: 'unauthorized',
          message: 'Jeton absent ou invalide. En-tête attendu : Authorization: Bearer <API_TOKEN>.',
        },
      });
    }
  });

  await registerRoutes(app, context, options.fetchImpl);

  return app;
}
