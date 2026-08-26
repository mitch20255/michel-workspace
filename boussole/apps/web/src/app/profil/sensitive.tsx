'use client';

import { useActionState, useState } from 'react';
import { saveSensitiveAnswer, type ActionResult } from './actions';

/**
 * Saisie d'une réponse à une question sensible.
 *
 * Trois états seulement, et le champ de valeur n'apparaît que pour
 * « répondre ». C'est volontaire : « je préfère ne pas répondre » ne doit pas
 * pouvoir laisser une valeur résiduelle derrière lui, qui serait ensuite
 * pré-remplie dans un formulaire d'employeur.
 */
export function SensitiveAnswerForm({ labels }: { labels: Record<string, string> }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    saveSensitiveAnswer,
    null,
  );
  const [state, setState] = useState('answered');

  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          name="key"
          required
          defaultValue=""
          className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choisir un champ…
          </option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          name="state"
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm"
        >
          <option value="answered">Répondre</option>
          <option value="declined">Préfère ne pas répondre</option>
          <option value="needs_input">Laisser à renseigner</option>
        </select>
      </div>

      {state === 'answered' && (
        <input
          name="value"
          required
          placeholder="Votre réponse exacte, telle qu’elle sera réutilisée"
          className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken) disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {result && (
          <span
            className={`text-xs ${result.ok ? 'text-(--color-priority)' : 'text-(--color-warn)'}`}
          >
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
