import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) px-5 py-6">
      <h1 className="text-sm font-semibold">Page introuvable</h1>
      <p className="mt-2 text-sm text-(--color-ink-muted)">
        Cette offre ou cette page n’existe pas — ou plus.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
