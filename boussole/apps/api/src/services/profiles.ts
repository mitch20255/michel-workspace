import {
  CandidateProfileSchema,
  SensitiveFieldKeySchema,
  readSensitiveAnswer,
  SENSITIVE_FIELDS,
  type CandidateProfile,
  type SensitiveAnswer,
} from '@boussole/core';
import { decrypt, encrypt, encryptProfile } from '@boussole/core/server';
import { profileRowToDomain, profileToRow } from '@boussole/db';
import type { AppContext } from '../context.js';
import { notFound } from '../errors.js';

/**
 * Service de profil candidat.
 *
 * Les coordonnées et les réponses sensibles sont chiffrées **avant** d'entrer
 * en base et déchiffrées à la sortie. Les appelants manipulent donc toujours
 * un profil en clair et ne peuvent pas oublier de chiffrer : c'est la couche
 * de persistance qui porte la responsabilité, pas chaque route.
 */

export async function createOrUpdateProfile(
  context: AppContext,
  input: unknown,
  profileId?: string,
): Promise<CandidateProfile> {
  const profile = CandidateProfileSchema.parse(input);
  const encrypted = encryptProfile(profile, context.encryptionKey);
  const row = profileToRow(encrypted);

  const existing = profileId
    ? await context.prisma.candidateProfile.findFirst({
        where: { id: profileId, userId: context.userId },
      })
    : await context.prisma.candidateProfile.findFirst({
        where: { userId: context.userId },
        orderBy: { createdAt: 'asc' },
      });

  const saved = existing
    ? await context.prisma.candidateProfile.update({
        where: { id: existing.id },
        data: row,
        include: { sensitiveAnswers: true },
      })
    : await context.prisma.candidateProfile.create({
        data: { ...row, userId: context.userId },
        include: { sensitiveAnswers: true },
      });

  await context.audit({
    action: existing ? 'profile.updated' : 'profile.created',
    targetType: 'candidate_profile',
    targetId: saved.id,
    // Des compteurs, jamais le contenu.
    metadata: {
      experiences: profile.experiences.length,
      skills: profile.skills.length,
      projects: profile.projects.length,
    },
    summary: existing ? 'Profil mis à jour' : 'Profil créé',
  });

  return profileRowToDomain(saved, { decrypt: (value) => decrypt(value, context.encryptionKey) });
}

/**
 * Enregistre une réponse à une question sensible.
 *
 * Le trio d'états est strict : `answered` exige une valeur, `declined` et
 * `needs_input` en interdisent une. Sans cette règle, une valeur résiduelle
 * pourrait être pré-remplie dans un formulaire après que l'utilisateur a
 * refusé de répondre.
 */
export async function setSensitiveAnswer(
  context: AppContext,
  profileId: string,
  input: { key: string; state: SensitiveAnswer['state']; value?: string; note?: string },
): Promise<SensitiveAnswer> {
  const key = SensitiveFieldKeySchema.parse(input.key);

  const profile = await context.prisma.candidateProfile.findFirst({
    where: { id: profileId, userId: context.userId },
  });
  if (!profile) throw notFound('Profil candidat');

  const shouldStoreValue = input.state === 'answered' && Boolean(input.value?.trim());
  const encryptedValue = shouldStoreValue
    ? encrypt(input.value!.trim(), context.encryptionKey)
    : null;

  const data = {
    // Une réponse « answered » sans valeur est incohérente : on retombe sur
    // needs_input plutôt que de laisser passer une chaîne vide.
    state: shouldStoreValue ? 'answered' : input.state === 'answered' ? 'needs_input' : input.state,
    value: encryptedValue,
    note: input.note ?? null,
  };

  await context.prisma.sensitiveAnswer.upsert({
    where: { profileId_key: { profileId, key } },
    create: { profileId, key, ...data },
    update: data,
  });

  await context.audit({
    action: 'sensitive_answer.updated',
    targetType: 'sensitive_answer',
    targetId: `${profileId}:${key}`,
    // Le champ et son état, jamais la valeur.
    metadata: { key, state: data.state },
    summary: `Réponse sensible « ${key} » : ${data.state}`,
  });

  return { key, state: data.state as SensitiveAnswer['state'], note: input.note };
}

/**
 * État de complétude des champs sensibles.
 *
 * Sert à l'interface et, plus tard, à l'extension : tout champ à
 * `needs_input` doit provoquer un arrêt et une demande à l'utilisateur, jamais
 * une valeur devinée.
 */
export async function sensitiveFieldStatus(context: AppContext, profileId: string) {
  const profile = await context.prisma.candidateProfile.findFirst({
    where: { id: profileId, userId: context.userId },
    include: { sensitiveAnswers: true },
  });
  if (!profile) throw notFound('Profil candidat');

  const domain = profileRowToDomain(profile, {
    decrypt: (value) => decrypt(value, context.encryptionKey),
  });

  return SENSITIVE_FIELDS.map((key) => {
    const answer = readSensitiveAnswer(domain, key);
    return {
      key,
      state: answer.state,
      // La valeur n'est jamais renvoyée par cette route : seul l'état compte
      // pour piloter l'interface.
      hasValue: answer.state === 'answered',
      note: answer.note,
    };
  });
}

/**
 * Export complet des données de l'utilisateur, en clair.
 *
 * Exigence de portabilité : l'utilisateur doit pouvoir partir avec ses
 * données dans un format lisible, sans outil propriétaire.
 */
export async function exportUserData(context: AppContext) {
  const [profiles, applications, documents, auditEvents, sources] = await Promise.all([
    context.prisma.candidateProfile.findMany({
      where: { userId: context.userId },
      include: { sensitiveAnswers: true },
    }),
    context.prisma.application.findMany({
      where: { userId: context.userId },
      include: { notes: true, events: true, reminders: true },
    }),
    context.prisma.generatedDocument.findMany({
      where: { userId: context.userId },
      // Les sources Typst sont volumineuses et reproductibles à partir du
      // profil : on exporte le texte, qui est ce que l'utilisateur veut relire.
      select: {
        id: true,
        kind: true,
        language: true,
        version: true,
        plainText: true,
        pdfPath: true,
        createdAt: true,
      },
    }),
    context.prisma.auditEvent.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: 'desc' },
    }),
    context.prisma.jobSource.findMany({ where: { userId: context.userId } }),
  ]);

  await context.audit({
    action: 'data.exported',
    metadata: { profiles: profiles.length, applications: applications.length },
    summary: 'Export complet des données',
  });

  return {
    exportedAt: new Date().toISOString(),
    profiles: profiles.map((profile) =>
      profileRowToDomain(profile, { decrypt: (value) => decrypt(value, context.encryptionKey) }),
    ),
    applications,
    documents,
    sources,
    auditEvents,
  };
}

/**
 * Suppression complète des données de l'utilisateur.
 *
 * Les cascades du schéma suppriment tout ce qui lui appartient. Les offres,
 * publiques et partagées, ne sont pas touchées : elles n'appartiennent à
 * personne.
 */
export async function purgeUserData(context: AppContext): Promise<void> {
  // L'audit est écrit *avant* la suppression : après, la ligne
  // disparaîtrait avec le reste, et l'opération ne laisserait aucune trace.
  await context.audit({
    action: 'data.purged',
    summary: 'Suppression de toutes les données personnelles',
  });

  await context.prisma.user.delete({ where: { id: context.userId } });
}
