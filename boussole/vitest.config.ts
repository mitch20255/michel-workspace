import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    /**
     * Les tests s'exécutent toujours sur les **sources** des paquets de
     * l'espace de travail, jamais sur `dist/`. Sans ces alias, une suite peut
     * passer sur une compilation périmée et masquer une régression réelle —
     * et il faudrait reconstruire chaque paquet avant chaque test.
     *
     * L'ordre compte : les sous-chemins doivent précéder le paquet racine,
     * sinon `@boussole/core` capterait `@boussole/core/server`.
     */
    alias: [
      {
        find: '@boussole/core/testing',
        replacement: resolvePath('./packages/core/src/testing/index.ts'),
      },
      {
        find: '@boussole/core/server',
        replacement: resolvePath('./packages/core/src/server/index.ts'),
      },
      { find: '@boussole/core', replacement: resolvePath('./packages/core/src/index.ts') },
      {
        find: '@boussole/connectors/testing',
        replacement: resolvePath('./packages/connectors/src/testing/index.ts'),
      },
      {
        find: '@boussole/connectors',
        replacement: resolvePath('./packages/connectors/src/index.ts'),
      },
      {
        find: '@boussole/documents',
        replacement: resolvePath('./packages/documents/src/index.ts'),
      },
      { find: '@boussole/llm', replacement: resolvePath('./packages/llm/src/index.ts') },
      /**
       * `@boussole/db` n'est délibérément pas aliasé vers ses sources : il
       * réexporte le client Prisma généré, qui est du CommonJS. Résolu par
       * Vite comme un module ESM source, `PrismaClient` n'est alors pas un
       * constructeur. Le paquet est donc résolu normalement, via ses
       * `exports` et son `dist` — d'où la nécessité de le construire avant
       * les tests d'intégration.
       */
    ],
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/*.d.ts', '**/testing/**', '**/fixtures/**'],
      thresholds: {
        // Le cœur métier (scoring, déduplication, fantômes, normalisation)
        // doit rester couvert. Un seuil qui baisse est un signal, pas un
        // détail de configuration.
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
