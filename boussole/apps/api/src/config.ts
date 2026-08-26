import { z } from 'zod';

/**
 * Configuration de l'API, lue depuis l'environnement.
 *
 * Principe : **échouer au démarrage, jamais en cours de route.** Une clé de
 * chiffrement absente ou un jeton vide doivent empêcher le serveur de
 * démarrer. Découvrir le problème au premier appel — après avoir peut-être
 * écrit des données en clair — est bien pire qu'un refus immédiat.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requise.'),

  /**
   * Clé AES-256-GCM en base64. Sa validité fine est vérifiée par `loadKey`
   * dans @boussole/core/server ; ici on vérifie seulement sa présence, pour
   * produire un message d'aide au lieu d'une exception cryptographique.
   */
  ENCRYPTION_KEY: z
    .string()
    .min(1, 'ENCRYPTION_KEY est requise. Générer avec : openssl rand -base64 32'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /**
   * Écoute sur la boucle locale par défaut. Exposer une API contenant un
   * profil candidat sur toutes les interfaces doit être un geste délibéré.
   */
  API_HOST: z.string().default('127.0.0.1'),
  /**
   * Jeton d'accès en mode mono-utilisateur. Minimum 32 caractères : un jeton
   * court est devinable, et cette API donne accès à l'intégralité des données
   * personnelles de l'utilisateur.
   */
  API_TOKEN: z
    .string()
    .min(32, 'API_TOKEN doit faire au moins 32 caractères. Générer avec : openssl rand -hex 32'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  INGEST_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(1000),
  INGEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  INGEST_USER_AGENT: z.string().default("Boussole/0.1 (assistant personnel de recherche d'emploi)"),

  TYPST_BIN: z.string().default('typst'),
  STORAGE_DIR: z.string().default('./storage'),

  LLM_MAX_PROMPT_CHARS: z.coerce.number().int().positive().default(24000),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);

  if (!parsed.success) {
    // Message actionnable plutôt qu'une trace Zod brute : c'est la première
    // chose que voit quelqu'un qui installe le projet.
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuration invalide. Vérifier le fichier .env (voir .env.example) :\n${details}`,
    );
  }

  const config = parsed.data;

  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    isProduction: config.NODE_ENV === 'production',
  };
}
