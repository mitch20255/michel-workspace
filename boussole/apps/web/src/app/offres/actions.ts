'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

/**
 * Actions serveur des offres.
 *
 * Toutes les écritures passent par ici : le jeton d'API reste côté serveur et
 * n'atteint jamais le navigateur. Chaque action revalide les chemins concernés
 * pour que l'affichage reflète l'état réel — un CRM qui montre une étape
 * périmée est pire qu'un CRM lent.
 */

export async function rescoreAll(): Promise<void> {
  await api('/jobs/score-all', { method: 'POST' });
  revalidatePath('/offres');
  revalidatePath('/');
}

export async function rescoreOne(jobId: string): Promise<void> {
  await api(`/jobs/${jobId}/score`, { method: 'POST' });
  revalidatePath(`/offres/${jobId}`);
  revalidatePath('/offres');
}

export async function trackJob(jobId: string): Promise<void> {
  await api('/applications', { method: 'POST', body: { jobId } });
  revalidatePath(`/offres/${jobId}`);
  revalidatePath('/crm');
}

export async function generateDocuments(jobId: string): Promise<void> {
  await api('/documents/generate', { method: 'POST', body: { jobId } });
  revalidatePath(`/offres/${jobId}`);
  revalidatePath('/crm');
}
