import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Chiffrement applicatif des champs sensibles.
 *
 * ⚠️ Module **serveur uniquement** — importé via `@boussole/core/server` afin
 * que `node:crypto` n'entre jamais dans un bundle navigateur.
 *
 * Algorithme : AES-256-GCM. Chiffrement authentifié : une valeur altérée en
 * base échoue au déchiffrement au lieu de produire silencieusement des
 * données fausses.
 *
 * Format stocké : `v1.<iv_base64>.<tag_base64>.<chiffré_base64>`
 * Le préfixe de version permet une rotation d'algorithme sans deviner le
 * format des anciennes valeurs.
 *
 * Ce que ce module ne fait PAS, volontairement :
 *  - il ne gère pas la rotation de clé (V1, avec un identifiant de clé) ;
 *  - il ne remplace pas le chiffrement au repos du disque ni de Postgres ;
 *  - il ne protège pas contre un attaquant qui a la clé ET la base.
 *    Il protège contre une fuite de sauvegarde de base seule, ce qui est le
 *    scénario réaliste.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits : taille recommandée pour GCM.
const KEY_LENGTH = 32; // 256 bits.
const VERSION = 'v1';

export class CryptoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoConfigurationError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Charge la clé depuis une chaîne base64.
 * Échoue bruyamment : une clé absente ou trop courte doit empêcher le
 * démarrage, jamais dégrader silencieusement vers du stockage en clair.
 */
export function loadKey(base64Key: string | undefined): Buffer {
  if (!base64Key?.trim()) {
    throw new CryptoConfigurationError(
      'ENCRYPTION_KEY est absente. Générer une clé avec : openssl rand -base64 32',
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(base64Key.trim(), 'base64');
  } catch {
    throw new CryptoConfigurationError("ENCRYPTION_KEY n'est pas du base64 valide.");
  }
  if (key.length !== KEY_LENGTH) {
    throw new CryptoConfigurationError(
      `ENCRYPTION_KEY doit faire ${KEY_LENGTH} octets une fois décodée (obtenu : ${key.length}).`,
    );
  }
  return key;
}

export function encrypt(plaintext: string, key: Buffer): string {
  // IV aléatoire par message : réutiliser un IV avec GCM casse la
  // confidentialité ET l'authentification. Jamais de compteur ici.
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decrypt(payload: string, key: Buffer): string {
  const parts = payload.split('.');
  if (parts.length !== 4) {
    throw new DecryptionError('Format de valeur chiffrée invalide.');
  }
  const [version, ivB64, tagB64, dataB64] = parts;
  if (version !== VERSION) {
    throw new DecryptionError(`Version de chiffrement non prise en charge : ${version}`);
  }

  try {
    const iv = Buffer.from(ivB64 ?? '', 'base64');
    const tag = Buffer.from(tagB64 ?? '', 'base64');
    const data = Buffer.from(dataB64 ?? '', 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Le message d'origine peut révéler la structure du chiffré : on ne le
    // propage pas.
    throw new DecryptionError('Déchiffrement impossible : valeur altérée ou clé incorrecte.');
  }
}

/** Vrai si la valeur a été produite par `encrypt`. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}.`) && value.split('.').length === 4;
}

/**
 * Comparaison à temps constant, pour les jetons d'API.
 * `===` sur une chaîne secrète fuit sa longueur et son préfixe par le temps
 * de réponse.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Jeton aléatoire hexadécimal, pour les identifiants non devinables. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
