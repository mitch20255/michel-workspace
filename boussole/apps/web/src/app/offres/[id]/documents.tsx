import type { GeneratedDocumentDetail, ImpactTone, RewrittenBullet } from '@/lib/types';
import { formatDate } from '@/components/ui';

/**
 * Documents générés pour cette offre, et **ce qui a été réécrit**.
 *
 * L'avant/après n'est pas un détail technique replié tout en bas : c'est la
 * contrepartie du cadran d'impact. Une reformulation assumée et relue est
 * défendable en entretien ; la même reformulation découverte par le candidat
 * au moment où le recruteur la lit à voix haute ne l'est pas.
 *
 * Les transformations qui déplacent la portée d'une affirmation sont donc
 * sorties du repli et affichées d'emblée.
 */

const TONE_LABELS: Record<ImpactTone, string> = {
  factual: 'fidèle',
  confident: 'affirmé',
  assertive: 'offensif',
};

const EDIT_LABELS: Record<string, string> = {
  outcome_first: 'résultat en tête',
  weakener_removed: 'remplissage retiré',
  hedge_removed: 'atténuateur retiré',
  term_aligned: 'vocabulaire de l’offre',
  tidied: 'mise en forme',
};

export function DocumentsCard({ documents }: { documents: GeneratedDocumentDetail[] }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-(--color-ink-faint)">Aucun document généré pour cette offre.</p>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((document) => {
        const scopeChanging = document.rewrites.filter((rewrite) =>
          rewrite.edits.some((edit) => edit.kind === 'hedge_removed'),
        );
        const other = document.rewrites.filter((rewrite) => !scopeChanging.includes(rewrite));

        return (
          <div
            key={document.id}
            className="rounded-lg border border-(--color-border-subtle) p-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">
                {document.kind === 'cv' ? 'CV' : 'Lettre'} v{document.version}
                <span className="ml-2 text-xs font-normal text-(--color-ink-faint)">
                  {document.language.toUpperCase()} · ton {TONE_LABELS[document.tone]} ·{' '}
                  {formatDate(document.createdAt)}
                </span>
              </span>
              {document.pdfPath && (
                <span className="text-xs text-(--color-ink-faint)">PDF disponible</span>
              )}
            </div>

            {scopeChanging.length > 0 && (
              <div className="mt-3 rounded-lg bg-(--color-warn-soft) p-2.5">
                <p className="text-xs font-semibold text-(--color-warn)">
                  {scopeChanging.length} formulation
                  {scopeChanging.length > 1 ? 's' : ''} dont la portée a changé — à relire avant
                  envoi
                </p>
                <p className="mt-0.5 text-xs text-(--color-ink-muted)">
                  Le fait reste vrai, mais votre part exacte n’est plus précisée par la phrase.
                  Soyez prêt à la décrire en entretien.
                </p>
                <ul className="mt-2 space-y-2">
                  {scopeChanging.map((rewrite) => (
                    <RewriteDiff key={rewrite.original} rewrite={rewrite} />
                  ))}
                </ul>
              </div>
            )}

            {other.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-(--color-ink-muted)">
                  {other.length} autre{other.length > 1 ? 's' : ''} reformulation
                  {other.length > 1 ? 's' : ''} (ordre et vocabulaire seulement)
                </summary>
                <ul className="mt-2 space-y-2">
                  {other.map((rewrite) => (
                    <RewriteDiff key={rewrite.original} rewrite={rewrite} />
                  ))}
                </ul>
              </details>
            )}

            {document.rewrites.length === 0 && (
              <p className="mt-2 text-xs text-(--color-ink-faint)">
                Aucune puce modifiée : le document reprend votre profil mot pour mot.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RewriteDiff({ rewrite }: { rewrite: RewrittenBullet }) {
  return (
    <li className="text-xs">
      <p className="text-(--color-ink-faint) line-through decoration-1">{rewrite.original}</p>
      <p className="mt-0.5 text-(--color-ink)">{rewrite.text}</p>
      <p className="mt-0.5 text-(--color-ink-faint)">
        {rewrite.edits.map((edit) => EDIT_LABELS[edit.kind] ?? edit.kind).join(' · ')}
      </p>
    </li>
  );
}
