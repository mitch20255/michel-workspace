import AdmZip from 'adm-zip';
import path from 'node:path';
import { JSDOM } from 'jsdom';

function parseXml(xml) {
  return new JSDOM(xml, { contentType: 'text/xml' }).window.document;
}

function textOf(el, tagName) {
  return [...el.getElementsByTagName(tagName)].map((t) => t.textContent).join('');
}

/** Extrait le texte complet d'un EPUB en suivant le spine du fichier OPF. */
export function extractEpubText(buffer) {
  const zip = new AdmZip(buffer);
  const containerDoc = parseXml(zip.readAsText('META-INF/container.xml'));
  const opfPath = containerDoc.querySelector('rootfile').getAttribute('full-path');
  const opfDoc = parseXml(zip.readAsText(opfPath));

  const manifest = {};
  for (const item of opfDoc.getElementsByTagName('item')) {
    manifest[item.getAttribute('id')] = item.getAttribute('href');
  }
  const spineIds = [...opfDoc.getElementsByTagName('itemref')].map((el) => el.getAttribute('idref'));
  const basePath = path.dirname(opfPath);

  let text = '';
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;
    const fullPath = path.posix.join(basePath, href);
    const html = zip.readAsText(fullPath);
    if (!html) continue;
    text += new JSDOM(html).window.document.body?.textContent + '\n\n';
  }
  return text.trim();
}

/** Extrait le texte complet d'un document Word (.docx), paragraphe par paragraphe. */
export function extractDocxText(buffer) {
  const zip = new AdmZip(buffer);
  const xml = zip.readAsText('word/document.xml');
  if (!xml) return '';
  const doc = parseXml(xml);
  const paragraphs = [...doc.getElementsByTagName('w:p')].map((p) => textOf(p, 'w:t'));
  return paragraphs.filter((p) => p.trim()).join('\n');
}

/** Extrait le texte complet d'une présentation PowerPoint (.pptx), slide par slide. */
export function extractPptxText(buffer) {
  const zip = new AdmZip(buffer);
  const slideEntries = zip.getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
    .sort((a, b) => {
      const numOf = (name) => Number(name.match(/slide(\d+)\.xml$/i)[1]);
      return numOf(a.entryName) - numOf(b.entryName);
    });

  const slides = slideEntries.map((entry) => {
    const doc = parseXml(entry.getData().toString('utf-8'));
    return textOf(doc.documentElement, 'a:t');
  });
  return slides.filter((s) => s.trim()).join('\n\n');
}
