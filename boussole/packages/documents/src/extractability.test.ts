import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { makeJob, makeProfile } from '@boussole/core/testing';
import { buildCv } from './cv.js';
import { isTypstAvailable } from './typst.js';

const execFileAsync = promisify(execFile);

/**
 * Test d'extractibilité ATS.
 *
 * C'est le seul test qui vérifie la promesse centrale de la forge : **un
 * logiciel de recrutement doit pouvoir relire le PDF**. Tout le reste (mise en
 * page en une colonne, absence d'en-tête de page, listes natives) n'est qu'un
 * moyen ; ce test mesure le résultat.
 *
 * Il extrait le texte du PDF compilé avec une bibliothèque tierce — donc par
 * un chemin totalement différent de celui qui a produit le document — et
 * vérifie que le contenu et son ordre de lecture sont intacts.
 *
 * Ignoré si Typst ou pypdf sont absents : ce sont des outils de vérification,
 * pas des dépendances du produit.
 */

async function hasPypdf(): Promise<boolean> {
  try {
    await execFileAsync('python3', ['-c', 'import pypdf'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

const canExtract = (await isTypstAvailable()) && (await hasPypdf());
const describeExtraction = canExtract ? describe : describe.skip;

async function extractPdfText(pdf: Uint8Array): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'boussole-extract-'));
  const pdfPath = join(dir, 'document.pdf');
  const scriptPath = join(dir, 'extract.py');

  try {
    await writeFile(pdfPath, pdf);
    await writeFile(
      scriptPath,
      [
        'import sys',
        'from pypdf import PdfReader',
        'reader = PdfReader(sys.argv[1])',
        'sys.stdout.write("\\n".join(page.extract_text() or "" for page in reader.pages))',
      ].join('\n'),
      'utf8',
    );

    const { stdout } = await execFileAsync('python3', [scriptPath, pdfPath], {
      timeout: 30000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describeExtraction('extractibilité du CV par un ATS', () => {
  it('restitue les coordonnées', async () => {
    const profile = makeProfile();
    const document = await buildCv(profile, makeJob());
    const extracted = await extractPdfText(document.pdf!);

    // Les coordonnées sont dans le flux du document, pas dans un en-tête de
    // page : de nombreux extracteurs ignorent purement et simplement les
    // en-têtes, et le candidat deviendrait injoignable.
    expect(extracted).toContain('Camille');
    expect(extracted).toContain(profile.contact.email);
    expect(extracted).toContain('514');
  });

  it('restitue les intitulés de section reconnus par les ATS', async () => {
    const extracted = await extractPdfText((await buildCv(makeProfile(), makeJob())).pdf!);

    expect(extracted.toUpperCase()).toContain('EXPÉRIENCE PROFESSIONNELLE');
    expect(extracted.toUpperCase()).toContain('FORMATION');
    expect(extracted.toUpperCase()).toContain('COMPÉTENCES');
  });

  it('restitue les puces d’expérience mot pour mot', async () => {
    const document = await buildCv(makeProfile(), makeJob());
    const extracted = await extractPdfText(document.pdf!);

    // On compare au texte du profil, pas à une reformulation : c'est ce qui
    // garantit qu'aucun mot n'a été perdu ni altéré en chemin.
    //
    // Le découpage se fait sur les non-lettres plutôt que par retrait de la
    // ponctuation : « React/Node.js » doit donner « React », « Node » et
    // « js », et non « ReactNodejs », qui ne figure évidemment nulle part.
    const bullet = makeProfile().experiences[0]!.bullets[0]!;
    const words = bullet.split(/[^\p{L}]+/u).filter((word) => word.length > 4);
    const normalized = extracted.replace(/\s+/g, ' ');

    expect(words.length).toBeGreaterThan(3);
    for (const word of words) {
      expect(normalized).toContain(word);
    }
  });

  it('préserve l’ordre de lecture', async () => {
    // Une mise en page à deux colonnes serait extraite dans le désordre :
    // c'est la première cause de CV illisibles par les ATS.
    const extracted = (await extractPdfText((await buildCv(makeProfile(), makeJob())).pdf!))
      .replace(/\s+/g, ' ')
      .toUpperCase();

    const nameIndex = extracted.indexOf('CAMILLE');
    const experienceIndex = extracted.indexOf('EXPÉRIENCE PROFESSIONNELLE');
    const educationIndex = extracted.indexOf('FORMATION');
    const skillsIndex = extracted.indexOf('COMPÉTENCES');

    expect(nameIndex).toBeGreaterThanOrEqual(0);
    expect(experienceIndex).toBeGreaterThan(nameIndex);
    expect(educationIndex).toBeGreaterThan(experienceIndex);
    expect(skillsIndex).toBeGreaterThan(educationIndex);
  });

  it('restitue les caractères techniques sans les déformer', async () => {
    const profile = makeProfile();
    profile.skills.push({ name: 'C#', level: 'advanced' });
    profile.skills.push({ name: 'C++', level: 'intermediate' });

    const extracted = await extractPdfText((await buildCv(profile, makeJob())).pdf!);
    expect(extracted).toContain('C#');
    expect(extracted).toContain('C++');
  });

  it('restitue le texte extractible annoncé par la forge', async () => {
    // `plainText` est ce que Boussole affirme qu'un ATS lira. Si le PDF ne
    // contient pas les mêmes mots, l'analyse d'écart de mots-clés raisonne
    // sur un document qui n'existe pas.
    const document = await buildCv(makeProfile(), makeJob());
    const extracted = (await extractPdfText(document.pdf!)).replace(/\s+/g, ' ');

    const claimed = document.plainText
      .split(/\s+/)
      .filter((word) => word.length > 6 && /^[\p{L}]+$/u.test(word));

    const missing = claimed.filter((word) => !extracted.includes(word));
    expect(missing).toEqual([]);
  });
});
