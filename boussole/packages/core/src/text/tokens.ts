import { canonicalize } from './normalize.js';

/**
 * Tokenisation bilingue et mots vides.
 *
 * Les listes sont volontairement courtes : elles couvrent les mots qui
 * polluent réellement la comparaison d'offres. Une liste exhaustive
 * supprimerait des termes porteurs de sens dans un contexte RH
 * (« support », « lead », « senior »…).
 */

const STOPWORDS_FR = new Set([
  'a',
  'afin',
  'ai',
  'ainsi',
  'alors',
  'au',
  'aucun',
  'aussi',
  'autre',
  'aux',
  'avec',
  'avoir',
  'car',
  'ce',
  'cela',
  'ces',
  'cet',
  'cette',
  'chaque',
  'comme',
  'dans',
  'de',
  'des',
  'du',
  'elle',
  'elles',
  'en',
  'encore',
  'est',
  'et',
  'etre',
  'eu',
  'faire',
  'fait',
  'ils',
  'il',
  'je',
  'la',
  'le',
  'les',
  'leur',
  'leurs',
  'lui',
  'ma',
  'mais',
  'mes',
  'meme',
  'mon',
  'ne',
  'ni',
  'nos',
  'notre',
  'nous',
  'on',
  'ou',
  'par',
  'pas',
  'plus',
  'pour',
  'quand',
  'que',
  'qui',
  'quoi',
  'sa',
  'sans',
  'se',
  'ses',
  'si',
  'son',
  'sont',
  'sur',
  'ta',
  'tes',
  'toi',
  'ton',
  'tous',
  'tout',
  'tres',
  'tu',
  'un',
  'une',
  'vos',
  'votre',
  'vous',
  'y',
  'etes',
  'sera',
  'serez',
  'nos',
  'chez',
  'dont',
  'entre',
  'vers',
  'selon',
  'apres',
  'avant',
]);

const STOPWORDS_EN = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'all',
  'also',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'me',
  'more',
  'most',
  'my',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

/** Bruit propre aux annonces d'emploi, dans les deux langues. */
const STOPWORDS_JOBS = new Set([
  'poste',
  'emploi',
  'offre',
  'candidat',
  'candidature',
  'entreprise',
  'equipe',
  'role',
  'job',
  'position',
  'company',
  'team',
  'opportunity',
  'candidate',
  'applicant',
  'apply',
  'work',
  'travail',
  'experience',
  'experiences',
  'years',
  'ans',
  'annee',
  'annees',
  'nous',
  'recherchons',
  'looking',
  'seeking',
  'join',
  'joindre',
  'rejoindre',
]);

export const STOPWORDS = new Set([...STOPWORDS_FR, ...STOPWORDS_EN, ...STOPWORDS_JOBS]);

export interface TokenizeOptions {
  /** Retirer les mots vides. Défaut : true. */
  removeStopwords?: boolean;
  /** Longueur minimale d'un token conservé. Défaut : 2. */
  minLength?: number;
}

/**
 * Découpe en tokens comparables. Conserve `+`, `#` et `.` à l'intérieur des
 * mots : sans cela « C++ », « C# » et « Node.js » deviennent « c », « c » et
 * « node js » — trois faux résultats dans un système de matching de compétences.
 */
export function tokenize(input: string, options: TokenizeOptions = {}): string[] {
  const { removeStopwords = true, minLength = 2 } = options;
  const canonical = canonicalize(input);
  const rawTokens = canonical.split(/[^a-z0-9+#.]+/).filter(Boolean);

  const tokens: string[] = [];
  for (const raw of rawTokens) {
    // Un point final est de la ponctuation, pas une partie du mot.
    const token = raw.replace(/\.+$/, '').replace(/^\.+/, '');
    if (!token) continue;
    if (token.length < minLength && !/^[a-z](\+\+|#)$/.test(token)) continue;
    if (removeStopwords && STOPWORDS.has(token)) continue;
    tokens.push(token);
  }
  return tokens;
}

/** Ensemble de tokens uniques — base des mesures de similarité de Jaccard. */
export function tokenSet(input: string, options?: TokenizeOptions): Set<string> {
  return new Set(tokenize(input, options));
}

/** n-grammes de mots, utiles pour repérer les compétences composées. */
export function ngrams(tokens: string[], n: number): string[] {
  if (n <= 0 || tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i += 1) {
    out.push(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

/** Fréquence des termes, triée par occurrence décroissante. */
export function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * Détection de langue par mots vides discriminants. Suffisante pour trancher
 * fr/en sur une description d'offre ; pas conçue pour d'autres langues.
 */
export function detectLanguage(input: string): 'fr' | 'en' | 'unknown' {
  const tokens = tokenize(input, { removeStopwords: false, minLength: 1 });
  if (tokens.length < 10) return 'unknown';

  const frMarkers = ['le', 'la', 'les', 'des', 'une', 'vous', 'nous', 'et', 'pour', 'dans', 'est'];
  const enMarkers = ['the', 'and', 'you', 'we', 'for', 'with', 'this', 'our', 'are', 'to', 'of'];

  let fr = 0;
  let en = 0;
  for (const token of tokens) {
    if (frMarkers.includes(token)) fr += 1;
    if (enMarkers.includes(token)) en += 1;
  }

  const total = fr + en;
  if (total < 5) return 'unknown';
  // Marge de 20 % : sous ce seuil, une offre bilingue est trop ambiguë pour
  // qu'on choisisse la langue du CV à la place du candidat.
  if (fr > en * 1.2) return 'fr';
  if (en > fr * 1.2) return 'en';
  return 'unknown';
}
