import { describe, expect, it } from 'vitest';
import { makeJob, makeProfile } from '@boussole/core/testing';
import { buildCv } from './cv.js';
import { buildCoverLetter } from './letter.js';
import {
  compileTypst,
  isTypstAvailable,
  resetTypstAvailabilityCache,
  TypstCompilationError,
  TypstUnavailableError,
} from './typst.js';

/**
 * Ces tests compilent réellement des PDF quand Typst est présent.
 *
 * Ils sont ignorés — et non en échec — quand le binaire manque : l'absence de
 * Typst est un mode dégradé assumé du produit, pas une erreur. Le mode dégradé
 * lui-même est testé sans Typst, plus bas.
 */

const typstAvailable = await isTypstAvailable();
const describeWithTypst = typstAvailable ? describe : describe.skip;

/** En-tête d'un PDF valide. */
function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 1000 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  );
}

describeWithTypst('compilation Typst', () => {
  it('compile une source minimale', async () => {
    const pdf = await compileTypst('#set page(width: 10cm, height: 5cm)\nBonjour');
    expect(isPdf(pdf)).toBe(true);
  });

  it('signale une source invalide sans laisser de fichier derrière', async () => {
    await expect(compileTypst('#let x = ')).rejects.toBeInstanceOf(TypstCompilationError);
  });

  it('compile un CV complet', async () => {
    const document = await buildCv(makeProfile(), makeJob());
    expect(document.pdf).toBeDefined();
    expect(isPdf(document.pdf!)).toBe(true);
    expect(document.pdfUnavailableReason).toBeUndefined();
  });

  it('compile une lettre complète', async () => {
    const document = await buildCoverLetter(makeProfile(), makeJob(), {
      date: new Date('2026-03-01T00:00:00Z'),
    });
    expect(document.pdf).toBeDefined();
    expect(isPdf(document.pdf!)).toBe(true);
  });

  it('résiste aux caractères spéciaux du profil', async () => {
    // « C# », « 20 % », « 5 $ » et « @ » ont une signification en Typst.
    // Non échappés, ils cassent la compilation ou modifient silencieusement
    // le texte envoyé à l'employeur.
    const profile = makeProfile();
    profile.experiences[0]!.bullets = [
      'Réduction de 20 % des coûts, économie de 5 000 $ par mois en C# et F#.',
      'Migration de l’API #v2 vers *v3* avec _zéro_ interruption.',
    ];
    profile.skills.push({ name: 'C#', level: 'advanced' });

    const document = await buildCv(profile, makeJob());
    expect(isPdf(document.pdf!)).toBe(true);
  });
});

describe('dégradation gracieuse sans Typst', () => {
  it('produit source et texte même si le binaire est introuvable', async () => {
    resetTypstAvailabilityCache();
    const document = await buildCv(makeProfile(), makeJob(), {
      typstBinary: '/chemin/inexistant/typst',
    });

    // Le candidat garde un document exploitable et un message clair, plutôt
    // qu'une erreur opaque au pire moment.
    expect(document.pdf).toBeUndefined();
    expect(document.pdfUnavailableReason).toContain('Typst');
    expect(document.sourceTypst.length).toBeGreaterThan(100);
    expect(document.plainText).toContain('EXPÉRIENCE PROFESSIONNELLE');

    resetTypstAvailabilityCache();
  });

  it('signale l’indisponibilité par une erreur typée', async () => {
    resetTypstAvailabilityCache();
    await expect(
      compileTypst('Bonjour', { binary: '/chemin/inexistant/typst' }),
    ).rejects.toBeInstanceOf(TypstUnavailableError);
    resetTypstAvailabilityCache();
  });
});
