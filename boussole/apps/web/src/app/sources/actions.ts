'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import type { ActionResult } from '../profil/actions';

interface IngestionSummary {
  status: 'success' | 'failed';
  created: number;
  updated: number;
  deactivated: number;
  warnings: string[];
  error?: string;
}

export async function addSource(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const provider = String(formData.get('provider') ?? '');
  const boardToken = String(formData.get('boardToken') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();

  if (!provider || !boardToken) {
    return { ok: false, message: 'Fournisseur et identifiant sont requis.' };
  }

  try {
    await api('/sources', {
      method: 'POST',
      body: { provider, boardToken, ...(label ? { label } : {}) },
    });
    revalidatePath('/sources');
    return { ok: true, message: 'Source ajoutée. Lancer l’ingestion pour récupérer les offres.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Ajout impossible.',
    };
  }
}

export async function ingestOne(sourceId: string): Promise<void> {
  await api<IngestionSummary>(`/sources/${sourceId}/ingest`, { method: 'POST' });
  // Les nouvelles offres arrivent sans score : les évaluer tout de suite évite
  // une liste où la moitié des lignes affiche « non évaluée ».
  await api('/jobs/score-all', { method: 'POST' });

  revalidatePath('/sources');
  revalidatePath('/offres');
  revalidatePath('/');
}

export async function ingestAll(): Promise<void> {
  await api('/sources/ingest-all', { method: 'POST' });
  await api('/jobs/score-all', { method: 'POST' });

  revalidatePath('/sources');
  revalidatePath('/offres');
  revalidatePath('/');
}

export async function removeSource(sourceId: string): Promise<void> {
  await api(`/sources/${sourceId}`, { method: 'DELETE' });
  // Les offres déjà ingérées ne sont pas supprimées : elles peuvent porter des
  // candidatures en cours. Retirer une source arrête le suivi, pas l'historique.
  revalidatePath('/sources');
}

export async function addManualJob(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const companyName = String(formData.get('companyName') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const descriptionRaw = String(formData.get('descriptionRaw') ?? '').trim();
  const locationRaw = String(formData.get('locationRaw') ?? '').trim();
  const applyUrl = String(formData.get('applyUrl') ?? '').trim();

  if (!companyName || !title) {
    return { ok: false, message: 'Entreprise et intitulé sont requis.' };
  }

  try {
    await api('/jobs/manual', {
      method: 'POST',
      body: {
        atsProvider: 'manual',
        // Identifiant stable dérivé de la saisie : ressaisir la même offre la
        // met à jour au lieu d'en créer une seconde.
        sourceJobId: `${companyName}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        companyName,
        title,
        descriptionRaw,
        ...(locationRaw ? { locationRaw } : {}),
        ...(applyUrl ? { applyUrl } : {}),
      },
    });
    await api('/jobs/score-all', { method: 'POST' });

    revalidatePath('/offres');
    revalidatePath('/sources');
    return { ok: true, message: 'Offre ajoutée et évaluée.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Ajout impossible.',
    };
  }
}
