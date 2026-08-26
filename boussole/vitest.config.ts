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
        find: '@boussole/connectors',
        replacement: resolvePath('./packages/connectors/src/index.ts'),
      },
      {
        find: '@boussole/documents',
        replacement: resolvePath('./packages/documents/src/index.ts'),
      },
      { find: '@boussole/llm', replacement: resolvePath('./packages/llm/src/index.ts') },
      { find: '@boussole/db', replacement: resolvePath('./packages/db/src/index.ts') },
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
