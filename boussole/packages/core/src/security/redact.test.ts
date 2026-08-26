import { describe, expect, it } from 'vitest';
import { maskPartially, redactForLogs, redactString, REDACTED } from './redact.js';

describe('redactString', () => {
  it('masque les adresses courriel', () => {
    expect(redactString('Écrire à camille@exemple.test pour la suite')).not.toContain('camille@');
  });

  it('masque les numéros de téléphone', () => {
    expect(redactString('Appeler le 514-555-0142')).toContain(REDACTED);
    expect(redactString('Appeler le (514) 555-0142')).toContain(REDACTED);
  });

  it('masque les clés API des fournisseurs courants', () => {
    const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';
    expect(redactString(`clé : ${key}`)).not.toContain('abcdefgh');
  });

  it('masque les jetons porteurs', () => {
    const line = 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345';
    expect(redactString(line)).not.toContain('abcdefghij');
  });

  it('masque les JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';
    expect(redactString(jwt)).toBe(REDACTED);
  });

  it('laisse intact un texte anodin', () => {
    expect(redactString('Offre de développeur senior à Montréal')).toBe(
      'Offre de développeur senior à Montréal',
    );
  });

  it('gère une chaîne vide', () => {
    expect(redactString('')).toBe('');
  });
});

describe('redactForLogs', () => {
  it('masque les valeurs des clés sensibles quel que soit leur contenu', () => {
    const result = redactForLogs({
      password: 'ceci-est-anodin-en-apparence',
      apiKey: 'valeur',
      email: 'camille@exemple.test',
      title: 'Développeuse senior',
    }) as Record<string, unknown>;

    expect(result.password).toBe(REDACTED);
    expect(result.apiKey).toBe(REDACTED);
    expect(result.email).toBe(REDACTED);
    expect(result.title).toBe('Développeuse senior');
  });

  it('masque en profondeur dans les objets imbriqués', () => {
    const result = redactForLogs({
      profile: { contact: { email: 'a@b.test' }, note: 'écrire à c@d.test' },
    }) as { profile: { contact: { email: string }; note: string } };

    expect(result.profile.contact.email).toBe(REDACTED);
    expect(result.profile.note).not.toContain('c@d.test');
  });

  it('survit aux références circulaires', () => {
    const cyclic: Record<string, unknown> = { name: 'test' };
    cyclic.self = cyclic;
    expect(() => redactForLogs(cyclic)).not.toThrow();
    const result = redactForLogs(cyclic) as Record<string, unknown>;
    expect(result.self).toBe('[référence circulaire]');
  });

  it('tronque les tableaux très longs', () => {
    const result = redactForLogs(Array.from({ length: 120 }, (_, i) => i)) as unknown[];
    expect(result.length).toBeLessThanOrEqual(51);
    expect(String(result[result.length - 1])).toContain('omis');
  });

  it('sérialise proprement les erreurs sans fuiter de PII', () => {
    const result = redactForLogs(new Error('échec pour camille@exemple.test')) as {
      message: string;
    };
    expect(result.message).not.toContain('camille@');
  });

  it('borne la profondeur d’exploration', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'fond' } } } } } } };
    const result = JSON.stringify(redactForLogs(deep, 3));
    expect(result).toContain('profondeur maximale');
  });

  it('préserve les types simples', () => {
    expect(redactForLogs(42)).toBe(42);
    expect(redactForLogs(true)).toBe(true);
    expect(redactForLogs(null)).toBe(null);
  });
});

describe('maskPartially', () => {
  it('conserve les extrémités pour permettre l’identification', () => {
    expect(maskPartially('abcdefghij')).toBe('ab…ij');
  });

  it('masque intégralement une valeur trop courte', () => {
    expect(maskPartially('abc')).toBe(REDACTED);
  });
});
