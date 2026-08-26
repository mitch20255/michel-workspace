import { apiSafe } from '@/lib/api';
import type { AuditResponse } from '@/lib/types';
import { Card, Empty, formatDateTime } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const audit = await apiSafe<AuditResponse>('/audit?limit=200');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Journal</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Ce que Boussole a fait en votre nom. En ajout seul : aucune entrée ne peut être modifiée
          ni supprimée depuis l’interface — un journal effaçable ne prouve rien.
        </p>
      </div>

      <Card subtitle={audit ? `${audit.total} entrée(s)` : undefined} title="Historique">
        {!audit || audit.events.length === 0 ? (
          <Empty>Aucune action enregistrée pour l’instant.</Empty>
        ) : (
          <ul className="divide-y divide-(--color-border-subtle)">
            {audit.events.map((event) => (
              <li key={event.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm">{event.summary}</span>
                  <span className="shrink-0 text-xs text-(--color-ink-faint)">
                    {formatDateTime(event.at)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-(--color-ink-faint)">
                  <span
                    className="rounded bg-(--color-surface-sunken) px-1.5 py-0.5"
                    title={
                      event.actor === 'system'
                        ? 'Action déclenchée par une automatisation, pas par un clic.'
                        : 'Action déclenchée par vous.'
                    }
                  >
                    {event.actor === 'system' ? 'automatique' : 'vous'}
                  </span>
                  <span>{event.label}</span>
                  {Object.keys(event.metadata).length > 0 && (
                    <code className="truncate">{JSON.stringify(event.metadata)}</code>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-(--color-ink-faint)">
        Le journal ne contient jamais de valeur sensible : ni contenu de prompt, ni clé API, ni
        réponse à une question sensible. Seulement la nature de l’action et des compteurs.
      </p>
    </div>
  );
}
