'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export interface ActionResult {
  ok: boolean;
  message: string;
  /** Détails de validation, affichés champ par champ. */
  details?: Array<{ path: string; message: string }>;
}

/**
 * Enregistre le profil.
 *
 * L'éditeur envoie du JSON brut. Ce choix est assumé pour le MVP : un
 * formulaire complet couvrant expériences, projets, formations,
 * certifications, compétences, langues et préférences représente des
 * dizaines de champs imbriqués, pour une donnée qu'on saisit une fois puis
 * qu'on retouche rarement. Le schéma Zod côté API valide tout et renvoie des
 * erreurs champ par champ, donc rien n'est laissé au hasard.
 *
 * Un éditeur par sections est prévu en V1 — c'est un travail d'interface, pas
 * un manque du modèle de données.
 */
export async function saveProfile(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = String(formData.get('profile') ?? '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      message: `JSON invalide : ${error instanceof Error ? error.message : 'erreur de syntaxe'}`,
    };
  }

  try {
    await api('/profile', { method: 'PUT', body: parsed });
    // Le profil pilote tous les scores : les laisser périmés afficherait des
    // recommandations calculées sur un profil qui n'existe plus.
    await api('/jobs/score-all', { method: 'POST' });

    revalidatePath('/profil');
    revalidatePath('/offres');
    revalidatePath('/');

    return { ok: true, message: 'Profil enregistré. Les scores ont été recalculés.' };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message: error.message,
        details: Array.isArray(error.details)
          ? (error.details as Array<{ path: string; message: string }>)
          : undefined,
      };
    }
    return { ok: false, message: 'Enregistrement impossible.' };
  }
}

export async function saveSensitiveAnswer(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const key = String(formData.get('key') ?? '');
  const state = String(formData.get('state') ?? 'needs_input');
  const value = String(formData.get('value') ?? '');

  if (!key) return { ok: false, message: 'Choisir un champ.' };

  try {
    await api('/profile/sensitive', {
      method: 'PUT',
      body: { key, state, ...(state === 'answered' ? { value } : {}) },
    });
    revalidatePath('/profil');
    return { ok: true, message: 'Réponse enregistrée.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Enregistrement impossible.',
    };
  }
}
