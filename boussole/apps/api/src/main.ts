import { prisma } from '@boussole/db';
import { loadConfig } from './config.js';
import { createContext } from './context.js';
import { buildServer } from './server.js';

/**
 * Point d'entrée du serveur.
 *
 * Toute erreur de configuration fait échouer le démarrage avec un message
 * lisible : mieux vaut un refus immédiat qu'un serveur qui tourne à moitié et
 * écrit des données en clair.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const context = await createContext(config, prisma);
  const app = await buildServer({ config, context });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Signal ${signal} reçu, arrêt en cours.`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.API_PORT, host: config.API_HOST });

  app.log.info(
    `Boussole API démarrée sur http://${config.API_HOST}:${config.API_PORT} (${config.NODE_ENV})`,
  );
}

main().catch((error: unknown) => {
  console.error('\n Démarrage impossible :\n');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
