import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, htmlToText, looksLikeHtml, toPlainText } from './html.js';

describe('htmlToText', () => {
  it('préserve la structure des listes', () => {
    const html = '<h3>Exigences</h3><ul><li>TypeScript</li><li>PostgreSQL</li></ul>';
    const text = htmlToText(html);
    expect(text).toContain('Exigences');
    expect(text).toContain('- TypeScript');
    expect(text).toContain('- PostgreSQL');
  });

  it('supprime scripts et styles avec leur contenu', () => {
    const html = '<p>Visible</p><script>alert("x")</script><style>.a{color:red}</style>';
    const text = htmlToText(html);
    expect(text).toBe('Visible');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color');
  });

  it('convertit les sauts de ligne explicites', () => {
    expect(htmlToText('a<br>b')).toBe('a\nb');
  });

  it('ne colle pas les mots séparés par une balise en ligne', () => {
    expect(htmlToText('<p>Node<strong>.js</strong> requis</p>')).toBe('Node.js requis');
  });

  it('limite les lignes vides consécutives', () => {
    const text = htmlToText('<p>a</p><div></div><div></div><p>b</p>');
    expect(text).not.toMatch(/\n{3,}/);
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(htmlToText('')).toBe('');
  });
});

describe('decodeHtmlEntities', () => {
  it('décode les entités nommées courantes', () => {
    expect(decodeHtmlEntities('caf&eacute; &amp; th&eacute;')).toBe('café & thé');
  });

  it('décode les entités numériques décimales et hexadécimales', () => {
    expect(decodeHtmlEntities('&#233;&#x00e9;')).toBe('éé');
  });

  it('laisse intacte une entité inconnue', () => {
    expect(decodeHtmlEntities('&inconnue;')).toBe('&inconnue;');
  });

  it('ignore un point de code hors plage sans planter', () => {
    expect(() => decodeHtmlEntities('&#99999999;')).not.toThrow();
  });
});

describe('looksLikeHtml / toPlainText', () => {
  it('détecte le HTML', () => {
    expect(looksLikeHtml('<p>a</p>')).toBe(true);
    expect(looksLikeHtml('texte simple')).toBe(false);
  });

  it('laisse le texte brut intact', () => {
    expect(toPlainText('  déjà du texte  ')).toBe('déjà du texte');
  });
});
