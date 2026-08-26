/**
 * Normalisation textuelle. Bilingue fr/en par obligation : le marché visé est
 * québécois, une même offre circule en français et en anglais.
 */

/** Retire les diacritiques : « Montréal » → « montreal ». */
export function deaccent(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Espaces multiples, insécables et sauts de ligne → un seul espace. */
export function collapseWhitespace(input: string): string {
  return input.replace(/[\s\u00a0\u202f\u2007]+/g, ' ').trim();
}

/**
 * Forme canonique pour comparaison : minuscules, sans accent, sans
 * ponctuation, espaces normalisés. Ne jamais afficher cette forme à
 * l'utilisateur — elle sert uniquement aux comparaisons.
 */
export function canonicalize(input: string): string {
  return collapseWhitespace(
    deaccent(input.toLowerCase())
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9+#./ -]/g, ' '),
  );
}

export function slugify(input: string): string {
  return canonicalize(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const COMPANY_SUFFIXES = [
  'inc',
  'inc.',
  'llc',
  'ltd',
  'ltd.',
  'limited',
  'corp',
  'corp.',
  'corporation',
  'co',
  'co.',
  'company',
  'gmbh',
  'sa',
  's.a.',
  'sas',
  'sarl',
  'plc',
  'ag',
  'bv',
  'nv',
  'oy',
  'ab',
  'as',
  'pty',
  'llp',
  'lp',
  'ltee',
  'ltee.',
  'cie',
  'enr',
  'senc',
  'srl',
  'the',
];

/**
 * Normalise un nom d'entreprise pour la déduplication.
 * « Acme Technologies Inc. » et « acme technologies » deviennent identiques.
 */
export function normalizeCompanyName(input: string): string {
  const tokens = canonicalize(input)
    .replace(/[.,]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  const filtered = tokens.filter((t) => !COMPANY_SUFFIXES.includes(t));
  // Si tout a été filtré (entreprise littéralement nommée « The Company »),
  // on garde les tokens d'origine plutôt que de renvoyer une chaîne vide.
  return (filtered.length > 0 ? filtered : tokens).join(' ');
}

/**
 * Bruit courant dans les intitulés de poste : références internes, mentions
 * de télétravail, codes de localisation entre parenthèses, mentions H/F.
 */
const TITLE_NOISE_PATTERNS: RegExp[] = [
  /\((?:h\/f|f\/h|m\/f|w\/m|h-f|m-w)\)/gi,
  /\b(?:h\/f|f\/h|m\/f|w\/m)\b/gi,
  /\breq(?:uisition)?\s*#?\s*\d+\b/gi,
  /\bjob\s*id\s*:?\s*\d+\b/gi,
  /#\s*\d{3,}/g,
  /\((?:remote|hybrid|on-?site|t[ée]l[ée]travail|hybride|sur place)\)/gi,
  /\b(?:100\s*%\s*)?(?:remote|t[ée]l[ée]travail)\b/gi,
  /\((?:contract|permanent|temporaire|permanent[e]?|cdi|cdd)\)/gi,
];

/** Forme comparable d'un intitulé, débarrassée du bruit d'affichage. */
export function normalizeJobTitle(input: string): string {
  let out = input;
  for (const pattern of TITLE_NOISE_PATTERNS) out = out.replace(pattern, ' ');
  // Sépare les segments après tiret/pipe qui portent souvent la localisation.
  out = out.replace(/\s+[-–—|/]\s+/g, ' - ');
  return canonicalize(out)
    .replace(/\s*-\s*$/, '')
    .trim();
}

/** Coupe proprement à la limite d'un mot, avec ellipse. */
export function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  const slice = input.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
