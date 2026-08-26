import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createPrismaClient, type PrismaClient } from '@boussole/db';
import { loadConfig, type AppConfig } from '../config.js';
import { createContext, type AppContext } from '../context.js';
import { buildServer } from '../server.js';

/**
 * Banc d'essai des tests d'intégration de l'API.
 *
 * Les tests s'exécutent sur une **vraie base Postgres** (`boussole_test`),
 * pas sur un double. La couche de persistance est justement l'endroit où
 * vivent les contraintes d'unicité, les cascades et le comportement des
 * colonnes JSON : les simuler reviendrait à tester une réimplémentation de
 * Prisma plutôt que le système réel.
 *
 * Les requêtes passent par `app.inject()` : la pile Fastify complète est
 * exercée (authentification, validation, gestion d'erreurs) sans ouvrir de
 * port ni dépendre du réseau.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://boussole:boussole@localhost:5432/boussole_test?schema=public';

export interface TestHarness {
  app: FastifyInstance;
  context: AppContext;
  config: AppConfig;
  prisma: PrismaClient;
  token: string;
  /** Requête authentifiée. */
  request: (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ) => Promise<{ status: number; body: unknown }>;
  close: () => Promise<void>;
}

/** Vrai si la base de test est joignable. Sinon les suites sont ignorées. */
export async function isTestDatabaseAvailable(): Promise<boolean> {
  const prisma = createPrismaClient({ databaseUrl: TEST_DATABASE_URL });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

export async function createHarness(): Promise<TestHarness> {
  const token = randomBytes(32).toString('hex');

  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    API_TOKEN: token,
    // Les tests ne doivent jamais attendre : la politesse envers les ATS n'a
    // pas de sens face à un `fetch` simulé.
    INGEST_MIN_DELAY_MS: '0',
    LOG_LEVEL: 'fatal',
    STORAGE_DIR: `/tmp/boussole-test-storage-${randomBytes(4).toString('hex')}`,
  });

  const prisma = createPrismaClient({ databaseUrl: TEST_DATABASE_URL });
  await resetDatabase(prisma);

  const context = await createContext(config, prisma);
  const app = await buildServer({ config, context });
  await app.ready();

  return {
    app,
    context,
    config,
    prisma,
    token,
    request: async (method, url, body) => {
      const response = await app.inject({
        method,
        url,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { payload: JSON.stringify(body) } : {}),
      });

      let parsed: unknown = response.body;
      try {
        parsed = response.json();
      } catch {
        // Réponse non-JSON (PDF, corps vide) : on garde le brut.
      }
      return { status: response.statusCode, body: parsed };
    },
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

/**
 * Vide la base entre deux suites.
 *
 * `TRUNCATE ... CASCADE` plutôt qu'une suppression par table : l'ordre des
 * clés étrangères n'a alors pas à être maintenu à la main à chaque évolution
 * du schéma, et la remise à zéro reste correcte quand une table est ajoutée.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;

  if (tables.length === 0) return;

  const list = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Profil minimal mais valide, pour les tests qui en ont besoin. */
export const TEST_PROFILE = {
  id: 'test',
  label: 'Profil de test',
  locale: 'fr-CA',
  identity: { firstName: 'Camille', lastName: 'Tremblay-Fictif' },
  contact: { email: 'camille@exemple-fictif.test', phone: '514-555-0142' },
  location: { city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal, QC' },
  experiences: [
    {
      id: 'exp_1',
      company: 'Studio Boréal',
      title: 'Développeuse senior',
      startDate: '2021-03',
      endDate: null,
      bullets: ['Plateforme React et Node.js livrée pour 12 000 usagers.'],
      skills: ['TypeScript', 'React', 'Node.js'],
      metrics: [],
    },
  ],
  projects: [],
  education: [],
  certifications: [],
  skills: [
    { name: 'TypeScript', level: 'expert', yearsOfExperience: 7 },
    { name: 'React', level: 'advanced', yearsOfExperience: 6 },
    { name: 'PostgreSQL', level: 'advanced', yearsOfExperience: 5 },
  ],
  languages: [{ language: 'Français', level: 'native' }],
  links: [],
  preferences: {
    targetTitles: ['Développeuse senior'],
    remotePolicies: ['remote', 'hybrid'],
    locations: [{ city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal, QC' }],
    seniorityTargets: ['senior'],
  },
  sensitiveAnswers: [],
  cannedAnswers: [],
};
