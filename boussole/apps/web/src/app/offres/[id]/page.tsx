import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiSafe } from '@/lib/api';
import type {
  GeneratedDocumentDetail,
  InterviewPrepResponse,
  JobDetailResponse,
  KeywordGapItem,
} from '@/lib/types';
import {
  Card,
  Confidence,
  DecisionBadge,
  Empty,
  Meter,
  ScoreDot,
  formatDate,
  formatSalary,
  relativeDays,
  remoteLabel,
  seniorityLabel,
} from '@/components/ui';
import { generateDocuments, rescoreOne, trackJob } from '../actions';
import { DocumentsCard } from './documents';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [detail, prep, documents] = await Promise.all([
    apiSafe<JobDetailResponse>(`/jobs/${id}`),
    apiSafe<InterviewPrepResponse>(`/jobs/${id}/interview-prep`),
    apiSafe<GeneratedDocumentDetail[]>(`/documents?jobId=${id}&withRewrites=true`),
  ]);

  if (!detail) notFound();

  const { job, score } = detail;
  const salary = formatSalary(job.salary ?? null);
  const gap = score?.keywordGap;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/offres" className="text-xs text-(--color-ink-muted) hover:underline">
            ← Toutes les offres
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            {job.companyName}
            {job.department ? ` · ${job.department}` : ''}
            {job.locationRaw ? ` · ${job.locationRaw}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DecisionBadge decision={score?.decision ?? null} />
          <ScoreDot score={score?.score ?? null} decision={score?.decision ?? null} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={trackJob.bind(null, id)}>
          <button
            type="submit"
            className="rounded-lg bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white"
          >
            Suivre dans le CRM
          </button>
        </form>
        <form action={generateDocuments.bind(null, id)}>
          <button
            type="submit"
            className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
          >
            Générer CV et lettre
          </button>
        </form>
        <form action={rescoreOne.bind(null, id)}>
          <button
            type="submit"
            className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
          >
            Recalculer le score
          </button>
        </form>
        {job.applyUrl && (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-(--color-border-subtle) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-surface-sunken)"
          >
            Ouvrir l’annonce ↗
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* --- Explication du score ------------------------------------- */}
          <Card title="Pourquoi ce score" subtitle={score?.summary ?? 'Offre pas encore évaluée'}>
            {!score ? (
              <Empty>Lancer « Recalculer le score » pour évaluer cette offre.</Empty>
            ) : (
              <div className="space-y-4">
                {score.blockers.length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-(--color-reject-soft) px-3 py-2 text-sm text-(--color-reject)">
                    {score.blockers.map((blocker) => (
                      <li key={blocker}>Écartée : {blocker}</li>
                    ))}
                  </ul>
                )}

                {score.warnings.length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-(--color-warn-soft) px-3 py-2 text-sm text-(--color-warn)">
                    {score.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}

                <ul className="space-y-3">
                  {score.criteria.map((criterion) => (
                    <li key={criterion.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={`text-sm ${criterion.evaluated ? '' : 'text-(--color-ink-faint)'}`}
                        >
                          {criterion.label}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-(--color-ink-muted)">
                          {criterion.evaluated
                            ? `${Math.round(criterion.score * 100)} %`
                            : 'non évalué'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Meter
                          value={criterion.evaluated ? criterion.score : 0}
                          muted={!criterion.evaluated}
                        />
                      </div>
                      <p className="mt-1 text-xs text-(--color-ink-faint)">
                        {criterion.explanation}
                      </p>
                    </li>
                  ))}
                </ul>

                <p className="border-t border-(--color-border-subtle) pt-3 text-xs text-(--color-ink-faint)">
                  Un critère non évaluable est retiré du calcul, jamais compté zéro : une offre
                  discrète ne doit pas être pénalisée. En contrepartie, une offre trop peu
                  documentée voit son score plafonné.
                </p>
              </div>
            )}
          </Card>

          {/* --- Écart de mots-clés --------------------------------------- */}
          {gap && (
            <Card
              title="Écart de mots-clés"
              subtitle={`${Math.round(gap.coverage * 100)} % des compétences demandées sont couvertes par votre profil`}
            >
              <div className="space-y-4">
                <KeywordGroup
                  title="À faire ressortir dans le CV"
                  hint="Vous possédez ces compétences, mais elles n’apparaissent pas dans la version envoyée."
                  items={gap.safeToAdd}
                  tone="accent"
                />
                <TransferableGroup items={gap.transferable} />
                <KeywordGroup
                  title="Écarts réels"
                  hint="Absentes de votre profil, sans compétence voisine. Boussole ne les écrira jamais dans un document."
                  items={gap.realGaps.filter((item) => item.status === 'not_in_profile')}
                  tone="warn"
                />
                <KeywordGroup title="Déjà couvertes" items={gap.matched} tone="muted" collapsed />
              </div>
            </Card>
          )}

          {/* --- Documents générés ---------------------------------------- */}
          {documents && documents.length > 0 && (
            <Card
              title="Documents générés"
              subtitle="Ce qui a été reformulé, et ce que cela déplace"
            >
              <DocumentsCard documents={documents} />
            </Card>
          )}

          {/* --- Description ---------------------------------------------- */}
          <Card title="Annonce">
            {job.sections.requirements.length > 0 && (
              <Section title="Exigences" items={job.sections.requirements} />
            )}
            {job.sections.responsibilities.length > 0 && (
              <Section title="Responsabilités" items={job.sections.responsibilities} />
            )}
            {job.sections.benefits.length > 0 && (
              <Section title="Avantages" items={job.sections.benefits} />
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-(--color-ink-muted)">
                Texte intégral de l’annonce
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-(--color-surface-sunken) p-3 text-xs leading-relaxed">
                {job.descriptionText}
              </pre>
            </details>
          </Card>
        </div>

        <div className="space-y-6">
          {/* --- Faits de l'offre ----------------------------------------- */}
          <Card title="En bref">
            <dl className="space-y-2 text-sm">
              <Fact label="Mode de travail">
                {remoteLabel(job.remotePolicy)}
                <Confidence level={job.remoteConfidence} />
              </Fact>
              <Fact label="Niveau">
                {seniorityLabel(job.seniority)}
                <Confidence level={job.seniorityConfidence} />
              </Fact>
              <Fact label="Rémunération">
                {salary ?? <span className="text-(--color-ink-faint)">non publiée</span>}
                {job.salary && <Confidence level={job.salary.confidence} />}
              </Fact>
              <Fact label="Langue de l’annonce">
                {job.language === 'fr'
                  ? 'Français'
                  : job.language === 'en'
                    ? 'Anglais'
                    : 'Indéterminée'}
              </Fact>
              <Fact label="Première détection">
                {formatDate(job.firstSeenAt)}{' '}
                <span className="text-(--color-ink-faint)">({relativeDays(job.firstSeenAt)})</span>
              </Fact>
              <Fact label="Vue">{job.seenCount} fois</Fact>
            </dl>

            {job.salary?.evidence && (
              <p className="mt-3 rounded-lg bg-(--color-surface-sunken) p-2 text-xs text-(--color-ink-muted)">
                Extrait ayant servi à lire le salaire : « {job.salary.evidence} »
              </p>
            )}
          </Card>

          {/* --- Signaux fantôme ------------------------------------------ */}
          {job.ghostSignals.length > 0 && (
            <Card
              title={`Signaux de fiabilité (${job.ghostScore}/100)`}
              subtitle="Indices faibles, jamais un verdict"
            >
              <ul className="space-y-2">
                {job.ghostSignals.map((signal) => (
                  <li key={signal.code} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span>{signal.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-(--color-ink-faint)">
                        +{signal.weight}
                      </span>
                    </div>
                    {signal.detail && (
                      <p className="text-xs text-(--color-ink-faint)">{signal.detail}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detail.duplicates.length > 0 && (
            <Card title="Doublons regroupés">
              <ul className="space-y-1 text-sm">
                {detail.duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    <Link
                      href={`/offres/${duplicate.id}`}
                      className="hover:text-(--color-accent) hover:underline"
                    >
                      {duplicate.title}
                    </Link>
                    <span className="ml-1 text-xs text-(--color-ink-faint)">
                      ({duplicate.atsProvider})
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* --- Préparation d'entretien ---------------------------------- */}
          {prep && (
            <Card
              title="Préparation d’entretien"
              subtitle={
                prep.enhancedByLlm
                  ? 'Enrichie par un modèle de langage'
                  : 'Générée sans modèle de langage'
              }
            >
              {prep.risks.length > 0 && (
                <ul className="mb-3 space-y-1 rounded-lg bg-(--color-warn-soft) px-3 py-2 text-xs text-(--color-warn)">
                  {prep.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              )}

              <ol className="space-y-3">
                {prep.questions.slice(0, 6).map((question) => (
                  <li key={question.question} className="text-sm">
                    <div className="font-medium">{question.question}</div>
                    <p className="mt-0.5 text-xs text-(--color-ink-faint)">{question.rationale}</p>
                  </li>
                ))}
              </ol>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-(--color-ink-muted)">
                  Questions à poser au recruteur ({prep.questionsToAsk.length})
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {prep.questionsToAsk.map((question) => (
                    <li key={question}>— {question}</li>
                  ))}
                </ul>
              </details>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-(--color-ink-muted)">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
        {title}
      </h3>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-(--color-ink-faint)">
              —
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Exigences approchées par une compétence voisine.
 *
 * Affichées à part, et avec leur phrase complète plutôt qu'en pastilles : ce
 * groupe ne sert pas à compter, il sert à **copier**. La phrase proposée
 * nomme la compétence possédée et l'écart dans la même ligne — c'est ce
 * couple qui la rend défendable, et c'est pour ça qu'elle n'est jamais
 * proposée à moitié.
 */
function TransferableGroup({ items }: { items: KeywordGapItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
        Approchées par une compétence voisine ({items.length})
      </h3>
      <p className="mb-2 text-xs text-(--color-ink-faint)">
        Absentes de votre profil, donc jamais écrites dans le CV. Mais vous pratiquez quelque chose
        de proche : le dire dans la lettre vaut mieux que le silence, qui laisse conclure au pire.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.keyword}
            className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-sunken) p-2.5 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium">{item.keyword}</span>
              {item.required && <span className="text-xs text-(--color-warn)">exigée</span>}
              {item.transferable && (
                <span className="text-xs text-(--color-ink-faint)">
                  via {item.transferable.via} — {item.transferable.domain}
                </span>
              )}
            </div>
            {item.bridge && (
              <p className="mt-1.5 border-l-2 border-(--color-accent) pl-2 text-xs italic text-(--color-ink-muted)">
                {item.bridge}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeywordGroup({
  title,
  hint,
  items,
  tone,
  collapsed = false,
}: {
  title: string;
  hint?: string;
  items: KeywordGapItem[];
  tone: 'accent' | 'warn' | 'muted';
  collapsed?: boolean;
}) {
  if (items.length === 0) return null;

  const styles = {
    accent: 'bg-(--color-accent-soft) text-(--color-accent)',
    warn: 'bg-(--color-warn-soft) text-(--color-warn)',
    muted: 'bg-(--color-surface-sunken) text-(--color-ink-muted)',
  }[tone];

  const body = (
    <>
      {hint && <p className="mb-2 text-xs text-(--color-ink-faint)">{hint}</p>}
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.keyword}
            className={`rounded-md px-2 py-0.5 text-xs ${styles}`}
            title={item.advice}
          >
            {item.keyword}
            {item.required && <span aria-label="exigée"> *</span>}
          </li>
        ))}
      </ul>
    </>
  );

  if (collapsed) {
    return (
      <details>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
          {title} ({items.length})
        </summary>
        <div className="mt-2">{body}</div>
      </details>
    );
  }

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
        {title} ({items.length})
      </h3>
      {body}
    </div>
  );
}
