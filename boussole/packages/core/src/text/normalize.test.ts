import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  collapseWhitespace,
  deaccent,
  normalizeCompanyName,
  normalizeJobTitle,
  slugify,
  truncate,
} from './normalize.js';

describe('deaccent', () => {
  it('retire les diacritiques français', () => {
    expect(deaccent('Montréal')).toBe('Montreal');
    expect(deaccent('à côté où çà')).toBe('a cote ou ca');
  });

  it('laisse intact un texte sans accent', () => {
    expect(deaccent('Toronto')).toBe('Toronto');
  });
});

describe('collapseWhitespace', () => {
  it('normalise les espaces insécables et les sauts de ligne', () => {
    expect(collapseWhitespace('a  b\n\nc\t d')).toBe('a b c d');
  });
});

describe('canonicalize', () => {
  it('produit une forme comparable', () => {
    expect(canonicalize('  Développeur   Sénior !!! ')).toBe('developpeur senior');
  });

  it('conserve les caractères significatifs des technologies', () => {
    expect(canonicalize('C++ / C# / Node.js')).toBe('c++ / c# / node.js');
  });

  it("supprime les apostrophes plutôt que d'en faire des espaces", () => {
    expect(canonicalize("l'équipe")).toBe('lequipe');
  });
});

describe('normalizeCompanyName', () => {
  it('retire les suffixes juridiques', () => {
    expect(normalizeCompanyName('Acme Technologies Inc.')).toBe('acme technologies');
    expect(normalizeCompanyName('Acme Technologies')).toBe('acme technologies');
    expect(normalizeCompanyName('Groupe Béton Ltée')).toBe('groupe beton');
  });

  it('rend identiques deux écritures de la même entreprise', () => {
    expect(normalizeCompanyName('Northwind Technologies Inc.')).toBe(
      normalizeCompanyName('northwind technologies'),
    );
  });

  it('ne vide pas un nom entièrement composé de suffixes', () => {
    // « The Company » ne doit pas devenir une chaîne vide, sinon toutes les
    // entreprises ainsi nommées seraient fusionnées par la déduplication.
    expect(normalizeCompanyName('The Company')).toBe('the company');
  });
});

describe('normalizeJobTitle', () => {
  it('retire les mentions H/F et les numéros de réquisition', () => {
    expect(normalizeJobTitle('Développeur Senior (H/F) - Req #4821')).toBe('developpeur senior');
  });

  it('retire les mentions de télétravail du titre', () => {
    expect(normalizeJobTitle('Data Analyst (Remote)')).toBe('data analyst');
  });

  it('conserve le cœur du titre', () => {
    expect(normalizeJobTitle('Senior Full-Stack Developer')).toContain('full-stack developer');
  });
});

describe('slugify', () => {
  it('produit un identifiant URL', () => {
    expect(slugify('Développeur Senior — Montréal')).toBe('developpeur-senior-montreal');
  });
});

describe('truncate', () => {
  it('ne touche pas un texte court', () => {
    expect(truncate('court', 20)).toBe('court');
  });

  it('coupe à la limite de mot', () => {
    const result = truncate('un texte assez long pour etre coupe ici', 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
  });
});
