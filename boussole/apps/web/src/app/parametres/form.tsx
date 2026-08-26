'use client';

import { useActionState, useState } from 'react';
import type { SettingsResponse } from '@/lib/types';
import type { ActionResult } from '../profil/actions';
import { saveLlmSettings } from './actions';

export function LlmSettingsForm({ settings }: { settings: SettingsResponse }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    saveLlmSettings,
    null,
  );
  const [provider, setProvider] = useState(settings.llm.provider);

  const selected = settings.llm.available.find((entry) => entry.id === provider);
  const isLocal = selected?.local ?? false;
  const isNone = provider === 'none';

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="llmProvider">
            Fournisseur
          </label>
          <select
            id="llmProvider"
            name="llmProvider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm"
          >
            <option value="none">Aucun — rien ne quitte la machine</option>
            {settings.llm.available.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
                {entry.local ? ' — local' : ''}
              </option>
            ))}
          </select>
        </div>

        {!isNone && (
          <div>
            <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="llmModel">
              Modèle
            </label>
            <input
              id="llmModel"
              name="llmModel"
              defaultValue={settings.llm.model ?? ''}
              placeholder={selected?.defaultModel ?? ''}
              className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {!isNone && !isLocal && (
        <>
          <div>
            <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="llmApiKey">
              Clé API {settings.llm.hasApiKey && '(une clé est déjà enregistrée)'}
            </label>
            <input
              id="llmApiKey"
              name="llmApiKey"
              type="password"
              autoComplete="off"
              placeholder={settings.llm.hasApiKey ? 'Laisser vide pour conserver' : 'sk-…'}
              className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-(--color-ink-faint)">
              Chiffrée en base et jamais renvoyée par l’interface. Elle vous appartient : Boussole
              n’utilise aucun compte partagé.
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-lg bg-(--color-surface-sunken) p-3 text-sm">
            <input
              type="checkbox"
              name="llmConsent"
              value="1"
              defaultChecked={settings.llm.consent}
              className="mt-0.5"
            />
            <span>
              J’accepte que des données de mon profil, pseudonymisées, soient transmises à ce
              service tiers.
              <span className="mt-0.5 block text-xs text-(--color-ink-faint)">
                Sans cette case, aucun appel n’est effectué, même avec une clé valide.
              </span>
            </span>
          </label>
        </>
      )}

      {isLocal && (
        <p className="rounded-lg bg-(--color-surface-sunken) p-3 text-sm text-(--color-ink-muted)">
          Modèle local : aucune clé et aucun consentement ne sont demandés, puisque rien ne quitte
          votre machine. Vérifier qu’Ollama est démarré (<code>ollama serve</code>).
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {result && (
          <span
            className={`text-sm ${result.ok ? 'text-(--color-priority)' : 'text-(--color-warn)'}`}
          >
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
