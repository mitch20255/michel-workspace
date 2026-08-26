/**
 * Conversion HTML → texte.
 *
 * Volontairement sans dépendance : les descriptions d'offres issues des ATS
 * sont du HTML simple et bien formé (produit par un éditeur WYSIWYG), pas des
 * pages web arbitraires. Un parseur DOM complet serait une dépendance lourde
 * pour un gain nul ici. Si un jour on ingère du HTML de page publique, il
 * faudra passer à un vrai parseur — c'est documenté dans
 * docs/modules/ingestion.md.
 *
 * La conversion préserve la structure de liste, car les puces d'une offre
 * portent les exigences : les aplatir détruit l'extraction de sections.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  ocirc: 'ô',
  ugrave: 'ù',
  ucirc: 'û',
  icirc: 'î',
  iuml: 'ï',
  euml: 'ë',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  deg: '°',
  euro: '€',
  pound: '£',
  reg: '®',
  copy: '©',
  trade: '™',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeFromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (match, name: string) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()];
      return decoded ?? match;
    });
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

const BLOCK_TAGS =
  'address|article|aside|blockquote|div|dl|dd|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|tfoot|ul|video';

/**
 * @returns Texte lisible, listes préfixées par « - », blocs séparés par des
 *          sauts de ligne. Les scripts et styles sont supprimés avec leur
 *          contenu (sinon du CSS se retrouve dans la description).
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  let text = html;

  // 1. Supprimer scripts, styles, commentaires — contenu inclus.
  text = text.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // 2. Sauts de ligne explicites.
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // 3. Puces de liste. Le marqueur « - » est reconnu plus tard par
  //    l'extraction de sections comme début d'exigence.
  text = text.replace(/<li\b[^>]*>/gi, '\n- ');
  text = text.replace(/<\/li>/gi, '\n');

  // 4. Cellules de tableau → séparateur visible.
  text = text.replace(/<\/t[dh]>/gi, '\t');
  text = text.replace(/<\/tr>/gi, '\n');

  // 5. Fermeture/ouverture de blocs → saut de ligne.
  text = text.replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n');

  // 6. Toute balise restante (inline) disparaît sans laisser d'espace parasite.
  text = text.replace(/<[^>]+>/g, '');

  // 7. Entités.
  text = decodeHtmlEntities(text);

  // 8. Nettoyage des blancs : on garde au plus une ligne vide.
  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/** Vrai si la chaîne ressemble à du HTML plutôt qu'à du texte brut. */
export function looksLikeHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

/** Convertit si nécessaire ; laisse le texte brut intact. */
export function toPlainText(input: string): string {
  return looksLikeHtml(input) ? htmlToText(input) : input.trim();
}
