import { describe, expect, it } from 'vitest';
import { makeJob, makeProfile } from '../testing/index.js';
import { bridgePhrasing, findTransferable } from './adjacency.js';
import { analyzeKeywordGap } from './keywordGap.js';

describe('findTransferable', () => {
  it('reconnaît une compétence voisine réellement possédée', () => {
    const match = findTransferable('Kubernetes', ['Docker', 'Python']);

    expect(match?.via).toBe('Docker');
    expect(match?.strength).toBeLessThan(1);
  });

  it('ne rapproche pas deux compétences sans rapport', () => {
    expect(findTransferable('SAP', ['React', 'PostgreSQL'])).toBeUndefined();
  });

  it('retient le voisinage le plus fort quand plusieurs existent', () => {
    // JavaScript ↔ TypeScript est bien plus proche que React ↔ Vue.
    const match = findTransferable('TypeScript', ['JavaScript', 'Vue.js']);

    expect(match?.via).toBe('JavaScript');
  });

  it('ne se déclare pas voisine d’elle-même', () => {
    expect(findTransferable('Docker', ['Docker'])).toBeUndefined();
  });
});

describe('bridgePhrasing', () => {
  it('nomme la compétence possédée ET l’absence de l’autre', () => {
    // Les deux moitiés sont indissociables : sans la seconde, la phrase
    // laisse entendre une expérience que le candidat n'a pas.
    const match = findTransferable('Kubernetes', ['Docker']);
    const phrase = bridgePhrasing(match!);

    expect(phrase).toContain('Docker');
    expect(phrase).toContain('pas encore');
    expect(phrase).toContain('Kubernetes');
  });

  it('produit la version anglaise', () => {
    const match = findTransferable('Kubernetes', ['Docker']);

    expect(bridgePhrasing(match!, 'en')).toContain('no professional');
  });
});

describe('analyzeKeywordGap — statut transferable', () => {
  const profile = makeProfile({
    skills: [
      { name: 'Docker', level: 'advanced', yearsOfExperience: 3 },
      { name: 'Python', level: 'advanced', yearsOfExperience: 5 },
    ],
    experiences: [],
    projects: [],
  });

  // `descriptionText` et `sections` sont dérivés : c'est le HTML brut qu'il
  // faut fournir, sinon la normalisation reconstruit le contenu par défaut.
  const job = makeJob({
    title: 'Ingénieur plateforme',
    descriptionRaw: [
      '<h3>Exigences</h3>',
      '<ul><li>Maîtrise de Kubernetes exigée.</li>',
      '<li>Connaissance de SAP exigée.</li></ul>',
    ].join(''),
  });

  it('distingue une exigence approchée d’une exigence hors de portée', () => {
    const report = analyzeKeywordGap(job, profile);

    const kubernetes = report.items.find((i) => i.keyword === 'Kubernetes');
    const sap = report.items.find((i) => i.keyword === 'SAP');

    expect(kubernetes?.status).toBe('transferable');
    expect(sap?.status).toBe('not_in_profile');
  });

  it('n’autorise jamais une compétence transférable dans un CV', () => {
    // C'est la propriété centrale : « transferable » n'est pas un
    // adoucissement de « absent », c'est un sous-cas documenté.
    const report = analyzeKeywordGap(job, profile);

    expect(report.safeToAdd.map((i) => i.keyword)).not.toContain('Kubernetes');
    expect(report.realGaps.map((i) => i.keyword)).toContain('Kubernetes');
  });

  it('fournit une phrase prête à l’emploi', () => {
    const report = analyzeKeywordGap(job, profile);
    const kubernetes = report.transferable.find((i) => i.keyword === 'Kubernetes');

    expect(kubernetes?.bridge).toContain('Docker');
    expect(kubernetes?.transferable?.via).toBe('Docker');
  });

  it('compte une compétence voisine pour la moitié, pas pour une', () => {
    // Compter plein ferait passer un candidat sans Kubernetes pour un
    // candidat avec Kubernetes ; compter zéro nierait trois ans de conteneurs.
    const report = analyzeKeywordGap(job, profile);

    expect(report.requiredCoverage).toBeGreaterThan(0);
    expect(report.requiredCoverage).toBeLessThan(0.5);
  });
});
