'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

/**
 * Changement d'étape.
 *
 * `applied` n'a rien d'automatique : c'est l'utilisateur qui clique
 * « j'ai postulé ». Boussole ne soumet aucune candidature et ne présume
 * jamais qu'elle l'a été.
 */
export async function moveStage(applicationId: string, stage: string): Promise<void> {
  await api(`/applications/${applicationId}/stage`, { method: 'PATCH', body: { stage } });
  revalidatePath('/crm');
  revalidatePath('/');
}

export async function addNote(applicationId: string, formData: FormData): Promise<void> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  await api(`/applications/${applicationId}/notes`, { method: 'POST', body: { body } });
  revalidatePath('/crm');
}
