import { describe, expect, it } from 'vitest';
import { detectLanguage, ngrams, termFrequency, tokenize, tokenSet } from './tokens.js';

describe('tokenize', () => {
  it('retire les mots vides des deux langues', () => {
    expect(tokenize('le poste de développeur et la mission')).not.toContain('le');
    expect(tokenize('the role and the mission')).not.toContain('the');
  });

  it('préserve les technologies à symboles', () => {
    // Sans cette garantie, « C++ », « C# » et « Node.js » deviennent
    // « c », « c » et « node js » — trois faux résultats de matching.
    const tokens = tokenize('C++ C# Node.js', { removeStopwords: false, minLength: 1 });
    expect(tokens).toContain('c++');
    expect(tokens).toContain('c#');
    expect(tokens).toContain('node.js');
  });

  it('retire la ponctuation terminale', () => {
    expect(tokenize('développement web.', { removeStopwords: false })).toContain('web');
  });

  it('respecte la longueur minimale', () => {
    expect(tokenize('a bc def', { removeStopwords: false, minLength: 3 })).toEqual(['def']);
  });

  it('retourne un tableau vide sur une entrée vide', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('tokenSet', () => {
  it('dédoublonne', () => {
    expect(tokenSet('react react react').size).toBe(1);
  });
});

describe('ngrams', () => {
  it('produit des n-grammes contigus', () => {
    expect(ngrams(['gestion', 'de', 'projet'], 2)).toEqual(['gestion de', 'de projet']);
  });

  it('retourne vide quand la longueur est insuffisante', () => {
    expect(ngrams(['a'], 2)).toEqual([]);
    expect(ngrams(['a', 'b'], 0)).toEqual([]);
  });
});

describe('termFrequency', () => {
  it('trie par occurrence décroissante', () => {
    const frequencies = [...termFrequency(['a', 'b', 'a', 'c', 'a', 'b']).entries()];
    expect(frequencies[0]).toEqual(['a', 3]);
    expect(frequencies[1]).toEqual(['b', 2]);
  });
});

describe('detectLanguage', () => {
  it('reconnaît le français', () => {
    expect(
      detectLanguage(
        'Nous recherchons une personne pour rejoindre notre équipe et travailler sur les produits de la compagnie dans un contexte stimulant.',
      ),
    ).toBe('fr');
  });

  it('reconnaît l’anglais', () => {
    expect(
      detectLanguage(
        'We are looking for someone to join our team and work with the product group on new features for our customers.',
      ),
    ).toBe('en');
  });

  it('avoue son ignorance sur un texte trop court', () => {
    expect(detectLanguage('Bonjour')).toBe('unknown');
  });

  it('avoue son ignorance sur une annonce bilingue équilibrée', () => {
    // Cas courant au Québec : la même annonce publiée dans les deux langues.
    // Trancher au hasard produirait un CV dans la mauvaise langue, d'où la
    // marge de 20 % exigée avant de se prononcer.
    const bilingual = `Le poste est dans une équipe et vous serez pour la suite des projets.
The role is with the team and you will be for our next set of projects.`;
    expect(detectLanguage(bilingual)).toBe('unknown');
  });
});
