import { describe, expect, it } from 'vitest';
import { parseSalary, toAnnual } from './salary.js';

describe('parseSalary — fourchettes', () => {
  it('lit une fourchette annuelle en français', () => {
    const salary = parseSalary('Salaire : 110 000 $ à 135 000 $ CAD par an.');
    expect(salary).toBeDefined();
    expect(salary?.min).toBe(110000);
    expect(salary?.max).toBe(135000);
    expect(salary?.currency).toBe('CAD');
    expect(salary?.period).toBe('year');
    expect(salary?.confidence).toBe('high');
  });

  it('lit une fourchette anglaise avec séparateurs de milliers', () => {
    const salary = parseSalary('Compensation: $95,000 - $120,000 per year');
    expect(salary?.min).toBe(95000);
    expect(salary?.max).toBe(120000);
    expect(salary?.period).toBe('year');
  });

  it('développe la notation « k »', () => {
    const salary = parseSalary('Salary range: 90k to 120k annually');
    expect(salary?.min).toBe(90000);
    expect(salary?.max).toBe(120000);
  });

  it('lit un taux horaire', () => {
    const salary = parseSalary('Taux horaire : 32 $ à 41 $ de l’heure');
    expect(salary?.min).toBe(32);
    expect(salary?.max).toBe(41);
    expect(salary?.period).toBe('hour');
  });

  it('conserve un extrait justificatif', () => {
    const salary = parseSalary('Rémunération : 80 000 $ à 90 000 $ par an.');
    expect(salary?.evidence).toContain('80 000');
  });
});

describe('parseSalary — devises', () => {
  it('résout « $ » en CAD grâce au contexte canadien', () => {
    const salary = parseSalary('Salaire : 100 000 $ à 120 000 $ par an, poste à Montréal.');
    expect(salary?.currency).toBe('CAD');
  });

  it('préfère ne pas deviner une devise ambiguë', () => {
    const salary = parseSalary('Salary range: $100,000 - $120,000 per year');
    expect(salary?.currency).toBeUndefined();
  });

  it('reconnaît le symbole euro', () => {
    const salary = parseSalary('Rémunération : 45 000 € à 55 000 € par an');
    expect(salary?.currency).toBe('EUR');
  });
});

describe('parseSalary — refus de deviner', () => {
  it('ignore un texte sans rémunération', () => {
    expect(parseSalary('Nous sommes 500 employés depuis 2014.')).toBeUndefined();
  });

  it("n'interprète pas les années d'expérience comme un salaire", () => {
    expect(parseSalary('5 à 8 ans d’expérience requis.')).toBeUndefined();
  });

  it('écarte un montant hors plage plausible', () => {
    expect(parseSalary('Salaire : 3 $ par an')).toBeUndefined();
  });

  it('retourne undefined sur une entrée vide', () => {
    expect(parseSalary('')).toBeUndefined();
  });

  it('marque une confiance faible pour un montant unique', () => {
    const salary = parseSalary('Salaire de 95 000 $ par an.');
    expect(salary?.confidence).toBe('low');
    expect(salary?.min).toBe(95000);
  });
});

describe('toAnnual', () => {
  it('convertit chaque période vers un équivalent annuel', () => {
    expect(toAnnual(50, 'hour')).toBe(104000);
    expect(toAnnual(500, 'day')).toBe(130000);
    expect(toAnnual(2000, 'week')).toBe(104000);
    expect(toAnnual(9000, 'month')).toBe(108000);
    expect(toAnnual(120000, 'year')).toBe(120000);
  });

  it('refuse de convertir une période inconnue', () => {
    // Retourner une valeur ici produirait un écart de facteur 2000 dans le
    // scoring salarial.
    expect(toAnnual(100, undefined)).toBeUndefined();
  });
});
