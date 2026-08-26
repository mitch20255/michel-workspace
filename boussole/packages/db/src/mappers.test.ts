import { describe, expect, it } from 'vitest';
import { makeJob, makeProfile } from '@boussole/core/testing';
import { jobRowToDomain, jobToRow, profileRowToDomain, profileToRow } from './mappers.js';
import type { CandidateProfile as ProfileRow, Job as JobRow } from '../generated/client/index.js';

/**
 * Ces tests vérifient l'aller-retour domaine → ligne → domaine sans base :
 * la correspondance des champs et la conversion des dates sont du code pur,
 * et une régression ici corromprait toutes les lectures.
 */

function toJobRow(job: ReturnType<typeof makeJob>): JobRow {
  const row = jobToRow(job);
  return {
    ...row,
    id: 'job_1',
    duplicateGroupId: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  } as unknown as JobRow;
}

describe('jobToRow / jobRowToDomain', () => {
  it('effectue un aller-retour fidèle', () => {
    const job = makeJob();
    const restored = jobRowToDomain(toJobRow(job));

    expect(restored.title).toBe(job.title);
    expect(restored.companyNameNormalized).toBe(job.companyNameNormalized);
    expect(restored.contentHash).toBe(job.contentHash);
    expect(restored.identityKey).toBe(job.identityKey);
    expect(restored.skills).toEqual(job.skills);
    expect(restored.sections).toEqual(job.sections);
  });

  it('aplatit et reconstitue la rémunération', () => {
    const job = makeJob();
    const row = jobToRow(job);

    expect(row.salaryMin).toBe(110000);
    expect(row.salaryCurrency).toBe('CAD');
    expect(jobRowToDomain(toJobRow(job)).salary?.max).toBe(135000);
  });

  it('ne fabrique pas de rémunération quand la source n’en publie pas', () => {
    const job = makeJob({ descriptionRaw: '<p>Aucune information salariale.</p>' });
    expect(jobToRow(job).salaryMin).toBeNull();
    expect(jobRowToDomain(toJobRow(job)).salary).toBeUndefined();
  });

  it('convertit les dates en chaînes ISO', () => {
    const restored = jobRowToDomain(toJobRow(makeJob()));
    expect(restored.firstSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(restored.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('écrit null plutôt qu’undefined pour les colonnes JSON absentes', () => {
    // `undefined` est ignoré par Prisma lors d'une mise à jour : la valeur
    // précédente survivrait au lieu d'être effacée.
    const job = { ...makeJob(), rawPayload: undefined };
    expect(jobToRow(job).rawPayload).toBeNull();
  });

  it('rejette une ligne corrompue plutôt que de la propager', () => {
    const row = { ...toJobRow(makeJob()), ghostScore: 5000 };
    expect(() => jobRowToDomain(row)).toThrow();
  });
});

describe('profileToRow / profileRowToDomain', () => {
  function toProfileRow(profile: ReturnType<typeof makeProfile>): ProfileRow {
    return {
      ...profileToRow(profile),
      id: profile.id,
      userId: 'user_1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    } as unknown as ProfileRow;
  }

  it('effectue un aller-retour fidèle', () => {
    const profile = makeProfile();
    const restored = profileRowToDomain(toProfileRow(profile));

    expect(restored.identity.firstName).toBe(profile.identity.firstName);
    expect(restored.contact.email).toBe(profile.contact.email);
    expect(restored.experiences).toEqual(profile.experiences);
    expect(restored.preferences.targetTitles).toEqual(profile.preferences.targetTitles);
  });

  it('reconstitue la localisation à partir des colonnes séparées', () => {
    const restored = profileRowToDomain(toProfileRow(makeProfile()));
    expect(restored.location?.city).toBe('Montréal');
    expect(restored.location?.raw).toBe('Montréal, Québec, CA');
  });

  it('n’inclut les réponses sensibles que si elles sont fournies', () => {
    // Elles vivent dans leur propre table : les oublier ne doit pas produire
    // de valeur fantôme dans le profil.
    const restored = profileRowToDomain(toProfileRow(makeProfile()));
    expect(restored.sensitiveAnswers).toEqual([]);
  });

  it('rattache les réponses sensibles fournies', () => {
    const row = {
      ...toProfileRow(makeProfile()),
      sensitiveAnswers: [
        {
          id: 'sa_1',
          profileId: 'prof_test',
          key: 'work_authorization',
          state: 'answered',
          value: 'Citoyenne canadienne',
          note: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    };
    const restored = profileRowToDomain(row as never);
    expect(restored.sensitiveAnswers[0]?.key).toBe('work_authorization');
    expect(restored.sensitiveAnswers[0]?.state).toBe('answered');
  });
});
