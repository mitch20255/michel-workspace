'use client';

/**
 * Erreur dans une page.
 *
 * Le message technique n'est pas affiché : il peut contenir un fragment de
 * données de profil. Ce qui est montré, c'est la cause probable et la marche
 * à suivre — l'API arrêtée est de loin le cas le plus fréquent en local.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) px-5 py-6">
      <h1 className="text-sm font-semibold">Cette page n’a pas pu s’afficher</h1>
      <p className="mt-2 text-sm text-(--color-ink-muted)">
        Cause la plus fréquente : l’API n’est pas démarrée, ou{' '}
        <code className="rounded bg-(--color-surface-sunken) px-1">API_TOKEN</code> diffère entre
        l’API et l’interface. Le détail technique se trouve dans les journaux du serveur.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
      >
        Réessayer
      </button>
    </div>
  );
}
