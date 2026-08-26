import { z } from 'zod';

/**
 * Journal d'audit destiné à l'utilisateur.
 *
 * Ce n'est pas un journal technique : c'est la réponse à « qu'est-ce que cet
 * outil a fait en mon nom ? ». Toute action ayant un effet visible à
 * l'extérieur (document généré, candidature marquée soumise, appel à un LLM,
 * champ pré-rempli par l'extension) doit y laisser une trace.
 *
 * Deux invariants :
 *  1. Le journal est en **ajout seul** : aucune modification, aucune
 *     suppression individuelle. Il n'est purgé qu'avec le compte entier.
 *  2. Il ne contient **jamais** de valeur sensible — seulement la nature de
 *     l'action et des références. « Champ salary_expectation pré-rempli »,
 *     jamais le montant.
 */

export const AUDIT_ACTIONS = [
  'profile.created',
  'profile.updated',
  'profile.exported',
  'profile.deleted',
  'sensitive_answer.updated',
  'ingestion.started',
  'ingestion.completed',
  'ingestion.failed',
  'job.imported',
  'job.updated',
  'job.deduplicated',
  'job.scored',
  'application.created',
  'application.stage_changed',
  'application.marked_applied',
  'document.generated',
  'document.exported',
  'llm.request',
  'llm.disabled_by_policy',
  'llm.key_stored',
  'extension.field_prefilled',
  'extension.submission_confirmed',
  'outreach.draft_created',
  'settings.updated',
  'data.exported',
  'data.purged',
] as const;

export const AuditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  action: AuditActionSchema,
  /** Qui a agi. `system` = déclenché par une planification, pas par un clic. */
  actor: z.enum(['user', 'system']),
  /** Type et identifiant de l'objet concerné. Jamais son contenu. */
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  /**
   * Métadonnées non sensibles : compteurs, durées, noms de fournisseur.
   * Passées par `redactForLogs` avant écriture.
   */
  metadata: z.record(z.string(), z.unknown()).default({}),
  /** Phrase lisible en français, affichée telle quelle dans l'interface. */
  summary: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AUDIT_LABELS_FR: Record<AuditAction, string> = {
  'profile.created': 'Profil créé',
  'profile.updated': 'Profil mis à jour',
  'profile.exported': 'Profil exporté',
  'profile.deleted': 'Profil supprimé',
  'sensitive_answer.updated': 'Réponse sensible mise à jour',
  'ingestion.started': 'Ingestion démarrée',
  'ingestion.completed': 'Ingestion terminée',
  'ingestion.failed': 'Ingestion en échec',
  'job.imported': 'Offre importée',
  'job.updated': 'Offre mise à jour',
  'job.deduplicated': 'Offres regroupées comme doublons',
  'job.scored': 'Offre évaluée',
  'application.created': 'Candidature créée',
  'application.stage_changed': 'Étape de candidature modifiée',
  'application.marked_applied': 'Candidature marquée comme soumise',
  'document.generated': 'Document généré',
  'document.exported': 'Document exporté',
  'llm.request': 'Appel à un modèle de langage',
  'llm.disabled_by_policy': 'Appel au modèle bloqué par la configuration',
  'llm.key_stored': 'Clé API enregistrée',
  'extension.field_prefilled': 'Champ de formulaire pré-rempli',
  'extension.submission_confirmed': 'Soumission confirmée par vous',
  'outreach.draft_created': 'Brouillon de courriel créé',
  'settings.updated': 'Paramètres mis à jour',
  'data.exported': 'Données exportées',
  'data.purged': 'Données supprimées',
};

export interface AuditEventInput {
  action: AuditAction;
  actor?: 'user' | 'system';
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  summary?: string;
  at?: Date;
  id?: string;
}

/**
 * Construit un événement d'audit valide. Le résumé par défaut vient du
 * libellé français : un appelant qui oublie de le fournir produit quand même
 * une entrée lisible.
 */
export function buildAuditEvent(input: AuditEventInput): AuditEvent {
  return AuditEventSchema.parse({
    id: input.id ?? `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    at: (input.at ?? new Date()).toISOString(),
    action: input.action,
    actor: input.actor ?? 'user',
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
    summary: input.summary ?? AUDIT_LABELS_FR[input.action],
  });
}
