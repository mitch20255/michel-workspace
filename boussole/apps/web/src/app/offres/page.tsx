import Link from 'next/link';
import { apiSafe } from '@/lib/api';
import type { JobListResponse } from '@/lib/types';
import {
  Card,
  DecisionBadge,
  Empty,
  GhostBadge,
  ScoreDot,
  formatSalary,
  relativeDays,
  remoteLabel,
  seniorityLabel,
} from '@/components/ui';
import { rescoreAll } from './actions';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'generate_documents', label: 'Prioritaires' },
  { value: 'shortlist', label: 'Shortlist' },
  { value: 'maybe', label: 'À considérer' },
  { value: 'reject', label: 'Écartées' },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string; q?: string; doublons?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: '100' });
  if (params.decision) query.set('decision', params.decision);
  if (params.q) query.set('search', params.q);
  // Les doublons sont masqués par défaut : c'est tout l'intérêt de la
  // déduplication. L'utilisateur peut les afficher pour vérifier.
  if (params.doublons === '1') query.set('collapseDuplicates', 'false');

  const data = await apiSafe<JobListResponse>(`/jobs?${query.toString()}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Offres</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            {data?.total ?? 0} offre(s){params.doublons === '1' ? ', doublons inclus' : ''}
          </p>
        </div>
        <form action={rescoreAll}>
          <button
            type="submit"
            className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
          >
            Recalculer les scores
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = (params.decision ?? '') === filter.value;
          const href = filter.value ? `/offres?decision=${filter.value}` : '/offres';
          return (
            <Link
              key={filter.label}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-(--color-accent) text-white'
                  : 'border border-(--color-border-subtle) hover:bg-(--color-surface-sunken)'
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
        <Link
          href={params.doublons === '1' ? '/offres' : '/offres?doublons=1'}
          className="ml-auto text-xs text-(--color-ink-muted) hover:text-(--color-ink)"
        >
          {params.doublons === '1' ? 'Masquer les doublons' : 'Afficher les doublons'}
        </Link>
      </div>

      <Card>
        {!data || data.jobs.length === 0 ? (
          <Empty>
            Aucune offre.{' '}
            <Link href="/sources" className="text-(--color-accent) hover:underline">
              Ajouter une source d’offres
            </Link>{' '}
            pour lancer une ingestion.
          </Empty>
        ) : (
          <ul className="divide-y divide-(--color-border-subtle)">
            {data.jobs.map((job) => {
              const salary = formatSalary(job.salary);
              return (
                <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/offres/${job.id}`} className="group block">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium group-hover:text-(--color-accent)">
                            {job.title}
                          </span>
                          {job.status !== 'active' && (
                            <span
                              className="rounded bg-(--color-surface-sunken) px-1.5 py-0.5 text-[0.7rem] text-(--color-ink-faint)"
                              title="L’offre n’apparaît plus chez l’employeur. Elle est conservée, pas supprimée."
                            >
                              retirée
                            </span>
                          )}
                          {job.isDuplicateOf && (
                            <span className="rounded bg-(--color-surface-sunken) px-1.5 py-0.5 text-[0.7rem] text-(--color-ink-faint)">
                              doublon
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-(--color-ink-muted)">
                          {job.companyName}
                          {job.locationRaw ? ` · ${job.locationRaw}` : ''} ·{' '}
                          {remoteLabel(job.remotePolicy)} · {seniorityLabel(job.seniority)}
                          {salary ? ` · ${salary}` : ''}
                        </div>
                        {job.scoreSummary && (
                          <p className="mt-1 line-clamp-1 text-xs text-(--color-ink-faint)">
                            {job.scoreSummary}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-xs text-(--color-ink-faint) sm:inline">
                          {relativeDays(job.firstSeenAt)}
                        </span>
                        <GhostBadge score={job.ghostScore} />
                        <DecisionBadge decision={job.decision} />
                        <ScoreDot score={job.score} decision={job.decision} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
