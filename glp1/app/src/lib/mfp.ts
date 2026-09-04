/**
 * Import des exports MyFitnessPal.
 *
 * Deux sorties existent et l'app digère les deux :
 *  - l'export CSV en un clic (réservé à l'abonnement Premium) ;
 *  - la demande « Download My Data », gratuite, qui arrive par courriel sous forme de .zip.
 *
 * Rien ne part de l'appareil : tout est lu dans le navigateur.
 */

import { iso } from "./dates";

export type LigneImport = { date: string; prot: number; kcal: number; lignes: number };
export type Apercu = {
  jours: LigneImport[];
  fichier: string;
  colonnes: { date: string; prot: string; kcal: string };
  ignorees: number;
  avertissement: string | null;
};

// ------------------------------------------------------------------ CSV

/** Analyseur CSV complet : guillemets, virgules dans les champs, "" échappé, CRLF. */
export function analyserCSV(texte: string): string[][] {
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let dansGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"') { dansGuillemets = true; continue; }
    if (c === ",") { ligne.push(champ); champ = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; continue; }
    champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((x) => x.trim() !== ""));
}

// ------------------------------------------------------------------ ZIP

/** Lit un .zip (méthodes « stored » et « deflate ») sans dépendance. */
export async function dezip(buf: ArrayBuffer): Promise<{ nom: string; texte: string }[]> {
  const vue = new DataView(buf);
  const octets = new Uint8Array(buf);

  // fin du répertoire central
  let fin = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 65558; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("Ce .zip est illisible.");

  const nbEntrees = vue.getUint16(fin + 10, true);
  let p = vue.getUint32(fin + 16, true);
  const sorties: { nom: string; texte: string }[] = [];
  const dec = new TextDecoder("utf-8");

  for (let n = 0; n < nbEntrees; n++) {
    if (vue.getUint32(p, true) !== 0x02014b50) break;
    const methode = vue.getUint16(p + 10, true);
    const tailleCompressee = vue.getUint32(p + 20, true);
    const longNom = vue.getUint16(p + 28, true);
    const longExtra = vue.getUint16(p + 30, true);
    const longComm = vue.getUint16(p + 32, true);
    const debutLocal = vue.getUint32(p + 42, true);
    const nom = dec.decode(octets.subarray(p + 46, p + 46 + longNom));
    p += 46 + longNom + longExtra + longComm;

    if (!/\.csv$/i.test(nom)) continue;

    // en-tête local : les longueurs nom/extra peuvent différer du répertoire central
    const nomLocal = vue.getUint16(debutLocal + 26, true);
    const extraLocal = vue.getUint16(debutLocal + 28, true);
    const debutDonnees = debutLocal + 30 + nomLocal + extraLocal;
    const donnees = octets.subarray(debutDonnees, debutDonnees + tailleCompressee);

    if (methode === 0) {
      sorties.push({ nom, texte: dec.decode(donnees) });
    } else if (methode === 8) {
      const flux = new Blob([donnees as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      sorties.push({ nom, texte: await new Response(flux).text() });
    }
  }
  return sorties;
}

// ------------------------------------------------------------------ colonnes

function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Trouve une colonne par mots-clés, en anglais comme en français. */
function trouverColonne(entetes: string[], motsCles: string[], exclure: string[] = []): number {
  const norm = entetes.map(normaliser);
  for (const mot of motsCles) {
    const i = norm.findIndex((h) => h.includes(mot) && !exclure.some((x) => h.includes(x)));
    if (i >= 0) return i;
  }
  return -1;
}

const MOIS_EN: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Renvoie une date ISO, ou null. Signale au passage si le format était ambigu. */
export function lireDate(brut: string): { date: string | null; ambigu: boolean } {
  const s = brut.trim();
  if (!s) return { date: null, ambigu: false };

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return { date: s.slice(0, 10), ambigu: false };

  const enLettres = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (enLettres) {
    const m = MOIS_EN[enLettres[1].toLowerCase()];
    if (m !== undefined) return { date: iso(new Date(+enLettres[3], m, +enLettres[2])), ambigu: false };
  }

  // MyFitnessPal écrit les dates numériques à l'américaine : mois/jour/année.
  const num = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (num) {
    const an = +num[3] < 100 ? 2000 + +num[3] : +num[3];
    const a = +num[1], b = +num[2];
    // Si le premier nombre dépasse 12, ce ne peut être qu'un jour : jour/mois.
    const [mois, jourDuMois] = a > 12 ? [b - 1, a] : [a - 1, b];
    if (mois > 11 || jourDuMois > 31) return { date: null, ambigu: false };
    return { date: iso(new Date(an, mois, jourDuMois)), ambigu: a <= 12 && b <= 12 };
  }

  const t = Date.parse(s);
  return isNaN(t) ? { date: null, ambigu: false } : { date: iso(new Date(t)), ambigu: false };
}

function nombre(brut: string): number {
  const v = parseFloat(String(brut).replace(/\s/g, "").replace(",", "."));
  return isNaN(v) ? 0 : v;
}

// ------------------------------------------------------------------ import

/** Transforme un CSV MyFitnessPal en totaux journaliers. */
export function lireCSVNutrition(nomFichier: string, texte: string): Apercu {
  const grille = analyserCSV(texte);
  if (grille.length < 2) throw new Error("Ce fichier ne contient aucune ligne de données.");

  const entetes = grille[0];
  const iDate = trouverColonne(entetes, ["date", "jour"]);
  const iProt = trouverColonne(entetes, ["protein", "proteine"]);
  const iKcal = trouverColonne(entetes, ["calorie", "energie", "energy", "kcal"]);

  if (iDate < 0) throw new Error("Aucune colonne de date reconnue dans ce fichier.");
  if (iProt < 0 && iKcal < 0) {
    throw new Error("Ni protéines ni calories dans ce fichier — ce n'est probablement pas le journal alimentaire.");
  }

  const parJour = new Map<string, LigneImport>();
  let ignorees = 0;
  let ambigu = false;

  for (let i = 1; i < grille.length; i++) {
    const l = grille[i];
    const lue = lireDate(l[iDate] ?? "");
    if (lue.ambigu) ambigu = true;
    if (!lue.date) { ignorees++; continue; }
    const actuel = parJour.get(lue.date) ?? { date: lue.date, prot: 0, kcal: 0, lignes: 0 };
    actuel.prot += iProt >= 0 ? nombre(l[iProt] ?? "") : 0;
    actuel.kcal += iKcal >= 0 ? nombre(l[iKcal] ?? "") : 0;
    actuel.lignes++;
    parJour.set(lue.date, actuel);
  }

  const jours = [...parJour.values()]
    .map((j) => ({ ...j, prot: Math.round(j.prot), kcal: Math.round(j.kcal) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!jours.length) throw new Error("Aucune date lisible dans ce fichier.");

  return {
    jours,
    fichier: nomFichier,
    colonnes: {
      date: entetes[iDate],
      prot: iProt >= 0 ? entetes[iProt] : "—",
      kcal: iKcal >= 0 ? entetes[iKcal] : "—",
    },
    ignorees,
    avertissement: ambigu
      ? "Les dates sont écrites en chiffres. Elles ont été lues à l'américaine (mois/jour/année), comme MyFitnessPal les écrit. Vérifie les jours ci-dessous avant d'importer."
      : null,
  };
}

/** Point d'entrée : accepte un .csv ou le .zip de « Download My Data ». */
export async function lireFichierMFP(fichier: File): Promise<Apercu> {
  if (/\.zip$/i.test(fichier.name)) {
    const contenus = await dezip(await fichier.arrayBuffer());
    if (!contenus.length) throw new Error("Aucun CSV dans ce .zip.");
    // le fichier de nutrition d'abord, sinon on tente les autres
    const ordonnes = contenus.sort((a, b) => score(b.nom) - score(a.nom));
    let derniereErreur: unknown = null;
    for (const c of ordonnes) {
      try {
        return lireCSVNutrition(c.nom, c.texte);
      } catch (e) {
        derniereErreur = e;
      }
    }
    throw derniereErreur instanceof Error ? derniereErreur : new Error("Aucun journal alimentaire trouvé dans ce .zip.");
  }
  return lireCSVNutrition(fichier.name, await fichier.text());
}

function score(nom: string): number {
  const n = normaliser(nom);
  if (n.includes("nutrition")) return 3;
  if (n.includes("food") || n.includes("aliment")) return 2;
  if (n.includes("exercise") || n.includes("measure")) return -1;
  return 0;
}
