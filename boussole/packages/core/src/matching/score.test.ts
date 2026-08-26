import { describe, expect, it } from 'vitest';
import { scoreJob } from './score.js';
import { makeJob, makeProfile } from '../testing/fixtures.js';

describe('scoreJob — cas nominal', () => {
  it('note favorablement une offre bien alignée', () => {
    const result = scoreJob(makeJob(), makeProfile());
    expect(result.score).toBeGreaterThan(65);
    expect(['shortlist', 'generate_documents']).toContain(result.decision);
    expect(result.blockers).toEqual([]);
  });

  it('fournit une explication pour chaque critère', () => {
    const result = scoreJob(makeJob(), makeProfile());
    for (const criterion of result.criteria) {
      expect(criterion.explanation.length).toBeGreaterThan(10);
      expect(criterion.label).toBeTruthy();
    }
  });

  it('produit un résumé lisible', () => {
    const result = scoreJob(makeJob(), makeProfile());
    expect(result.summary).toContain('/100');
    expect(result.summary.length).toBeGreaterThan(20);
  });

  it('borne le score entre 0 et 100', () => {
    const result = scoreJob(makeJob(), makeProfile());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('scoreJob — filtres déterministes', () => {
  it('écarte une entreprise explicitement exclue', () => {
    const profile = makeProfile();
    profile.preferences.excludedCompanies = ['Northwind Technologies Inc.'];
    const result = scoreJob(makeJob(), profile);
    expect(result.decision).toBe('reject');
    expect(result.score).toBe(0);
    expect(result.blockers[0]).toContain('Northwind');
  });

  it('écarte un intitulé exclu', () => {
    const profile = makeProfile();
    profile.preferences.excludedTitles = ['Full-Stack'];
    expect(scoreJob(makeJob(), profile).decision).toBe('reject');
  });

  it('écarte un mode de travail non souhaité', () => {
    const profile = makeProfile();
    profile.preferences.remotePolicies = ['remote'];
    // L'offre de référence est hybride.
    const result = scoreJob(makeJob(), profile);
    expect(result.decision).toBe('reject');
    expect(result.blockers.join(' ')).toContain('hybrid');
  });

  it('écarte une offre expirée', () => {
    const job = { ...makeJob(), status: 'expired' as const };
    expect(scoreJob(job, makeProfile()).decision).toBe('reject');
  });
});

describe('scoreJob — honnêteté sur l’inconnu', () => {
  it('exclut du calcul un critère non évaluable au lieu de le compter zéro', () => {
    const profile = makeProfile();
    // Sans prétention salariale, le critère « salaire » doit être neutralisé.
    delete profile.preferences.salaryExpectation;

    const withExpectation = scoreJob(makeJob(), makeProfile());
    const without = scoreJob(makeJob(), profile);

    const salaryCriterion = without.criteria.find((c) => c.key === 'salary');
    expect(salaryCriterion?.evaluated).toBe(false);
    expect(salaryCriterion?.explanation).toContain('Non évalué');
    // Un critère neutralisé ne doit pas faire chuter le score.
    expect(without.score).toBeGreaterThanOrEqual(withExpectation.score - 5);
  });

  it('signale une offre trop peu documentée pour être notée sérieusement', () => {
    const job = makeJob({
      descriptionRaw: '<p>Poste ouvert.</p>',
      locationRaw: undefined,
      department: undefined,
    });
    const emptyProfile = makeProfile({
      experiences: [],
      skills: [],
      projects: [],
    });
    const result = scoreJob(job, emptyProfile);
    expect(result.warnings.join(' ')).toContain('peu documentée');
  });

  it('refuse de comparer deux devises différentes', () => {
    const profile = makeProfile();
    profile.preferences.salaryExpectation = {
      min: 80000,
      currency: 'EUR',
      period: 'year',
      shareWithEmployers: false,
    };
    const result = scoreJob(makeJob(), profile);
    const salary = result.criteria.find((c) => c.key === 'salary');
    expect(salary?.evaluated).toBe(false);
    expect(salary?.explanation).toContain('Devises différentes');
  });
});

describe('scoreJob — critères individuels', () => {
  it('récompense un salaire au-dessus des attentes', () => {
    const result = scoreJob(makeJob(), makeProfile());
    const salary = result.criteria.find((c) => c.key === 'salary');
    expect(salary?.evaluated).toBe(true);
    expect(salary?.score).toBe(1);
  });

  it('pénalise un salaire nettement sous les attentes', () => {
    const job = makeJob({
      descriptionRaw: '<p>Salaire : 60 000 $ à 65 000 $ CAD par an.</p>',
    });
    const salary = scoreJob(job, makeProfile()).criteria.find((c) => c.key === 'salary');
    expect(salary?.score).toBeLessThan(0.2);
  });

  it('récompense l’alignement de séniorité', () => {
    const seniority = scoreJob(makeJob(), makeProfile()).criteria.find(
      (c) => c.key === 'seniority',
    );
    expect(seniority?.score).toBe(1);
  });

  it('récompense une offre à distance quelle que soit la localisation', () => {
    const profile = makeProfile();
    profile.preferences.remotePolicies = ['remote', 'hybrid', 'onsite'];
    const job = makeJob({
      locationRaw: 'Vancouver, BC',
      descriptionRaw: '<p>This is a 100% remote position across Canada.</p>',
    });
    const location = scoreJob(job, profile).criteria.find((c) => c.key === 'location');
    expect(location?.score).toBe(1);
  });
});

describe('scoreJob — avertissements', () => {
  it('avertit sans écarter quand le score fantôme est élevé', () => {
    const job = { ...makeJob(), ghostScore: 70 };
    const result = scoreJob(job, makeProfile());
    expect(result.warnings.join(' ')).toContain('fantôme');
    // Un signal faible informe la priorisation, il ne disqualifie pas.
    expect(result.decision).not.toBe('reject');
  });

  it('liste les exigences non couvertes', () => {
    const job = makeJob({
      descriptionRaw: '<h3>Exigences</h3><ul><li>Terraform et Scala obligatoires.</li></ul>',
    });
    const result = scoreJob(job, makeProfile());
    expect(result.warnings.join(' ')).toMatch(/Terraform|Scala/);
  });
});

describe('scoreJob — pondération personnalisée', () => {
  it('respecte des poids fournis par l’utilisateur', () => {
    const profile = makeProfile();
    profile.preferences.salaryExpectation = {
      min: 200000,
      currency: 'CAD',
      period: 'year',
      shareWithEmployers: false,
    };

    const neutral = scoreJob(makeJob(), profile, { weights: { salary: 0.01 } });
    const salaryHeavy = scoreJob(makeJob(), profile, { weights: { salary: 0.6 } });

    // Le salaire de l'offre est très en dessous : plus il pèse, plus le score chute.
    expect(salaryHeavy.score).toBeLessThan(neutral.score);
  });
});
