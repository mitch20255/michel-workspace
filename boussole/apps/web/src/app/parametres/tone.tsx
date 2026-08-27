'use client';

import { useActionState, useState } from 'react';
import type { ImpactTone, SettingsResponse } from '@/lib/types';
import type { ActionResult } from '../profil/actions';
import { saveDocumentTone } from './actions';

/**
 * Cadran d'impact.
 *
 * Deux partis pris d'interface :
 *
 *  1. **La mise en garde est affichée en permanence, pas au survol.** Un
 *     cadran dont on ne voit que le nom des crans invite à monter au maximum
 *     sans savoir ce que le dernier cran déplace.
 *  2. **Le dernier cran s'annonce lui-même.** Passer en « offensif » affiche
 *     ce qui va changer dans les documents avant l'enregistrement, pas après.
 */
export function DocumentToneForm({ settings }: { settings: SettingsResponse }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    saveDocumentTone,
    null,
  );
  const [tone, setTone] = useState<ImpactTone>(settings.documents.tone);

  return (
    <form action={action} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="sr-only">Niveau de réécriture</legend>

        {settings.documents.available.map((entry) => (
          <label
            key={entry.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
              tone === entry.id
                ? 'border-(--color-accent) bg-(--color-surface-sunken)'
                : 'border-(--color-border-subtle)'
            }`}
          >
            <input
              type="radio"
              name="documentTone"
              value={entry.id}
              checked={tone === entry.id}
              onChange={() => setTone(entry.id)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{entry.label}</span>
              <span className="mt-0.5 block text-xs text-(--color-ink-faint)">{entry.caveat}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {tone === 'assertive' && (
        <p className="rounded-lg bg-(--color-surface-sunken) p-3 text-xs text-(--color-ink-muted)">
          Ce niveau retire les atténuateurs de rôle : « participé à la refonte » devient « refonte
          ». Aucun fait n’est ajouté — c’est vérifié mécaniquement à chaque puce — mais votre part
          exacte n’est plus bornée par la phrase. Chaque document généré affichera l’avant/après des
          puces concernées.
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
