import { PrismaClient } from '../generated/client/index.js';

/**
 * Client Prisma partagé.
 *
 * Un seul client par processus : Prisma gère lui-même un pool de connexions,
 * en instancier plusieurs multiplie les pools et épuise Postgres. En
 * développement, le rechargement à chaud recrée le module — d'où la mise en
 * cache sur `globalThis`, sans quoi chaque sauvegarde de fichier ouvre un
 * nouveau pool jusqu'à saturation.
 */

const globalForPrisma = globalThis as unknown as { boussolePrisma?: PrismaClient };

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    // `query` est volontairement absent en production : les paramètres de
    // requête contiennent des données de profil.
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
  });
}

export const prisma: PrismaClient = globalForPrisma.boussolePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.boussolePrisma = prisma;
}

export type { PrismaClient };
export * from '../generated/client/index.js';
