'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import type { ActionResult } from '../profil/actions';
import type { ImpactTone } from '@/lib/types';

export async function saveLlmSettings(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const llmProvider = String(formData.get('llmProvider') ?? 'none');
  const llmModel = String(formData.get('llmModel') ?? '').trim();
  const llmApiKey = String(formData.get('llmApiKey') ?? '').trim();
  const llmConsent = formData.get('llmConsent') === '1';

  try {
    const response = await api<{ notice?: string }>('/settings', {
      method: 'PUT',
      body: {
        llmProvider,
        llmModel: llmModel || null,
        // Un champ vide signifie « conserver la clé existante », jamais
        // « effacer » : effacer une clé par inadvertance à chaque
        // enregistrement du formulaire serait pénible et surprenant.
        ...(llmApiKey ? { llmApiKey } : {}),
        llmConsent,
      },
    });

    revalidatePath('/parametres');
    revalidatePath('/');

    return {
      ok: true,
      message: response.notice ?? 'Paramètres enregistrés.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Enregistrement impossible.',
    };
  }
}

/**
 * Enregistrement du cadran d'impact.
 *
 * Séparé du formulaire du modèle : ce sont deux décisions sans rapport, et
 * les mêler ferait passer un changement de ton pour un effet de bord d'un
 * changement de fournisseur.
 */
export async function saveDocumentTone(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const documentTone = String(formData.get('documentTone') ?? 'confident') as ImpactTone;

  try {
    await api('/settings', { method: 'PUT', body: { documentTone } });

    revalidatePath('/parametres');
    revalidatePath('/offres');

    return {
      ok: true,
      message:
        documentTone === 'assertive'
          ? 'Ton offensif activé. Chaque document généré affichera l’avant/après des puces modifiées : relisez-les avant d’envoyer.'
          : 'Ton enregistré.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Enregistrement impossible.',
    };
  }
}
