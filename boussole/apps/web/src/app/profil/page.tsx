import { apiSafe } from '@/lib/api';
import type { ProfileResponse, SensitiveFieldStatus } from '@/lib/types';
import { Card, Empty, formatSalary } from '@/components/ui';
import { ProfileEditor } from './editor';
import { SensitiveAnswerForm } from './sensitive';

export const dynamic = 'force-dynamic';

const SENSITIVE_LABELS: Record<string, string> = {
  work_authorization: 'Autorisation de travail',
  visa_sponsorship_needed: 'Besoin de parrainage de visa',
  disability_status: 'Situation de handicap',
  gender: 'Genre',
  ethnicity: 'Origine ethnique',
  veteran_status: 'Statut de vétéran',
  eeo_other: 'Autres questions d’équité en emploi',
  salary_expectation: 'Prétentions salariales',
  availability: 'Disponibilité',
  exact_location: 'Adresse exacte',
  years_of_experience: 'Années d’expérience',
  criminal_record: 'Antécédents judiciaires',
  legal_consent: 'Consentements légaux',
  reference_contacts: 'Coordonnées de références',
  current_salary: 'Salaire actuel',
  date_of_birth: 'Date de naissance',
};

const STATE_LABELS: Record<string, { label: string; className: string }> = {
  answered: { label: 'Renseignée', className: 'text-(--color-priority)' },
  needs_input: { label: 'À renseigner', className: 'text-(--color-maybe)' },
  declined: { label: 'Refus de répondre', className: 'text-(--color-ink-muted)' },
};

export default async function ProfilePage() {
  const [profile, sensitive] = await Promise.all([
    apiSafe<ProfileResponse>('/profile'),
    apiSafe<SensitiveFieldStatus[]>('/profile/sensitive'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Profil candidat</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Tout ce qui apparaît dans un CV généré vient d’ici. Boussole ne peut rien ajouter que vous
          n’ayez déclaré.
        </p>
      </div>

      {profile ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card title="Résumé" subtitle="Lecture seule — modifier via l’éditeur ci-dessous">
            <dl className="space-y-3 text-sm">
              <Row label="Nom">
                {profile.identity.firstName} {profile.identity.lastName}
              </Row>
              <Row label="Titre">{profile.identity.headline ?? '—'}</Row>
              <Row label="Courriel">{profile.contact.email}</Row>
              <Row label="Localisation">{profile.location?.raw ?? '—'}</Row>
              <Row label="Expériences">{profile.experiences.length}</Row>
              <Row label="Compétences">{profile.skills.length}</Row>
              <Row label="Postes visés">{profile.preferences.targetTitles.join(', ') || '—'}</Row>
              <Row label="Prétentions">
                {formatSalary(
                  profile.preferences.salaryExpectation
                    ? {
                        min: profile.preferences.salaryExpectation.min,
                        max: profile.preferences.salaryExpectation.max ?? null,
                        currency: profile.preferences.salaryExpectation.currency,
                        period: profile.preferences.salaryExpectation.period,
                      }
                    : null,
                ) ?? 'non définies'}
              </Row>
            </dl>

            <p className="mt-4 border-t border-(--color-border-subtle) pt-3 text-xs text-(--color-ink-faint)">
              Courriel, téléphone et adresse sont chiffrés en base. Les intitulés, compétences et
              réalisations restent en clair : ils doivent rester interrogeables pour le scoring, et
              figurent de toute façon sur un CV que vous diffusez.
            </p>
          </Card>

          <Card
            title="Champs sensibles"
            subtitle="Jamais devinés — un champ non renseigné bloque le pré-remplissage"
          >
            {!sensitive ? (
              <Empty>Indisponible.</Empty>
            ) : (
              <ul className="space-y-2">
                {sensitive.map((field) => {
                  const state = STATE_LABELS[field.state] ?? STATE_LABELS.needs_input!;
                  return (
                    <li key={field.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {SENSITIVE_LABELS[field.key] ?? field.key}
                      </span>
                      <span className={`shrink-0 text-xs ${state.className}`}>{state.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 border-t border-(--color-border-subtle) pt-4">
              <SensitiveAnswerForm labels={SENSITIVE_LABELS} />
            </div>

            <p className="mt-3 text-xs text-(--color-ink-faint)">
              Ces réponses sont chiffrées et ne sont jamais renvoyées par l’interface — seul leur
              état est affiché. Aucune n’est transmise à un modèle de langage.
            </p>
          </Card>
        </div>
      ) : (
        <Card title="Aucun profil">
          <Empty>
            Créer un profil ci-dessous. Un exemple valide est pré-rempli pour servir de gabarit.
          </Empty>
        </Card>
      )}

      <ProfileEditor initial={profile ?? null} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-(--color-ink-muted)">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
