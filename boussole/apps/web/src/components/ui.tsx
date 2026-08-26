import type { ReactNode } from 'react';

/**
 * Éléments d'interface partagés.
 *
 * Regroupés parce qu'un score, une décision et un signal de fiabilité
 * apparaissent dans quatre écrans différents : les dupliquer garantirait
 * qu'ils finissent par diverger, et l'utilisateur devrait relire le texte
 * plutôt que reconnaître la couleur.
 */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-(--color-border-subtle) px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-(--color-ink-muted)">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const DECISION_STYLES: Record<string, { label: string; fg: string; bg: string }> = {
  generate_documents: {
    label: 'Prioritaire',
    fg: 'text-(--color-priority)',
    bg: 'bg-(--color-priority-soft)',
  },
  shortlist: {
    label: 'Shortlist',
    fg: 'text-(--color-shortlist)',
    bg: 'bg-(--color-shortlist-soft)',
  },
  maybe: { label: 'À considérer', fg: 'text-(--color-maybe)', bg: 'bg-(--color-maybe-soft)' },
  reject: { label: 'Écartée', fg: 'text-(--color-reject)', bg: 'bg-(--color-reject-soft)' },
};

export function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return (
      <span className="inline-flex items-center rounded-md bg-(--color-surface-sunken) px-2 py-0.5 text-xs text-(--color-ink-faint)">
        Non évaluée
      </span>
    );
  }
  const style = DECISION_STYLES[decision] ?? DECISION_STYLES.reject!;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${style.bg} ${style.fg}`}
    >
      {style.label}
    </span>
  );
}

/** Score sur 100, coloré selon la décision associée. */
export function ScoreDot({ score, decision }: { score: number | null; decision: string | null }) {
  if (score === null) {
    return <span className="tabular-nums text-sm text-(--color-ink-faint)">—</span>;
  }
  const style = decision ? (DECISION_STYLES[decision] ?? DECISION_STYLES.reject!) : null;
  return (
    <span
      className={`tabular-nums text-sm font-semibold ${style?.fg ?? 'text-(--color-ink-muted)'}`}
    >
      {score}
      <span className="text-[0.7em] font-normal text-(--color-ink-faint)">/100</span>
    </span>
  );
}

/**
 * Indice d'offre fantôme.
 *
 * Présenté comme un signal faible et jamais comme un verdict : l'étiquette
 * dit « signaux », pas « offre fantôme », et le détail reste consultable.
 */
export function GhostBadge({ score }: { score: number }) {
  if (score < 25) return null;
  const suspicious = score >= 55;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
        suspicious
          ? 'bg-(--color-warn-soft) text-(--color-warn)'
          : 'bg-(--color-surface-sunken) text-(--color-ink-muted)'
      }`}
      title={`Indice de suspicion : ${score}/100. Signal faible, à vérifier — jamais un verdict.`}
    >
      {suspicious ? 'Signaux fantôme' : 'Quelques signaux'} {score}
    </span>
  );
}

/** Marqueur de fiabilité d'une donnée déduite. */
export function Confidence({ level }: { level: string }) {
  if (level === 'high') return null;
  return (
    <span
      className="ml-1.5 align-middle text-[0.7rem] text-(--color-ink-faint)"
      title={
        level === 'medium'
          ? 'Déduit du texte de l’annonce : fiable, mais à vérifier.'
          : 'Déduction incertaine : à vérifier dans l’annonce.'
      }
    >
      {level === 'medium' ? '(déduit)' : '(incertain)'}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-(--color-ink-muted)">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-4 py-3">
      <div className="text-xs text-(--color-ink-muted)">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-(--color-ink-faint)">{hint}</div>}
    </div>
  );
}

/** Barre de progression d'un critère de scoring. */
export function Meter({ value, muted = false }: { value: number; muted?: boolean }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-surface-sunken)"
      role="img"
      aria-label={`${percent} %`}
    >
      <div
        className={`h-full rounded-full ${muted ? 'bg-(--color-ink-faint)' : 'bg-(--color-accent)'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

const REMOTE_LABELS: Record<string, string> = {
  remote: 'À distance',
  hybrid: 'Hybride',
  onsite: 'Présentiel',
  unknown: 'Mode non précisé',
};

export function remoteLabel(policy: string): string {
  return REMOTE_LABELS[policy] ?? policy;
}

const SENIORITY_LABELS: Record<string, string> = {
  intern: 'Stage',
  junior: 'Junior',
  mid: 'Intermédiaire',
  senior: 'Senior',
  staff: 'Staff',
  principal: 'Principal',
  lead: 'Lead',
  manager: 'Gestion',
  director: 'Direction',
  executive: 'Exécutif',
  unknown: 'Niveau non précisé',
};

export function seniorityLabel(seniority: string): string {
  return SENIORITY_LABELS[seniority] ?? seniority;
}

export function formatSalary(
  salary: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    period?: string | null;
  } | null,
): string | null {
  if (!salary?.min && !salary?.max) return null;

  const format = (value: number) =>
    new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 }).format(value);

  const currency = salary.currency ?? '';
  const period =
    salary.period === 'hour'
      ? '/h'
      : salary.period === 'month'
        ? '/mois'
        : salary.period === 'year'
          ? '/an'
          : '';

  if (salary.min && salary.max && salary.min !== salary.max) {
    return `${format(salary.min)} – ${format(salary.max)} ${currency}${period}`.trim();
  }
  return `${format(salary.min ?? salary.max!)} ${currency}${period}`.trim();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** « il y a 3 jours ». Utile pour juger la fraîcheur d'une offre d'un coup d'œil. */
export function relativeDays(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'il y a 1 mois' : `il y a ${months} mois`;
}
