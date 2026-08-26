'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import type { ActionResult } from '../profil/actions';

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
