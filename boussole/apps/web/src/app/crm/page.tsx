import Link from 'next/link';
import { apiSafe } from '@/lib/api';
import type { BoardColumn, StatsResponse } from '@/lib/types';
import { Card, Empty, GhostBadge, ScoreDot, Stat, formatDate } from '@/components/ui';
import { moveStage } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Étapes suivantes proposées.
 *
 * Miroir volontairement restreint de `ALLOWED_TRANSITIONS` côté domaine :
 * l'interface ne propose que des mouvements qui seront acceptés, plutôt que
 * de laisser l'utilisateur découvrir le refus après coup. L'API reste
 * l'autorité — c'est elle qui valide.
 */
const NEXT_STAGES: Record<string, Array<{ value: string; label: string }>> = {
  to_review: [
    { value: 'shortlist', label: 'Shortlist' },
    { value: 'rejected', label: 'Écarter' },
  ],
  shortlist: [
    { value: 'documents_ready', label: 'Documents générés' },
    { value: 'rejected', label: 'Écarter' },
  ],
  documents_ready: [
    { value: 'ready_to_apply', label: 'Prêt à candidater' },
    { value: 'rejected', label: 'Écarter' },
  ],
  ready_to_apply: [
    { value: 'applied', label: 'J’ai postulé' },
    { value: 'rejected', label: 'Écarter' },
  ],
  applied: [
    { value: 'interview', label: 'Entretien' },
    { value: 'follow_up_due', label: 'Relance à faire' },
    { value: 'rejected', label: 'Refus reçu' },
  ],
  follow_up_due: [
    { value: 'interview', label: 'Entretien' },
    { value: 'rejected', label: 'Refus reçu' },
  ],
  interview: [
    { value: 'technical_test', label: 'Test technique' },
    { value: 'offer', label: 'Offre reçue' },
    { value: 'rejected', label: 'Refus reçu' },
  ],
  technical_test: [
    { value: 'offer', label: 'Offre reçue' },
    { value: 'rejected', label: 'Refus reçu' },
  ],
  offer: [{ value: 'archived', label: 'Archiver' }],
  rejected: [{ value: 'archived', label: 'Archiver' }],
  archived: [{ value: 'to_review', label: 'Rouvrir' }],
};

export default async function CrmPage() {
  const [board, stats] = await Promise.all([
    apiSafe<BoardColumn[]>('/board'),
    apiSafe<StatsResponse>('/stats'),
  ]);

  if (!board) {
    return (
      <Card title="Candidatures">
        <Empty>
          Aucun profil enregistré.{' '}
          <Link href="/profil" className="text-(--color-accent) hover:underline">
            Créer un profil
          </Link>{' '}
          pour commencer.
        </Empty>
      </Card>
    );
  }

  // Les colonnes vides de fin de pipeline sont masquées tant qu'elles ne
  // servent pas : un tableau de onze colonnes vides n'aide personne.
  const visible = board.filter((column, index) => column.applications.length > 0 || index < 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Candidatures</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Aucune candidature n’est soumise par Boussole. Vous marquez vous-même « j’ai postulé ».
        </p>
      </div>

      {stats && stats.total > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="Soumises" value={stats.applied} />
          <Stat label="Entretiens" value={stats.interviews} />
          <Stat
            label="Taux d’entretien"
            value={
              stats.interviewRate === null ? '—' : `${Math.round(stats.interviewRate * 100)} %`
            }
            hint={stats.applied ? undefined : 'aucune candidature soumise'}
          />
        </div>
      )}

      {board.every((column) => column.applications.length === 0) ? (
        <Card>
          <Empty>
            Aucune candidature suivie.{' '}
            <Link href="/offres" className="text-(--color-accent) hover:underline">
              Parcourir les offres
            </Link>{' '}
            et cliquer sur « Suivre dans le CRM ».
          </Empty>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visible.map((column) => (
            <div key={column.stage} className="w-72 shrink-0">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <span className="text-xs tabular-nums text-(--color-ink-faint)">
                  {column.applications.length}
                </span>
              </div>

              <div className="space-y-2">
                {column.applications.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-(--color-border-subtle) px-3 py-6 text-center text-xs text-(--color-ink-faint)">
                    vide
                  </div>
                ) : (
                  column.applications.map((application) => (
                    <article
                      key={application.id}
                      className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/offres/${application.job.id}`}
                          className="min-w-0 text-sm font-medium hover:text-(--color-accent)"
                        >
                          {application.job.title}
                        </Link>
                        <ScoreDot score={application.score} decision={null} />
                      </div>

                      <div className="mt-0.5 truncate text-xs text-(--color-ink-muted)">
                        {application.job.companyName}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <GhostBadge score={application.job.ghostScore} />
                        {application.job.status !== 'active' && (
                          <span
                            className="rounded bg-(--color-surface-sunken) px-1.5 py-0.5 text-[0.7rem] text-(--color-ink-faint)"
                            title="L’annonce a disparu du site de l’employeur. Votre candidature reste suivie."
                          >
                            annonce retirée
                          </span>
                        )}
                        {application.documentCount > 0 && (
                          <span className="rounded bg-(--color-surface-sunken) px-1.5 py-0.5 text-[0.7rem] text-(--color-ink-faint)">
                            {application.documentCount} document(s)
                          </span>
                        )}
                      </div>

                      {application.appliedAt && (
                        <p className="mt-1.5 text-xs text-(--color-ink-faint)">
                          soumise le {formatDate(application.appliedAt)}
                        </p>
                      )}
                      {application.nextAction && (
                        <p className="mt-1 text-xs text-(--color-ink-muted)">
                          → {application.nextAction} ({formatDate(application.nextActionDueAt)})
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-1">
                        {(NEXT_STAGES[application.stage] ?? []).map((next) => (
                          <form
                            key={next.value}
                            action={moveStage.bind(null, application.id, next.value)}
                          >
                            <button
                              type="submit"
                              className="rounded border border-(--color-border-subtle) px-2 py-0.5 text-xs transition-colors hover:bg-(--color-surface-sunken)"
                            >
                              {next.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
