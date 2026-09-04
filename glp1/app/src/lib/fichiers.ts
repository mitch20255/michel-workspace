/** Petites briques de fichiers : téléchargement, CRC32, ZIP « stored ». Aucune dépendance. */

export function telecharger(nom: string, contenu: Blob | string, type = "text/plain;charset=utf-8") {
  const blob = typeof contenu === "string" ? new Blob([contenu], { type }) : contenu;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

let table: Int32Array | null = null;
export function crc32(buf: Uint8Array): number {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

type Entree = { nom: string; donnees: Uint8Array };

/**
 * Écrit un .zip sans compression (méthode « stored »).
 * Suffisant pour des notes Markdown, et ça évite d'embarquer une librairie.
 */
export function zip(entrees: Entree[]): Blob {
  const enc = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];

  for (const e of entrees) {
    const nom = enc.encode(e.nom);
    const crc = crc32(e.donnees);
    const taille = e.donnees.length;
    const enTete = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), // heure/date : on s'en fout, Obsidian ne les lit pas
      ...u32(crc), ...u32(taille), ...u32(taille),
      ...u16(nom.length), ...u16(0), ...nom,
    ]);
    locales.push(enTete, e.donnees);
    centrales.push(
      Uint8Array.from([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(crc), ...u32(taille), ...u32(taille),
        ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset), ...nom,
      ]),
    );
    offset += enTete.length + taille;
  }

  const tailleCentrale = centrales.reduce((a, b) => a + b.length, 0);
  const fin = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entrees.length), ...u16(entrees.length),
    ...u32(tailleCentrale), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...locales, ...centrales, fin] as BlobPart[], { type: "application/zip" });
}
