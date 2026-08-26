import { describe, expect, it } from 'vitest';
import { assessGenericity, extractSections } from './sections.js';

const FRENCH_POSTING = `À propos de nous
Northwind conçoit des outils pour les municipalités.

Responsabilités
- Concevoir et livrer des fonctionnalités en React et Node.js.
- Collaborer avec les équipes produit et design.

Exigences
- 5 ans d'expérience en développement web avec TypeScript.
- Maîtrise de PostgreSQL et des API REST.

Avantages
- Assurance collective et REER.
- Mode hybride, 2 jours au bureau.`;

describe('extractSections', () => {
  it('classe les puces sous le bon en-tête', () => {
    const sections = extractSections(FRENCH_POSTING);
    expect(sections.responsibilities).toHaveLength(2);
    expect(sections.requirements).toHaveLength(2);
    expect(sections.benefits).toHaveLength(2);
    expect(sections.requirements[0]).toContain('TypeScript');
  });

  it('reconnaît les en-têtes anglais', () => {
    const sections = extractSections(
      'What you will do\n- Ship features\n\nRequirements\n- 3 years of Python',
    );
    expect(sections.responsibilities[0]).toBe('Ship features');
    expect(sections.requirements[0]).toBe('3 years of Python');
  });

  it('ne range pas les avantages dans les exigences', () => {
    const sections = extractSections(FRENCH_POSTING);
    expect(sections.requirements.join(' ')).not.toContain('REER');
  });

  it('clôt la section sur un long paragraphe sans en-tête', () => {
    const text = `Exigences
- TypeScript
${'Nous sommes une entreprise en croissance qui valorise beaucoup de choses. '.repeat(5)}
- Ceci ne doit pas être une exigence`;
    const sections = extractSections(text);
    expect(sections.requirements).toEqual(['TypeScript']);
  });

  it('écarte les puces trop courtes', () => {
    const sections = extractSections('Exigences\n- N/A\n- TypeScript avancé');
    expect(sections.requirements).toEqual(['TypeScript avancé']);
  });

  it('retourne des sections vides sans en-tête reconnaissable', () => {
    const sections = extractSections('Un paragraphe libre sans structure.');
    expect(sections.requirements).toEqual([]);
    expect(sections.responsibilities).toEqual([]);
  });

  it('gère une entrée vide', () => {
    expect(extractSections('')).toEqual({
      requirements: [],
      responsibilities: [],
      benefits: [],
    });
  });
});

describe('assessGenericity', () => {
  it('note une annonce détaillée comme peu générique', () => {
    const sections = extractSections(FRENCH_POSTING);
    const { score } = assessGenericity(FRENCH_POSTING, sections);
    expect(score).toBeLessThan(0.35);
  });

  it('note une annonce creuse comme très générique', () => {
    const text =
      'Nous sommes toujours à la recherche de talents. Environnement dynamique, esprit d équipe, salaire compétitif.';
    const { score, markers } = assessGenericity(text, {
      requirements: [],
      responsibilities: [],
      benefits: [],
    });
    expect(score).toBeGreaterThan(0.6);
    expect(markers.length).toBeGreaterThan(0);
  });

  it('reste borné entre 0 et 1', () => {
    const { score } = assessGenericity('', {
      requirements: [],
      responsibilities: [],
      benefits: [],
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
