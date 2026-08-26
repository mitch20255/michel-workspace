import { z } from 'zod';

/**
 * CRM candidat. Les colonnes du Kanban sont un enum ordonné : l'ordre du
 * tableau est l'ordre d'affichage et sert aussi à détecter les régressions
 * de pipeline (revenir de `interview` à `shortlist` est un événement notable).
 */
export const PIPELINE_STAGES = [
  'to_review',
  'shortlist',
  'documents_ready',
  'ready_to_apply',
  'applied',
  'follow_up_due',
  'interview',
  'technical_test',
  'offer',
  'rejected',
  'archived',
] as const;

export const PipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const STAGE_LABELS_FR: Record<PipelineStage, string> = {
  to_review: 'À examiner',
  shortlist: 'Shortlist',
  documents_ready: 'Documents générés',
  ready_to_apply: 'Prêt à candidater',
  applied: 'Candidature soumise',
  follow_up_due: 'Relance prévue',
  interview: 'Entretien',
  technical_test: 'Test technique',
  offer: 'Offre',
  rejected: 'Rejet',
  archived: 'Archivé',
};

/**
 * Transitions autorisées. Le CRM refuse un mouvement absurde (ex. « offre »
 * directement depuis « à examiner ») pour garder des statistiques honnêtes,
 * mais reste permissif vers `rejected` / `archived` depuis n'importe où :
 * une candidature peut mourir à toute étape.
 */
export const ALLOWED_TRANSITIONS: Record<PipelineStage, readonly PipelineStage[]> = {
  to_review: ['shortlist', 'rejected', 'archived'],
  shortlist: ['documents_ready', 'to_review', 'rejected', 'archived'],
  documents_ready: ['ready_to_apply', 'shortlist', 'rejected', 'archived'],
  ready_to_apply: ['applied', 'documents_ready', 'rejected', 'archived'],
  applied: ['follow_up_due', 'interview', 'technical_test', 'rejected', 'archived'],
  follow_up_due: ['interview', 'technical_test', 'applied', 'rejected', 'archived'],
  interview: ['technical_test', 'offer', 'follow_up_due', 'rejected', 'archived'],
  technical_test: ['interview', 'offer', 'rejected', 'archived'],
  offer: ['applied', 'rejected', 'archived'],
  rejected: ['archived', 'to_review'],
  archived: ['to_review'],
};

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const ApplicationEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  type: z.enum([
    'stage_changed',
    'note_added',
    'document_generated',
    'applied',
    'reminder_set',
    'reminder_done',
    'response_received',
  ]),
  from: PipelineStageSchema.optional(),
  to: PipelineStageSchema.optional(),
  message: z.string().optional(),
  /** `user` ou `system` : on doit toujours savoir qui a agi. */
  actor: z.enum(['user', 'system']).default('user'),
});
export type ApplicationEvent = z.infer<typeof ApplicationEventSchema>;

export const ApplicationNoteSchema = z.object({
  id: z.string(),
  at: z.string(),
  body: z.string().min(1),
});
export type ApplicationNote = z.infer<typeof ApplicationNoteSchema>;

export const ReminderSchema = z.object({
  id: z.string(),
  dueAt: z.string(),
  label: z.string().min(1),
  done: z.boolean().default(false),
});
export type Reminder = z.infer<typeof ReminderSchema>;

export const ApplicationSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  profileId: z.string(),
  stage: PipelineStageSchema.default('to_review'),
  /**
   * Snapshot de l'offre au moment de la candidature. Les offres disparaissent
   * des ATS ; sans copie locale, on perd le contexte de sa propre candidature.
   */
  jobSnapshot: z.unknown().optional(),
  appliedAt: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDueAt: z.string().optional(),
  notes: z.array(ApplicationNoteSchema).default([]),
  events: z.array(ApplicationEventSchema).default([]),
  reminders: z.array(ReminderSchema).default([]),
  documentIds: z.array(z.string()).default([]),
  /** Score au moment de la mise en shortlist, figé pour l'analyse a posteriori. */
  scoreAtShortlist: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Application = z.infer<typeof ApplicationSchema>;
