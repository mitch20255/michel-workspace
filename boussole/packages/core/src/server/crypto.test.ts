import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CryptoConfigurationError,
  DecryptionError,
  decrypt,
  encrypt,
  generateToken,
  isEncrypted,
  loadKey,
  safeCompare,
} from './crypto.js';
import { decryptProfile, encryptProfile } from './profileCrypto.js';
import { makeProfile } from '../testing/fixtures.js';

const KEY = randomBytes(32);

describe('loadKey', () => {
  it('accepte une clé base64 de 32 octets', () => {
    expect(loadKey(randomBytes(32).toString('base64'))).toHaveLength(32);
  });

  it('échoue bruyamment sur une clé absente', () => {
    // Une clé manquante doit empêcher le démarrage, jamais dégrader
    // silencieusement vers du stockage en clair.
    expect(() => loadKey(undefined)).toThrow(CryptoConfigurationError);
    expect(() => loadKey('   ')).toThrow(CryptoConfigurationError);
  });

  it('échoue sur une clé de mauvaise longueur', () => {
    expect(() => loadKey(randomBytes(16).toString('base64'))).toThrow(CryptoConfigurationError);
  });
});

describe('encrypt / decrypt', () => {
  it('effectue un aller-retour fidèle', () => {
    const plaintext = 'camille@exemple-fictif.test';
    expect(decrypt(encrypt(plaintext, KEY), KEY)).toBe(plaintext);
  });

  it('gère les caractères accentués et les emojis', () => {
    const plaintext = 'Développeuse — Montréal 🇨🇦';
    expect(decrypt(encrypt(plaintext, KEY), KEY)).toBe(plaintext);
  });

  it('produit un chiffré différent à chaque appel', () => {
    // IV aléatoire : deux chiffrés identiques révéleraient l'égalité des
    // valeurs en clair à qui lit la base.
    expect(encrypt('même valeur', KEY)).not.toBe(encrypt('même valeur', KEY));
  });

  it('refuse une valeur altérée', () => {
    const payload = encrypt('secret', KEY);
    const parts = payload.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${Buffer.from('falsifie').toString('base64')}`;
    expect(() => decrypt(tampered, KEY)).toThrow(DecryptionError);
  });

  it('refuse une clé incorrecte', () => {
    const payload = encrypt('secret', KEY);
    expect(() => decrypt(payload, randomBytes(32))).toThrow(DecryptionError);
  });

  it('refuse un format inconnu', () => {
    expect(() => decrypt('pas-un-chiffre', KEY)).toThrow(DecryptionError);
    expect(() => decrypt('v9.a.b.c', KEY)).toThrow(DecryptionError);
  });

  it('gère la chaîne vide', () => {
    expect(decrypt(encrypt('', KEY), KEY)).toBe('');
  });
});

describe('isEncrypted', () => {
  it('reconnaît une valeur chiffrée', () => {
    expect(isEncrypted(encrypt('a', KEY))).toBe(true);
  });

  it('reconnaît une valeur en clair', () => {
    expect(isEncrypted('camille@exemple.test')).toBe(false);
  });
});

describe('safeCompare', () => {
  it('reconnaît deux chaînes identiques', () => {
    expect(safeCompare('jeton-secret', 'jeton-secret')).toBe(true);
  });

  it('rejette deux chaînes différentes', () => {
    expect(safeCompare('jeton-secret', 'jeton-secre_')).toBe(false);
  });

  it('rejette des longueurs différentes sans planter', () => {
    expect(safeCompare('court', 'beaucoup-plus-long')).toBe(false);
  });
});

describe('generateToken', () => {
  it('produit un jeton hexadécimal de longueur attendue', () => {
    expect(generateToken(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produit des valeurs distinctes', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('encryptProfile / decryptProfile', () => {
  it('chiffre les coordonnées et les réponses sensibles', () => {
    const encrypted = encryptProfile(makeProfile(), KEY);
    expect(isEncrypted(encrypted.contact.email)).toBe(true);
    expect(isEncrypted(encrypted.contact.phone ?? '')).toBe(true);
    for (const answer of encrypted.sensitiveAnswers) {
      if (answer.value) expect(isEncrypted(answer.value)).toBe(true);
    }
  });

  it('laisse en clair les champs qui doivent rester interrogeables', () => {
    const encrypted = encryptProfile(makeProfile(), KEY);
    expect(encrypted.identity.firstName).toBe('Camille');
    expect(encrypted.experiences[0]?.title).toBe('Développeuse senior');
    expect(encrypted.skills[0]?.name).toBe('TypeScript');
  });

  it('effectue un aller-retour fidèle', () => {
    const original = makeProfile();
    const restored = decryptProfile(encryptProfile(original, KEY), KEY);
    expect(restored).toEqual(original);
  });

  it('est idempotent : rechiffrer ne double pas le chiffrement', () => {
    const once = encryptProfile(makeProfile(), KEY);
    const twice = encryptProfile(once, KEY);
    expect(decryptProfile(twice, KEY).contact.email).toBe(makeProfile().contact.email);
  });

  it('déchiffre sans effet un profil déjà en clair', () => {
    const plain = makeProfile();
    expect(decryptProfile(plain, KEY).contact.email).toBe(plain.contact.email);
  });
});
