/**
 * Masquage des données personnelles.
 *
 * Deux usages distincts, à ne pas confondre :
 *  - `redactForLogs` : ce qui part dans les journaux. Agressif par défaut.
 *  - `minimizeForLlm` (voir minimize.ts) : ce qui part chez un fournisseur
 *    externe. Encore plus strict.
 *
 * Règle du projet : aucun log ne contient de courriel, téléphone, adresse,
 * clé API ou jeton. Un log qui fuit est une fuite permanente — il est copié,
 * agrégé et conservé bien après la suppression du compte.
 */

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g;
// Formats nord-américains et internationaux courants.
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
// Numéro d'assurance sociale canadien / SSN américain.
const SIN_RE = /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b|\b\d{3}-\d{2}-\d{4}\b/g;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
// Clés d'API des fournisseurs courants + jetons porteurs génériques.
const API_KEY_RE =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})\b/g;
const BEARER_RE = /\b[Bb]earer\s+[A-Za-z0-9._~+/-]{16,}=*/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** Clés dont la valeur est masquée intégralement, quel que soit son contenu. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'setcookie',
  'encryptionkey',
  'encryption_key',
  'llmapikey',
  'llm_api_key',
  'privatekey',
  'private_key',
  'email',
  'phone',
  'address',
  'sin',
  'ssn',
  'dateofbirth',
  'date_of_birth',
  'creditcard',
  'iban',
]);

export const REDACTED = '[masqué]';

/** Masque les motifs sensibles dans une chaîne libre. */
export function redactString(input: string): string {
  if (!input) return input;
  return input
    .replace(API_KEY_RE, REDACTED)
    .replace(BEARER_RE, `Bearer ${REDACTED}`)
    .replace(JWT_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(CARD_RE, (match) => (countDigits(match) >= 13 ? REDACTED : match))
    .replace(SIN_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

function countDigits(input: string): number {
  let count = 0;
  for (const char of input) if (char >= '0' && char <= '9') count += 1;
  return count;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z_]/g, ''));
}

/**
 * Masque récursivement une structure destinée aux journaux.
 *
 * @param maxDepth Profondeur au-delà de laquelle la structure est tronquée.
 *                 Empêche aussi les boucles infinies sur objets cycliques.
 */
export function redactForLogs(value: unknown, maxDepth = 6): unknown {
  return redactValue(value, maxDepth, new WeakSet());
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (depth <= 0) return '[profondeur maximale atteinte]';

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[fonction]';

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[référence circulaire]';
    seen.add(value);

    if (Array.isArray(value)) {
      // Un tableau très long dans un log est du bruit : on tronque.
      const limited = value.slice(0, 50).map((item) => redactValue(item, depth - 1, seen));
      if (value.length > 50) limited.push(`[… ${value.length - 50} éléments omis]`);
      return limited;
    }

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, depth - 1, seen);
    }
    return out;
  }

  return '[valeur non sérialisable]';
}

/** Garde les 2 premiers et 2 derniers caractères : « ab…yz ». Pour l'affichage. */
export function maskPartially(input: string, keep = 2): string {
  if (input.length <= keep * 2) return REDACTED;
  return `${input.slice(0, keep)}…${input.slice(-keep)}`;
}
