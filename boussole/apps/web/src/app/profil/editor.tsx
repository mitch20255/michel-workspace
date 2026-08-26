'use client';

import { useActionState } from 'react';
import { saveProfile, type ActionResult } from './actions';

/**
 * Éditeur de profil.
 *
 * Composant client uniquement pour l'état du formulaire : le jeton d'API
 * n'est jamais présent ici, l'envoi passe par une action serveur.
 */

const TEMPLATE = {
  id: 'principal',
  label: 'Profil principal',
  locale: 'fr-CA',
  identity: {
    firstName: 'Prénom',
    lastName: 'Nom',
    headline: 'Votre titre professionnel',
    summary: 'Deux phrases sur votre parcours. Repris tel quel dans le CV.',
  },
  contact: {
    email: 'vous@exemple.test',
    phone: '514-555-0100',
    publicLocation: 'Montréal, QC',
  },
  location: { city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal, QC' },
  experiences: [
    {
      id: 'exp_1',
      company: 'Employeur',
      title: 'Intitulé du poste',
      startDate: '2021-03',
      endDate: null,
      bullets: [
        'Une réalisation concrète, avec un chiffre si vous en avez un.',
        'Ces phrases sont les seules que Boussole peut reprendre dans un CV.',
      ],
      skills: ['TypeScript', 'React'],
      metrics: [],
    },
  ],
  projects: [],
  education: [
    {
      id: 'edu_1',
      institution: 'Établissement',
      degree: 'Diplôme',
      field: 'Domaine',
      startDate: '2013-09',
      endDate: '2017-05',
      completed: true,
    },
  ],
  certifications: [],
  skills: [{ name: 'TypeScript', level: 'advanced', yearsOfExperience: 5 }],
  languages: [{ language: 'Français', level: 'native' }],
  links: [],
  preferences: {
    targetTitles: ['Intitulé recherché'],
    excludedTitles: [],
    targetIndustries: [],
    excludedCompanies: [],
    remotePolicies: ['remote', 'hybrid'],
    locations: [{ city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal, QC' }],
    willingToRelocate: false,
    seniorityTargets: ['senior'],
    employmentTypes: ['full_time'],
    salaryExpectation: {
      min: 95000,
      currency: 'CAD',
      period: 'year',
      shareWithEmployers: false,
    },
    constraints: [],
  },
  sensitiveAnswers: [],
  cannedAnswers: [],
};

export function ProfileEditor({ initial }: { initial: unknown | null }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    saveProfile,
    null,
  );

  // Les réponses sensibles sont retirées du gabarit d'édition : elles ont leur
  // propre formulaire, et les faire transiter par un champ de texte visible
  // irait contre le fait qu'elles sont chiffrées.
  const seed = initial
    ? { ...(initial as Record<string, unknown>), sensitiveAnswers: [] }
    : TEMPLATE;

  return (
    <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised)">
      <header className="border-b border-(--color-border-subtle) px-5 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight">Éditeur de profil</h2>
        <p className="mt-0.5 text-xs text-(--color-ink-muted)">
          Format JSON, validé champ par champ à l’enregistrement. Un éditeur par sections est prévu
          ; le modèle de données, lui, est complet.
        </p>
      </header>

      <form action={action} className="px-5 py-4">
        <textarea
          name="profile"
          defaultValue={JSON.stringify(seed, null, 2)}
          spellCheck={false}
          rows={24}
          className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-sunken) p-3 font-mono text-xs leading-relaxed"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-(--color-accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer et recalculer les scores'}
          </button>

          {result && (
            <span
              className={`text-sm ${result.ok ? 'text-(--color-priority)' : 'text-(--color-warn)'}`}
            >
              {result.message}
            </span>
          )}
        </div>

        {result?.details && result.details.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-(--color-warn-soft) px-3 py-2 text-xs text-(--color-warn)">
            {result.details.map((detail) => (
              <li key={`${detail.path}-${detail.message}`}>
                <code>{detail.path || '(racine)'}</code> — {detail.message}
              </li>
            ))}
          </ul>
        )}
      </form>
    </section>
  );
}
