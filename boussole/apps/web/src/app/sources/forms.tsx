'use client';

import { useActionState } from 'react';
import type { ActionResult } from '../profil/actions';
import { addManualJob, addSource } from './actions';

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={`text-xs ${result.ok ? 'text-(--color-priority)' : 'text-(--color-warn)'}`}>
      {result.message}
    </p>
  );
}

const inputClass =
  'w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface) px-2 py-1.5 text-sm';

export function AddSourceForm({
  connectors,
}: {
  connectors: Array<{ id: string; label: string; boardHint: string; apiDocsUrl: string }>;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(addSource, null);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="provider">
          Fournisseur
        </label>
        <select id="provider" name="provider" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choisir…
          </option>
          {connectors.map((connector) => (
            <option key={connector.id} value={connector.id}>
              {connector.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="boardToken">
          Identifiant du tableau d’offres
        </label>
        <input id="boardToken" name="boardToken" required className={inputClass} />
        {/* L'indice de chaque connecteur est affiché en clair : trouver ce
            jeton dans une URL est la seule étape non évidente de la mise en
            place. */}
        <ul className="mt-1.5 space-y-0.5 text-[0.7rem] text-(--color-ink-faint)">
          {connectors.map((connector) => (
            <li key={connector.id}>
              <strong>{connector.label}</strong> — {connector.boardHint}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="label">
          Nom affiché (facultatif)
        </label>
        <input id="label" name="label" className={inputClass} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken) disabled:opacity-60"
        >
          {pending ? 'Ajout…' : 'Ajouter la source'}
        </button>
        <Feedback result={result} />
      </div>
    </form>
  );
}

export function ManualJobForm() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    addManualJob,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="companyName">
            Entreprise
          </label>
          <input id="companyName" name="companyName" required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="title">
            Intitulé du poste
          </label>
          <input id="title" name="title" required className={inputClass} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="locationRaw">
            Localisation
          </label>
          <input
            id="locationRaw"
            name="locationRaw"
            placeholder="Montréal, QC"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="applyUrl">
            Lien vers l’annonce
          </label>
          <input id="applyUrl" name="applyUrl" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-(--color-ink-muted)" htmlFor="descriptionRaw">
          Description
        </label>
        <textarea
          id="descriptionRaw"
          name="descriptionRaw"
          rows={8}
          placeholder="Coller l’annonce telle quelle. Le HTML et les listes à puces sont reconnus, et les sections « Exigences » / « Responsabilités » sont détectées automatiquement."
          className={`${inputClass} font-mono text-xs`}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken) disabled:opacity-60"
        >
          {pending ? 'Ajout…' : 'Ajouter et évaluer'}
        </button>
        <Feedback result={result} />
      </div>
    </form>
  );
}
