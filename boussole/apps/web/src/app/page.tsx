import Link from 'next/link';
import { apiSafe } from '@/lib/api';
import type { JobListResponse, StatsResponse, StatusResponse, ProfileResponse } from '@/lib/types';
import {
  Card,
  DecisionBadge,
  Empty,
  GhostBadge,
  ScoreDot,
  Stat,
  formatDate,
  relativeDays,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Reminder {
  id: string;
  label: string;
  dueAt: string;
  application: { id: string; job: { title: string; companyName: string } };
}

export default async function DashboardPage() {
  // Chargements parallèles et tolérants : une installation neuve n'a ni
  // profil ni offres, et le tableau de bord doit alors expliquer quoi faire
  // plutôt qu'afficher une erreur.
  const [status, stats, jobs, reminders, profile] = await Promise.all([
    apiSafe<StatusResponse>('/status'),
    apiSafe<StatsResponse>('/stats'),
    apiSafe<JobListResponse>('/jobs?limit=6'),
    apiSafe<Reminder[]>('/reminders?days=14'),
    apiSafe<ProfileResponse>('/profile'),
  ]);

  if (!status) {
    return (
      <Card title="API injoignable">
        <p className="text-sm text-(--color-ink-muted)">
          L’interface ne parvient pas à joindre l’API. Vérifier qu’elle est démarrée (
          <code className="rounded bg-(--color-surface-sunken) px-1">pnpm dev:api</code>) et que
          <code className="mx-1 rounded bg-(--color-surface-sunken) px-1">API_TOKEN</code> est
          identique des deux côtés.
        </p>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card title="Bienvenue dans Boussole">
        <p className="text-sm text-(--color-ink-muted)">
          Aucun profil candidat n’est encore enregistré. Tout part de là : le scoring, l’analyse
          d’écart de mots-clés et la génération documentaire s’appuient exclusivement sur ce que
          vous y déclarez.
        </p>
        <Link
          href="/profil"
          className="mt-4 inline-block rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white"
        >
          Créer mon profil
        </Link>
      </Card>
    );
  }

  const priority = (jobs?.jobs ?? []).filter(
    (job) => job.decision === 'generate_documents' || job.decision === 'shortlist',
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Bonjour {profile.identity.firstName}
        </h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          {status.counts.activeJobs} offre(s) active(s) suivie(s) · {status.counts.applications}{' '}
          candidature(s) · {status.counts.sources} source(s)
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Candidatures suivies" value={stats?.total ?? 0} />
        <Stat label="Soumises" value={stats?.applied ?? 0} />
        <Stat
          label="Taux d’entretien"
          value={
            stats?.interviewRate === null || stats?.interviewRate === undefined
              ? '—'
              : `${Math.round(stats.interviewRate * 100)} %`
          }
          // Un taux calculé sur zéro candidature n'est pas zéro : il n'existe pas.
          hint={stats?.applied ? `sur ${stats.applied} soumise(s)` : 'aucune candidature soumise'}
        />
        <Stat
          label="Modèle de langage"
          value={status.llm.provider === 'none' ? 'Désactivé' : status.llm.provider}
          hint={
            status.llm.provider === 'none'
              ? 'aucune donnée ne sort de la machine'
              : status.llm.consent
                ? 'consentement donné'
                : 'consentement requis'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card
          title="Offres à examiner en priorité"
          subtitle="Classées par score de compatibilité"
          actions={
            <Link href="/offres" className="text-xs text-(--color-accent) hover:underline">
              Tout voir
            </Link>
          }
        >
          {priority.length === 0 ? (
            <Empty>
              Aucune offre prioritaire pour l’instant.{' '}
              <Link href="/sources" className="text-(--color-accent) hover:underline">
                Ajouter une source
              </Link>{' '}
              ou{' '}
              <Link href="/offres" className="text-(--color-accent) hover:underline">
                saisir une offre
              </Link>
              .
            </Empty>
          ) : (
            <ul className="divide-y divide-(--color-border-subtle)">
              {priority.map((job) => (
                <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/offres/${job.id}`} className="group block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium group-hover:text-(--color-accent)">
                          {job.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-(--color-ink-muted)">
                          {job.companyName}
                          {job.locationRaw ? ` · ${job.locationRaw}` : ''} ·{' '}
                          {relativeDays(job.firstSeenAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <GhostBadge score={job.ghostScore} />
                        <DecisionBadge decision={job.decision} />
                        <ScoreDot score={job.score} decision={job.decision} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Relances à faire" subtitle="14 prochains jours">
          {!reminders || reminders.length === 0 ? (
            <Empty>Aucune relance prévue.</Empty>
          ) : (
            <ul className="space-y-3">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="text-sm">
                  <Link href={`/crm`} className="font-medium hover:text-(--color-accent)">
                    {reminder.label}
                  </Link>
                  <div className="text-xs text-(--color-ink-muted)">
                    {reminder.application.job.title} — {reminder.application.job.companyName}
                  </div>
                  <div className="text-xs text-(--color-ink-faint)">
                    échéance {formatDate(reminder.dueAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
