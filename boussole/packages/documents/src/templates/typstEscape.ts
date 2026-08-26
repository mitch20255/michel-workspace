/**
 * Échappement Typst.
 *
 * Indispensable : les puces d'un CV contiennent régulièrement `#`, `*`, `_`,
 * `@` ou `$` (« C# », « 20 % → 5 $ », « @entreprise »). Non échappés, ils sont
 * interprétés comme de la syntaxe Typst et, au mieux, cassent la compilation ;
 * au pire, ils modifient silencieusement le texte du CV envoyé à l'employeur.
 *
 * Les données injectées viennent du profil de l'utilisateur, mais aussi
 * d'offres téléchargées : elles ne sont jamais considérées comme sûres.
 */

/** Caractères ayant une signification en mode contenu Typst. */
const SPECIAL = /[\\#$*_`<>@=\-+/[\]"'~]/g;

/**
 * Échappe une chaîne pour une insertion en mode contenu Typst.
 * Le résultat s'insère entre guillemets dans un appel de fonction.
 */
export function escapeTypst(value: string): string {
  return value.replace(SPECIAL, (char) => `\\${char}`);
}

/**
 * Échappe une chaîne destinée à une **chaîne littérale** Typst (entre
 * guillemets doubles). Seuls la barre oblique inverse et le guillemet
 * doivent l'être ; sur-échapper ferait apparaître des barres obliques dans
 * le document final.
 */
export function escapeTypstString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

/** Enveloppe une valeur dans une chaîne littérale Typst prête à insérer. */
export function typstString(value: string): string {
  return `"${escapeTypstString(value)}"`;
}

/** Tableau de chaînes littérales Typst. */
export function typstStringArray(values: string[]): string {
  if (values.length === 0) return '()';
  // La virgule finale est nécessaire : sans elle, un tableau à un seul
  // élément est interprété par Typst comme une simple valeur entre
  // parenthèses, et l'itération échoue.
  return `(${values.map(typstString).join(', ')},)`;
}
