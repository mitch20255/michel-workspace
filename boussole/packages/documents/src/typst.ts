import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Compilation Typst.
 *
 * Deux propriétés voulues :
 *
 * 1. **Dégradation gracieuse.** Si le binaire Typst est absent, la génération
 *    ne s'arrête pas : la source `.typ` et le texte extractible sont produits
 *    quand même. Le candidat garde un document exploitable et un message clair,
 *    au lieu d'une erreur opaque au pire moment.
 *
 * 2. **Aucune écriture hors du dossier temporaire.** La compilation se fait
 *    dans un répertoire isolé, supprimé ensuite. Typst peut lire des fichiers
 *    référencés par le document ; en confinant la compilation, un document mal
 *    formé ne peut pas atteindre le reste du disque.
 */

export class TypstUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(
      `Typst est indisponible (${reason}). Les sources et le texte du document ont été produits, mais pas le PDF. ` +
        'Installer Typst : https://github.com/typst/typst#installation',
    );
    this.name = 'TypstUnavailableError';
  }
}

export class TypstCompilationError extends Error {
  constructor(readonly stderr: string) {
    super(`Échec de compilation Typst : ${stderr.split('\n').slice(0, 5).join(' ')}`);
    this.name = 'TypstCompilationError';
  }
}

export interface TypstOptions {
  /** Chemin du binaire. Par défaut `typst` dans le PATH. */
  binary?: string;
  timeoutMs?: number;
}

let availabilityCache: { binary: string; available: boolean; reason?: string } | undefined;

/** Vérifie la présence du binaire. Le résultat est mis en cache par binaire. */
export async function isTypstAvailable(options: TypstOptions = {}): Promise<boolean> {
  const binary = options.binary ?? process.env.TYPST_BIN ?? 'typst';
  if (availabilityCache?.binary === binary) return availabilityCache.available;

  try {
    await execFileAsync(binary, ['--version'], { timeout: 5000 });
    availabilityCache = { binary, available: true };
    return true;
  } catch (error) {
    availabilityCache = {
      binary,
      available: false,
      reason: error instanceof Error ? error.message : 'binaire introuvable',
    };
    return false;
  }
}

/** Réinitialise le cache de disponibilité. Réservé aux tests. */
export function resetTypstAvailabilityCache(): void {
  availabilityCache = undefined;
}

/**
 * Compile une source Typst en PDF.
 *
 * @throws {TypstUnavailableError} si le binaire est absent.
 * @throws {TypstCompilationError} si la source est invalide.
 */
export async function compileTypst(
  source: string,
  options: TypstOptions = {},
): Promise<Uint8Array> {
  const binary = options.binary ?? process.env.TYPST_BIN ?? 'typst';
  const timeout = options.timeoutMs ?? 30000;

  if (!(await isTypstAvailable({ binary }))) {
    throw new TypstUnavailableError(availabilityCache?.reason ?? 'binaire introuvable');
  }

  const workDir = await mkdtemp(join(tmpdir(), 'boussole-typst-'));
  const inputPath = join(workDir, 'document.typ');
  const outputPath = join(workDir, 'document.pdf');

  try {
    await writeFile(inputPath, source, 'utf8');
    // `--root` confine la compilation : le document ne peut pas lire de
    // fichier hors du dossier temporaire.
    await execFileAsync(binary, ['compile', '--root', workDir, inputPath, outputPath], {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return await readFile(outputPath);
  } catch (error) {
    const stderr =
      typeof error === 'object' && error !== null && 'stderr' in error
        ? String((error as { stderr: unknown }).stderr)
        : String(error);
    throw new TypstCompilationError(stderr);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Écrit un PDF sur disque, en créant l'arborescence au besoin. */
export async function writePdf(destination: string, pdf: Uint8Array): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, pdf);
}
