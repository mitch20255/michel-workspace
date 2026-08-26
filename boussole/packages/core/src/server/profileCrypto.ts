import type { CandidateProfile } from '../schemas/profile.js';
import { decrypt, encrypt, isEncrypted } from './crypto.js';

/**
 * Chiffrement sélectif du profil candidat.
 *
 * Ce qui est chiffré au repos, et pourquoi seulement cela :
 *  - coordonnées (courriel, téléphone, adresse) : identifient directement ;
 *  - valeurs des réponses sensibles : statut de handicap, autorisation de
 *    travail, prétentions salariales — les plus dommageables en cas de fuite.
 *
 * Ce qui n'est PAS chiffré, délibérément : intitulés de postes, compétences,
 * puces d'expérience. Les chiffrer rendrait impossibles la recherche, le tri
 * et le scoring côté base, pour un gain marginal — ces informations figurent
 * déjà sur un CV que le candidat diffuse volontairement. Chiffrer ce qui doit
 * rester interrogeable produit systématiquement soit du déchiffrement en
 * masse en mémoire, soit un contournement.
 *
 * Les fonctions sont idempotentes : rechiffrer un profil déjà chiffré ne
 * double pas le chiffrement.
 */

/** Chemins chiffrés, en notation pointée. Documenté dans SECURITY.md. */
export const ENCRYPTED_PROFILE_PATHS = [
  'contact.email',
  'contact.phone',
  'contact.address',
  'sensitiveAnswers[].value',
] as const;

export function encryptProfile(profile: CandidateProfile, key: Buffer): CandidateProfile {
  return {
    ...profile,
    contact: {
      ...profile.contact,
      email: encryptIfNeeded(profile.contact.email, key),
      phone: profile.contact.phone ? encryptIfNeeded(profile.contact.phone, key) : undefined,
      address: profile.contact.address ? encryptIfNeeded(profile.contact.address, key) : undefined,
    },
    sensitiveAnswers: profile.sensitiveAnswers.map((answer) => ({
      ...answer,
      value: answer.value ? encryptIfNeeded(answer.value, key) : undefined,
    })),
  };
}

export function decryptProfile(profile: CandidateProfile, key: Buffer): CandidateProfile {
  return {
    ...profile,
    contact: {
      ...profile.contact,
      email: decryptIfNeeded(profile.contact.email, key),
      phone: profile.contact.phone ? decryptIfNeeded(profile.contact.phone, key) : undefined,
      address: profile.contact.address ? decryptIfNeeded(profile.contact.address, key) : undefined,
    },
    sensitiveAnswers: profile.sensitiveAnswers.map((answer) => ({
      ...answer,
      value: answer.value ? decryptIfNeeded(answer.value, key) : undefined,
    })),
  };
}

function encryptIfNeeded(value: string, key: Buffer): string {
  return isEncrypted(value) ? value : encrypt(value, key);
}

function decryptIfNeeded(value: string, key: Buffer): string {
  return isEncrypted(value) ? decrypt(value, key) : value;
}
