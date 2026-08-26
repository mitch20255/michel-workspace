import { describe, expect, it } from 'vitest';
import { extractSkills, isSameSkill, normalizeSkillNames } from './skills.js';

describe('extractSkills', () => {
  it('reconnaît les technologies courantes', () => {
    const skills = extractSkills('Nous cherchons un expert TypeScript, React et PostgreSQL.');
    const names = skills.map((s) => s.canonical);
    expect(names).toContain('TypeScript');
    expect(names).toContain('React');
    expect(names).toContain('PostgreSQL');
  });

  it('reconnaît les alias', () => {
    const names = extractSkills('Expérience en JS, Postgres et k8s.').map((s) => s.canonical);
    expect(names).toContain('JavaScript');
    expect(names).toContain('PostgreSQL');
    expect(names).toContain('Kubernetes');
  });

  it('gère les noms contenant des symboles', () => {
    const names = extractSkills('Maîtrise de C++ et de C#.').map((s) => s.canonical);
    expect(names).toContain('C++');
    expect(names).toContain('C#');
  });

  it('ne confond pas Java et JavaScript', () => {
    const names = extractSkills('Développement Java côté serveur.').map((s) => s.canonical);
    expect(names).toContain('Java');
    expect(names).not.toContain('JavaScript');
  });

  it('reconnaît les termes francophones', () => {
    const names = extractSkills(
      'Expérience en apprentissage automatique et intégration continue.',
    ).map((s) => s.canonical);
    expect(names).toContain('Machine Learning');
    expect(names).toContain('CI/CD');
  });

  it('écarte les termes ambigus par défaut', () => {
    // « go » et « tableau » sont des mots français courants : les compter
    // comme compétences produirait des faux positifs en cascade.
    const names = extractSkills('Nous allons y aller avec un tableau de bord.').map(
      (s) => s.canonical,
    );
    expect(names).not.toContain('Go');
    expect(names).not.toContain('Tableau');
  });

  it('inclut les termes ambigus sur demande explicite', () => {
    const names = extractSkills('Go, Rust', { includeAmbiguous: true }).map((s) => s.canonical);
    expect(names).toContain('Go');
    expect(names).toContain('Rust');
  });

  it('marque comme requises les compétences citées dans les exigences', () => {
    const skills = extractSkills('Poste TypeScript et Figma', {
      requirementText: '5 ans de TypeScript obligatoire',
    });
    const typescript = skills.find((s) => s.canonical === 'TypeScript');
    const figma = skills.find((s) => s.canonical === 'Figma');
    expect(typescript?.required).toBe(true);
    expect(figma?.required).toBe(false);
  });

  it('place les compétences requises en tête', () => {
    const skills = extractSkills('Figma, Figma, Figma et TypeScript', {
      requirementText: 'TypeScript exigé',
    });
    expect(skills[0]?.canonical).toBe('TypeScript');
  });

  it('fournit un extrait justificatif', () => {
    const [skill] = extractSkills('Nous utilisons Kubernetes en production.');
    expect(skill?.evidence).toContain('kubernetes');
  });

  it('retourne une liste vide sur un texte sans compétence', () => {
    expect(extractSkills('Bonjour et bienvenue chez nous.')).toEqual([]);
    expect(extractSkills('')).toEqual([]);
  });
});

describe('normalizeSkillNames', () => {
  it('ramène les alias à la forme canonique', () => {
    expect(normalizeSkillNames(['js', 'postgres'])).toEqual(['JavaScript', 'PostgreSQL']);
  });

  it('conserve les compétences hors taxonomie', () => {
    // La taxonomie ne doit jamais faire disparaître une compétence réelle.
    expect(normalizeSkillNames(['Soudure TIG'])).toEqual(['Soudure TIG']);
  });

  it('dédoublonne les alias du même terme', () => {
    expect(normalizeSkillNames(['js', 'javascript', 'JS'])).toEqual(['JavaScript']);
  });
});

describe('isSameSkill', () => {
  it('reconnaît deux alias du même terme', () => {
    expect(isSameSkill('postgres', 'PostgreSQL')).toBe(true);
  });

  it('distingue deux compétences différentes', () => {
    expect(isSameSkill('Java', 'JavaScript')).toBe(false);
  });
});
