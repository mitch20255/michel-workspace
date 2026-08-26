/**
 * Mesures de similarité, en TypeScript pur.
 *
 * Trois mesures complémentaires, choisies pour ce qu'elles rattrapent
 * chacune :
 *  - Levenshtein normalisé : fautes de frappe et variantes courtes.
 *  - Jaro-Winkler : préfixes communs, efficace sur les noms d'entreprise.
 *  - Jaccard sur trigrammes/tokens : réordonnancements et textes longs.
 *
 * Aucune n'est fiable seule : `dedup.ts` les combine.
 */

/** Distance d'édition, implémentation à deux lignes (mémoire O(min(m,n))). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // On itère sur la plus courte des deux chaînes pour borner la mémoire.
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];

  let previous = Array.from({ length: short.length + 1 }, (_, i) => i);
  let current = new Array<number>(short.length + 1);

  for (let i = 1; i <= long.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= short.length; j += 1) {
      const cost = long[i - 1] === short[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1, // insertion
        (previous[j] ?? 0) + 1, // suppression
        (previous[j - 1] ?? 0) + cost, // substitution
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[short.length] ?? 0;
}

/** Levenshtein ramené à [0, 1] où 1 = identique. */
export function levenshteinRatio(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshtein(a, b) / maxLength;
}

/** Similarité de Jaro. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }

  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
}

/**
 * Jaro-Winkler : favorise les chaînes partageant un préfixe.
 * @param prefixScale Poids du préfixe commun. 0.1 est la valeur usuelle.
 */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const base = jaro(a, b);
  if (base < 0.7) return base; // Seuil classique : pas de bonus sur du bruit.

  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix += 1;

  return base + prefix * prefixScale * (1 - base);
}

/** Trigrammes de caractères, avec rembourrage aux extrémités. */
export function trigrams(input: string): Set<string> {
  const padded = `  ${input} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) out.add(padded.slice(i, i + 3));
  return out;
}

/** Indice de Jaccard entre deux ensembles. */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  // On itère sur le plus petit ensemble.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const item of small) if (large.has(item)) intersection += 1;

  return intersection / (a.size + b.size - intersection);
}

export function trigramSimilarity(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b));
}

/**
 * Recouvrement asymétrique : quelle part du plus petit ensemble est contenue
 * dans le plus grand. Utile face à des descriptions de longueurs très
 * différentes, où Jaccard s'effondre alors que l'une est un extrait de l'autre.
 */
export function containment<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const item of small) if (large.has(item)) intersection += 1;
  return intersection / small.size;
}
