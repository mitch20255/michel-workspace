import { describe, expect, it } from 'vitest';
import { detectEmploymentType, detectSeniority, seniorityDistance } from './seniority.js';

describe('detectSeniority', () => {
  it('lit le niveau dans le titre avec une confiance élevée', () => {
    const result = detectSeniority('Senior Full-Stack Developer');
    expect(result.seniority).toBe('senior');
    expect(result.confidence).toBe('high');
  });

  it('reconnaît les intitulés francophones', () => {
    expect(detectSeniority('Directeur des opérations').seniority).toBe('director');
    expect(detectSeniority('Stagiaire en développement').seniority).toBe('intern');
  });

  it('privilégie le titre sur la description', () => {
    // Erreur classique : « you will work with senior engineers » ne fait pas
    // du poste un poste senior.
    const result = detectSeniority(
      'Développeur junior',
      'Vous travaillerez avec des ingénieurs senior ayant 10 ans d’expérience.',
    );
    expect(result.seniority).toBe('junior');
  });

  it("se rabat sur les années d'expérience exigées", () => {
    const result = detectSeniority(
      'Développeur',
      '7 ans d’expérience en développement web requis.',
    );
    expect(result.seniority).toBe('senior');
    expect(result.confidence).toBe('medium');
    expect(result.yearsRequired).toBe(7);
  });

  it('retourne unknown quand rien ne permet de trancher', () => {
    const result = detectSeniority('Développeur', 'Une belle occasion de rejoindre notre équipe.');
    expect(result.seniority).toBe('unknown');
    expect(result.confidence).toBe('low');
  });
});

describe('seniorityDistance', () => {
  it('mesure l’écart sur l’échelle', () => {
    expect(seniorityDistance('senior', 'senior')).toBe(0);
    expect(seniorityDistance('mid', 'senior')).toBe(1);
    expect(seniorityDistance('junior', 'senior')).toBe(2);
  });

  it('refuse de mesurer un niveau inconnu', () => {
    // Retourner 0 laisserait croire à un alignement parfait.
    expect(seniorityDistance('unknown', 'senior')).toBeUndefined();
    expect(seniorityDistance('senior', 'unknown')).toBeUndefined();
  });
});

describe('detectEmploymentType', () => {
  it('reconnaît les types courants dans les deux langues', () => {
    expect(detectEmploymentType('Full-time')).toBe('full_time');
    expect(detectEmploymentType('Temps plein')).toBe('full_time');
    expect(detectEmploymentType('Contrat de 12 mois')).toBe('contract');
    expect(detectEmploymentType(undefined, 'Stage en génie logiciel')).toBe('internship');
  });

  it('retourne unknown sans indice', () => {
    expect(detectEmploymentType(undefined, '')).toBe('unknown');
  });
});
