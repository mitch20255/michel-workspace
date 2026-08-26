import type { PrismaClient } from '@boussole/db';
import { prisma as defaultPrisma, profileRowToDomain } from '@boussole/db';
import { decrypt, loadKey } from '@boussole/core/server';
import type { CandidateProfile } from '@boussole/core';
import { buildAuditEvent, redactForLogs, type AuditAction } from '@boussole/core';
import type { AppConfig } from './config.js';
import { notFound } from './errors.js';

/**
 * Contexte applicatif partagé par les routes.
 *
 * Regroupe ce qui est coûteux à construire (client de base, clé de
 * chiffrement) et ce qui doit être unique (journal d'audit). Passé
 * explicitement plutôt que lu depuis des variables globales : les tests
 * peuvent ainsi fournir leur propre base sans toucher à l'environnement.
 */

export interface AppContext {
  config: AppConfig;
  prisma: PrismaClient;
  encryptionKey: Buffer;
  /** Utilisateur courant. En mode mono-utilisateur, toujours le même. */
  userId: string;
  audit: AuditRecorder;
}

export type AuditRecorder = (input: {
  action: AuditAction;
  actor?: 'user' | 'system';
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  summary?: string;
}) => Promise<void>;

/**
 * Crée l'enregistreur d'audit.
 *
 * Les métadonnées passent par `redactForLogs` avant écriture : le journal
 * d'audit est consultable par l'utilisateur et exporté avec ses données ; il
 * ne doit jamais devenir un second entrepôt de PII.
 */
export function createAuditRecorder(prisma: PrismaClient, userId: string): AuditRecorder {
  return async (input) => {
    const event = buildAuditEvent(input);
    await prisma.auditEvent.create({
      data: {
        userId,
        action: event.action,
        actor: event.actor,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        metadata: redactForLogs(event.metadata) as object,
        summary: event.summary,
      },
    });
  };
}

/**
 * Prépare le contexte : vérifie la clé, garantit l'existence de l'utilisateur
 * unique et de ses paramètres.
 */
export async function createContext(
  config: AppConfig,
  prisma: PrismaClient = defaultPrisma,
): Promise<AppContext> {
  const encryptionKey = loadKey(config.ENCRYPTION_KEY);
  const userId = await ensureSingleUser(prisma);

  return {
    config,
    prisma,
    encryptionKey,
    userId,
    audit: createAuditRecorder(prisma, userId),
  };
}

/**
 * Mode mono-utilisateur du MVP.
 *
 * Le modèle de données est multi-utilisateur dès le départ ; seule
 * l'authentification est simplifiée. Passer à plusieurs comptes sera l'ajout
 * d'une couche d'authentification, pas une refonte du schéma.
 */
export async function ensureSingleUser(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      // Adresse locale : en mono-utilisateur, aucun courriel réel n'est requis
      // pour ouvrir le compte. L'utilisateur renseigne le sien dans son profil.
      email: 'local@boussole.invalid',
      settings: { create: {} },
    },
  });
  return created.id;
}

/** Charge un profil et le déchiffre. */
export async function loadProfile(
  context: AppContext,
  profileId?: string,
): Promise<CandidateProfile> {
  const row = await context.prisma.candidateProfile.findFirst({
    where: profileId ? { id: profileId, userId: context.userId } : { userId: context.userId },
    orderBy: { createdAt: 'asc' },
    include: { sensitiveAnswers: true },
  });

  if (!row) throw notFound('Profil candidat');
  // Le déchiffrement est appliqué pendant la conversion, avant la validation :
  // une colonne chiffrée n'est pas une adresse courriel valide.
  return profileRowToDomain(row, {
    decrypt: (value) => decrypt(value, context.encryptionKey),
  });
}

/** Paramètres utilisateur, créés à la volée s'ils n'existent pas encore. */
export async function loadSettings(context: AppContext) {
  const existing = await context.prisma.userSettings.findUnique({
    where: { userId: context.userId },
  });
  if (existing) return existing;

  return context.prisma.userSettings.create({ data: { userId: context.userId } });
}
