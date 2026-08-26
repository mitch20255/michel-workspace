import { describe, expect, it } from 'vitest';
import { markMissingAsInactive, normalizeJob } from './normalize.js';
import { makeRawJob } from '../testing/fixtures.js';

const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('normalizeJob', () => {
  it('produit une offre canonique complète', () => {
    const job = normalizeJob(makeRawJob(), { now: NOW });

    expect(job.title).toBe('Senior Full-Stack Developer');
    expect(job.companyNameNormalized).toBe('northwind technologies');
    expect(job.seniority).toBe('senior');
    expect(job.remotePolicy).toBe('hybrid');
    expect(job.locations[0]?.city).toBe('Montréal');
    expect(job.salary?.min).toBe(110000);
    expect(job.salary?.currency).toBe('CAD');
    expect(job.status).toBe('active');
  });

  it('convertit le HTML en texte lisible', () => {
    const job = normalizeJob(makeRawJob(), { now: NOW });
    expect(job.descriptionText).not.toContain('<p>');
    expect(job.descriptionText).toContain('Exigences');
    expect(job.descriptionRaw).toContain('<p>');
  });

  it('extrait les sections et les compétences', () => {
    const job = normalizeJob(makeRawJob(), { now: NOW });
    expect(job.sections.requirements.length).toBeGreaterThan(0);
    expect(job.skills).toContain('TypeScript');
    expect(job.skills).toContain('PostgreSQL');
  });

  it('est déterministe : deux appels identiques donnent le même résultat', () => {
    const a = normalizeJob(makeRawJob(), { now: NOW });
    const b = normalizeJob(makeRawJob(), { now: NOW });
    expect(a).toEqual(b);
  });

  it('initialise les horodatages à la première détection', () => {
    const job = normalizeJob(makeRawJob(), { now: NOW });
    expect(job.firstSeenAt).toBe(NOW.toISOString());
    expect(job.lastSeenAt).toBe(NOW.toISOString());
    expect(job.seenCount).toBe(1);
    expect(job.repostCount).toBe(0);
  });

  it('conserve la première détection lors d’une revue ultérieure', () => {
    const first = normalizeJob(makeRawJob(), { now: NOW });
    const later = new Date('2026-04-15T12:00:00.000Z');
    const second = normalizeJob(makeRawJob(), { now: later, previous: first });

    expect(second.firstSeenAt).toBe(first.firstSeenAt);
    expect(second.lastSeenAt).toBe(later.toISOString());
    expect(second.seenCount).toBe(2);
    expect(second.lastChangedAt).toBeUndefined();
  });

  it('détecte une modification de contenu', () => {
    const first = normalizeJob(makeRawJob(), { now: NOW });
    const later = new Date('2026-04-15T12:00:00.000Z');
    const second = normalizeJob(
      makeRawJob({ descriptionRaw: '<p>Description entièrement réécrite.</p>' }),
      { now: later, previous: first },
    );

    expect(second.contentHash).not.toBe(first.contentHash);
    expect(second.lastChangedAt).toBe(later.toISOString());
  });

  it('compte une republication quand l’offre réapparaît après désactivation', () => {
    const first = normalizeJob(makeRawJob(), { now: NOW });
    const second = normalizeJob(makeRawJob(), {
      now: new Date('2026-05-01T12:00:00.000Z'),
      previous: { ...first, status: 'inactive' },
    });
    expect(second.repostCount).toBe(1);
  });

  it('garde une clé d’identité stable malgré une retouche de description', () => {
    const original = normalizeJob(makeRawJob(), { now: NOW });
    const retouched = normalizeJob(
      makeRawJob({
        descriptionRaw: `${makeRawJob().descriptionRaw}<p>Note ajoutée en fin d’annonce.</p>`,
      }),
      { now: NOW },
    );
    expect(retouched.identityKey).toBe(original.identityKey);
    expect(retouched.contentHash).not.toBe(original.contentHash);
  });

  it('détecte la langue de l’annonce', () => {
    const job = normalizeJob(makeRawJob(), { now: NOW });
    expect(job.language).toBe('fr');
  });

  it('calcule un score fantôme faible pour une annonce fraîche et détaillée', () => {
    const job = normalizeJob(makeRawJob(), { now: NOW });
    expect(job.ghostScore).toBeLessThan(25);
  });

  it('rejette une offre brute invalide', () => {
    expect(() => normalizeJob({ ...makeRawJob(), title: '' })).toThrow();
  });
});

describe('markMissingAsInactive', () => {
  it('désactive les offres non revues sans les supprimer', () => {
    const known = [
      { sourceJobId: 'a', status: 'active' },
      { sourceJobId: 'b', status: 'active' },
      { sourceJobId: 'c', status: 'inactive' },
    ];
    const result = markMissingAsInactive(known, new Set(['a']));
    expect(result).toHaveLength(1);
    expect(result[0]?.sourceJobId).toBe('b');
    expect(result[0]?.status).toBe('inactive');
  });
});
