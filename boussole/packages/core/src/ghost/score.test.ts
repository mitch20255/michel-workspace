import { describe, expect, it } from 'vitest';
import { scoreGhostJob, type GhostScoreInput } from './score.js';
import { extractSections } from '../jobs/sections.js';

const NOW = new Date('2026-03-01T00:00:00.000Z');

const DETAILED = `Responsabilités
- Concevoir des API en Node.js pour 12 000 usagers.
- Encadrer 3 développeurs juniors.

Exigences
- 5 ans d'expérience avec TypeScript et PostgreSQL.
- Maîtrise de Docker et des pipelines CI/CD.`;

function input(overrides: Partial<GhostScoreInput> = {}): GhostScoreInput {
  const descriptionText = overrides.descriptionText ?? DETAILED;
  return {
    firstSeenAt: '2026-02-25T00:00:00.000Z',
    lastSeenAt: NOW.toISOString(),
    seenCount: 2,
    repostCount: 0,
    descriptionText,
    sections: extractSections(descriptionText),
    applyUrl: 'https://exemple-fictif.test/apply/1',
    hasSalary: true,
    now: NOW,
    ...overrides,
  };
}

describe('scoreGhostJob', () => {
  it('donne un score bas à une offre fraîche et détaillée', () => {
    const result = scoreGhostJob(input());
    expect(result.score).toBeLessThan(25);
    expect(result.band).toBe('clear');
  });

  it('pénalise une offre en ligne depuis plus de six mois', () => {
    const result = scoreGhostJob(input({ firstSeenAt: '2025-06-01T00:00:00.000Z' }));
    expect(result.signals.map((s) => s.code)).toContain('age_very_old');
    expect(result.score).toBeGreaterThan(15);
  });

  it('pénalise fortement le vocabulaire de vivier de candidats', () => {
    const text =
      'Nous sommes toujours à la recherche de talents pour notre banque de candidatures.';
    const result = scoreGhostJob(input({ descriptionText: text, sections: extractSections(text) }));
    expect(result.signals.map((s) => s.code)).toContain('pipeline_building');
    expect(result.band).toBe('suspicious');
  });

  it('relève les republications répétées', () => {
    const result = scoreGhostJob(input({ repostCount: 4 }));
    expect(result.signals.map((s) => s.code)).toContain('repost_frequent');
  });

  it("relève l'absence d'URL de candidature", () => {
    const result = scoreGhostJob(input({ applyUrl: undefined, canonicalUrl: undefined }));
    expect(result.signals.map((s) => s.code)).toContain('no_canonical_url');
  });

  it("relève un volume d'offres anormal par rapport à l'effectif", () => {
    const result = scoreGhostJob(input({ companyActiveJobCount: 60, companyEmployeeCount: 100 }));
    expect(result.signals.map((s) => s.code)).toContain('company_volume_anomaly');
  });

  it('ne signale pas un volume normal', () => {
    const result = scoreGhostJob(input({ companyActiveJobCount: 5, companyEmployeeCount: 100 }));
    expect(result.signals.map((s) => s.code)).not.toContain('company_volume_anomaly');
  });

  it('ne pénalise pas l’absence de salaire sur une offre récente', () => {
    const result = scoreGhostJob(input({ hasSalary: false }));
    expect(result.signals.map((s) => s.code)).not.toContain('no_salary_old_posting');
  });

  it('reste borné à 100 même en cumulant tous les signaux', () => {
    const text = 'Nous sommes toujours à la recherche de talents. Environnement dynamique.';
    const result = scoreGhostJob(
      input({
        firstSeenAt: '2024-01-01T00:00:00.000Z',
        repostCount: 10,
        descriptionText: text,
        sections: extractSections(text),
        applyUrl: undefined,
        canonicalUrl: undefined,
        hasSalary: false,
        companyActiveJobCount: 400,
        companyEmployeeCount: 50,
      }),
    );
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.band).toBe('suspicious');
  });

  it('trie les signaux du plus lourd au plus léger', () => {
    const result = scoreGhostJob(
      input({ firstSeenAt: '2025-01-01T00:00:00.000Z', repostCount: 4 }),
    );
    const weights = result.signals.map((s) => s.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('accompagne chaque signal d’un libellé lisible', () => {
    const result = scoreGhostJob(input({ firstSeenAt: '2025-01-01T00:00:00.000Z' }));
    for (const signal of result.signals) {
      expect(signal.label.length).toBeGreaterThan(5);
      expect(signal.code).toBeTruthy();
    }
  });
});
