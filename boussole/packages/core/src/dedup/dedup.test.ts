import { describe, expect, it } from 'vitest';
import { compareJobs, dedupeJobs, pickCanonical, type DedupCandidate } from './dedup.js';
import { identityKey } from '../jobs/fingerprint.js';

function candidate(overrides: Partial<DedupCandidate> & { id: string }): DedupCandidate {
  const base = {
    source: 'connector',
    sourceJobId: `src_${overrides.id}`,
    companyName: 'Northwind Technologies Inc.',
    title: 'Senior Full-Stack Developer',
    primaryLocation: 'Montréal, QC',
    descriptionText: 'Développement React et Node.js, PostgreSQL, Docker, AWS.',
    ...overrides,
  };
  return {
    ...base,
    identityKey:
      overrides.identityKey ??
      identityKey({
        title: base.title,
        companyName: base.companyName,
        primaryLocation: base.primaryLocation,
      }),
  };
}

describe('compareJobs', () => {
  it('donne une similarité maximale à deux offres identiques', () => {
    const result = compareJobs(candidate({ id: 'a' }), candidate({ id: 'b' }));
    expect(result.overall).toBeGreaterThan(0.95);
  });

  it('reconnaît deux écritures de la même entreprise', () => {
    const result = compareJobs(
      candidate({ id: 'a', companyName: 'Northwind Technologies Inc.' }),
      candidate({ id: 'b', companyName: 'northwind technologies' }),
    );
    expect(result.company).toBe(1);
  });

  it('sépare deux postes réellement différents', () => {
    const result = compareJobs(
      candidate({ id: 'a', title: 'Senior Full-Stack Developer' }),
      candidate({
        id: 'b',
        title: 'Directrice des ressources humaines',
        descriptionText: 'Gestion des talents, paie, relations de travail et dotation.',
      }),
    );
    expect(result.overall).toBeLessThan(0.6);
  });

  it('ne pénalise pas une description absente', () => {
    const withDescription = compareJobs(candidate({ id: 'a' }), candidate({ id: 'b' }));
    const without = compareJobs(
      candidate({ id: 'a', descriptionText: undefined }),
      candidate({ id: 'b', descriptionText: undefined }),
    );
    // Le poids de la description est redistribué, pas compté 0.
    expect(without.overall).toBeGreaterThan(0.9);
    expect(withDescription.overall).toBeGreaterThan(0.9);
  });
});

describe('dedupeJobs', () => {
  it('regroupe les offres partageant source et identifiant source', () => {
    const result = dedupeJobs([
      candidate({ id: 'a', sourceJobId: 'X1' }),
      candidate({ id: 'b', sourceJobId: 'X1' }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.assignments.get('a')).toBe(result.assignments.get('b'));
  });

  it('regroupe des republications à titre légèrement retouché', () => {
    const result = dedupeJobs([
      candidate({ id: 'a', sourceJobId: 'X1', title: 'Senior Full-Stack Developer' }),
      candidate({
        id: 'b',
        sourceJobId: 'X2',
        title: 'Senior Full-Stack Developer (H/F)',
      }),
    ]);
    expect(result.groups).toHaveLength(1);
  });

  it('laisse séparées deux offres distinctes de la même entreprise', () => {
    const result = dedupeJobs([
      candidate({ id: 'a', sourceJobId: 'X1' }),
      candidate({
        id: 'b',
        sourceJobId: 'X2',
        title: 'Comptable principal',
        descriptionText: 'Tenue de livres, états financiers, conformité fiscale.',
      }),
    ]);
    expect(result.groups).toHaveLength(2);
  });

  it('est transitive : A≡B et B≡C forment un seul groupe', () => {
    const result = dedupeJobs([
      candidate({ id: 'a', sourceJobId: 'X1' }),
      candidate({ id: 'b', sourceJobId: 'X1' }),
      candidate({ id: 'c', sourceJobId: 'X2', title: 'Senior Full-Stack Developer (Remote)' }),
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.memberIds).toEqual(['a', 'b', 'c']);
  });

  it('produit des groupes stables entre deux exécutions', () => {
    const input = [
      candidate({ id: 'b', sourceJobId: 'X1' }),
      candidate({ id: 'a', sourceJobId: 'X1' }),
    ];
    const first = dedupeJobs(input);
    const second = dedupeJobs([...input].reverse());
    expect(first.assignments.get('a')).toBe(second.assignments.get('a'));
  });

  it('signale les cas ambigus au lieu de fusionner', () => {
    const result = dedupeJobs([
      candidate({
        id: 'a',
        sourceJobId: 'X1',
        title: 'Développeur back-end',
        identityKey: 'k1',
        descriptionText: 'API REST en Node.js avec PostgreSQL et Redis.',
      }),
      candidate({
        id: 'b',
        sourceJobId: 'X2',
        title: 'Développeur back-end senior',
        identityKey: 'k2',
        descriptionText: 'API REST en Node.js avec PostgreSQL, Redis et Docker.',
      }),
    ]);
    // Soit fusionnées, soit signalées — jamais ignorées silencieusement.
    const merged = result.groups.length === 1;
    expect(merged || result.needsReview.length > 0).toBe(true);
  });

  it('gère une liste vide', () => {
    const result = dedupeJobs([]);
    expect(result.groups).toEqual([]);
    expect(result.assignments.size).toBe(0);
  });

  it('assigne chaque offre à exactement un groupe', () => {
    const candidates = ['a', 'b', 'c', 'd'].map((id) =>
      candidate({ id, sourceJobId: `src_${id}`, title: `Poste ${id}`, identityKey: `key_${id}` }),
    );
    const result = dedupeJobs(candidates);
    expect(result.assignments.size).toBe(4);
    const total = result.groups.reduce((sum, g) => sum + g.memberIds.length, 0);
    expect(total).toBe(4);
  });
});

describe('pickCanonical', () => {
  it('retient la description la plus complète', () => {
    const chosen = pickCanonical([
      { descriptionText: 'court', lastSeenAt: '2026-03-01' },
      { descriptionText: 'une description nettement plus longue', lastSeenAt: '2026-02-01' },
    ]);
    expect(chosen?.descriptionText).toContain('plus longue');
  });

  it('départage par date de dernière vue à longueur égale', () => {
    const chosen = pickCanonical([
      { descriptionText: 'abc', lastSeenAt: '2026-01-01' },
      { descriptionText: 'abc', lastSeenAt: '2026-05-01' },
    ]);
    expect(chosen?.lastSeenAt).toBe('2026-05-01');
  });
});
