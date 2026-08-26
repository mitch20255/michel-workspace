import { describe, expect, it } from 'vitest';
import { detectRemotePolicy, locationAffinity, parseLocations } from './location.js';

describe('parseLocations', () => {
  it('extrait ville, région et pays', () => {
    const [location] = parseLocations('Montréal, QC, Canada');
    expect(location?.city).toBe('Montréal');
    expect(location?.region).toBe('Québec');
    expect(location?.country).toBe('CA');
    expect(location?.raw).toBe('Montréal, QC, Canada');
  });

  it('complète région et pays pour une ville québécoise connue', () => {
    const [location] = parseLocations('Sherbrooke');
    expect(location?.region).toBe('Québec');
    expect(location?.country).toBe('CA');
  });

  it('gère plusieurs lieux séparés', () => {
    const locations = parseLocations('Montréal, QC; Toronto, ON');
    expect(locations).toHaveLength(2);
    expect(locations[1]?.region).toBe('Ontario');
  });

  it('conserve une mention « remote » comme lieu brut', () => {
    const [location] = parseLocations('Remote');
    expect(location?.raw).toBe('Remote');
    expect(location?.city).toBeUndefined();
  });

  it('retourne un tableau vide sur une entrée absente', () => {
    expect(parseLocations(undefined)).toEqual([]);
    expect(parseLocations('   ')).toEqual([]);
  });
});

describe('detectRemotePolicy', () => {
  it('privilégie le champ structuré de l’ATS', () => {
    const result = detectRemotePolicy('le texte parle de bureau', 'Remote');
    expect(result.policy).toBe('remote');
    expect(result.confidence).toBe('high');
  });

  it('reconnaît un mode hybride décrit en jours', () => {
    const result = detectRemotePolicy('Mode hybride, 2 jours au bureau par semaine.');
    expect(result.policy).toBe('hybrid');
  });

  it('classe « hybride » avant « remote » quand les deux apparaissent', () => {
    // Piège classique : « hybrid — 2 days remote » contient le mot « remote »
    // mais n'est pas un poste à distance.
    const result = detectRemotePolicy('Hybrid role: 3 days in office, 2 days remote.');
    expect(result.policy).toBe('hybrid');
  });

  it('reconnaît le présentiel', () => {
    expect(detectRemotePolicy('Poste 100 % en présentiel à nos bureaux.').policy).toBe('onsite');
  });

  it('accorde une confiance élevée à « 100 % remote »', () => {
    const result = detectRemotePolicy('This is a 100% remote position.');
    expect(result.policy).toBe('remote');
    expect(result.confidence).toBe('high');
  });

  it('avoue son ignorance plutôt que de trancher au hasard', () => {
    const result = detectRemotePolicy('Poste on-site, remote occasionnellement possible.');
    expect(result.policy).toBe('unknown');
  });

  it('retourne unknown sur un texte vide', () => {
    expect(detectRemotePolicy('').policy).toBe('unknown');
  });
});

describe('locationAffinity', () => {
  const montreal = { city: 'Montréal', region: 'Québec', country: 'CA', raw: 'Montréal' };

  it('donne 1 pour la même ville', () => {
    expect(locationAffinity(montreal, { ...montreal, raw: 'montreal' })).toBe(1);
  });

  it('donne 0.6 pour la même région', () => {
    const quebecCity = { city: 'Québec', region: 'Québec', country: 'CA', raw: 'Québec' };
    expect(locationAffinity(montreal, quebecCity)).toBe(0.6);
  });

  it('donne 0.3 pour le même pays', () => {
    const toronto = { city: 'Toronto', region: 'Ontario', country: 'CA', raw: 'Toronto' };
    expect(locationAffinity(montreal, toronto)).toBe(0.3);
  });

  it('donne 0 pour des pays différents', () => {
    const paris = { city: 'Paris', region: 'Île-de-France', country: 'FR', raw: 'Paris' };
    expect(locationAffinity(montreal, paris)).toBe(0);
  });
});
