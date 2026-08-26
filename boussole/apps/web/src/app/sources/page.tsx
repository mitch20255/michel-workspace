import { apiSafe } from '@/lib/api';
import type { SourceSummary, StatusResponse } from '@/lib/types';
import { Card, Empty, formatDateTime } from '@/components/ui';
import { AddSourceForm, ManualJobForm } from './forms';
import { ingestAll, ingestOne, removeSource } from './actions';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const [sources, status] = await Promise.all([
    apiSafe<SourceSummary[]>('/sources'),
    apiSafe<StatusResponse>('/status'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sources d’offres</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Boussole interroge uniquement des API publiques et documentées, à un rythme mesuré.
            Aucun contournement de protection anti-robot.
          </p>
        </div>
        {sources && sources.length > 0 && (
          <form action={ingestAll}>
            <button
              type="submit"
              className="rounded-lg bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white"
            >
              Lancer toutes les ingestions
            </button>
          </form>
        )}
      </div>

      <Card title="Sources suivies">
        {!sources || sources.length === 0 ? (
          <Empty>Aucune source. En ajouter une ci-dessous.</Empty>
        ) : (
          <ul className="divide-y divide-(--color-border-subtle)">
            {sources.map((source) => (
              <li key={source.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {source.label ?? source.boardToken}
                      <span className="ml-2 rounded bg-(--color-surface-sunken) px-1.5 py-0.5 text-[0.7rem] font-normal text-(--color-ink-muted)">
                        {source.provider}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-(--color-ink-muted)">
                      {source.lastRunAt ? (
                        <>
                          Dernière ingestion {formatDateTime(source.lastRunAt)} ·{' '}
                          <span
                            className={
                              source.lastRunOk ? 'text-(--color-priority)' : 'text-(--color-warn)'
                            }
                          >
                            {source.lastRunOk ? 'succès' : 'échec'}
                          </span>
                          {source.lastRunNote ? ` — ${source.lastRunNote}` : ''}
                        </>
                      ) : (
                        'jamais exécutée'
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <form action={ingestOne.bind(null, source.id)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
                      >
                        Ingérer
                      </button>
                    </form>
                    <form action={removeSource.bind(null, source.id)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm text-(--color-ink-muted) transition-colors hover:bg-(--color-surface-sunken)"
                      >
                        Retirer
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ajouter une source" subtitle="Tableau d’offres public d’un ATS">
          <AddSourceForm connectors={status?.connectors ?? []} />
        </Card>

        <Card
          title="Saisir une offre à la main"
          subtitle="Pour une annonce trouvée ailleurs — copier-coller la description"
        >
          <ManualJobForm />
        </Card>
      </div>

      <Card title="Pourquoi Workday n’est pas proposé">
        <p className="text-sm text-(--color-ink-muted)">
          Workday n’expose pas d’API publique : chaque client dispose d’un locataire distinct, les
          points d’accès sont des requêtes internes non documentées, et leur forme change sans
          préavis. Un connecteur Workday serait donc du scraping fragile déguisé, exactement ce que
          ce produit s’interdit. Les offres hébergées sur Workday restent ajoutables à la main.
        </p>
      </Card>
    </div>
  );
}
