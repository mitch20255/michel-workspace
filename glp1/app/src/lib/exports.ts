import type { Config, Log, Mesure, Plat } from "../types";
import { JOURS, MOIS, addDays, iso, parseISO } from "./dates";
import { analyse, poidsSerie, ma } from "./analyse";
import { telecharger, zip } from "./fichiers";

export type Sauvegarde = {
  format: "protocole-glp1";
  version: 1;
  exporte: string;
  config: Config;
  log: Log;
  plats: Plat[];
  mesures: Mesure[];
};

export function exporterJSON(config: Config, log: Log, plats: Plat[], mesures: Mesure[]) {
  const d: Sauvegarde = {
    format: "protocole-glp1",
    version: 1,
    exporte: new Date().toISOString(),
    config, log, plats, mesures,
  };
  telecharger(`protocole-glp1-${iso(new Date())}.json`, JSON.stringify(d, null, 2), "application/json");
}

/** Lit une sauvegarde et refuse tout ce qui n'a pas la bonne forme. */
export function lireSauvegarde(texte: string): Sauvegarde {
  const d = JSON.parse(texte);
  if (!d || d.format !== "protocole-glp1" || typeof d.log !== "object") {
    throw new Error("Ce fichier n'est pas une sauvegarde du Protocole GLP-1.");
  }
  return d as Sauvegarde;
}

// ------------------------------------------------------------------ Obsidian

/** Le dimanche qui ouvre la semaine d'une date, comme la bande du haut de l'app. */
function debutSemaine(d: string): string {
  const x = parseISO(d);
  return iso(addDays(x, -x.getDay()));
}

function libelleDate(d: string): string {
  const x = parseISO(d);
  return `${x.getDate()} ${MOIS[x.getMonth()]} ${x.getFullYear()}`;
}

function courbeSVG(points: { d: string; v: number }[]): string {
  if (points.length < 2) return "";
  const W = 480, H = 160, pad = 30;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals) - 1, max = Math.max(...vals) + 1;
  const d0 = parseISO(points[0].d).getTime();
  const span = Math.max(1, (parseISO(points[points.length - 1].d).getTime() - d0) / 86400000);
  const X = (d: string) => pad + ((parseISO(d).getTime() - d0) / 86400000 / span) * (W - pad - 10);
  const Y = (v: number) => 12 + (1 - (v - min) / (max - min || 1)) * (H - 34);
  const ligne = points.map((p) => `${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const cercles = points.map((p) => `<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3" fill="#8A929B"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<line x1="${pad}" y1="${H - 20}" x2="${W - 10}" y2="${H - 20}" stroke="#D6D6CE"/>
<polyline points="${ligne}" fill="none" stroke="#2743C4" stroke-width="2" stroke-linejoin="round"/>
${cercles}
<text x="4" y="16" font-size="10" fill="#8A929B" font-family="sans-serif">${max.toFixed(0)}</text>
<text x="4" y="${H - 24}" font-size="10" fill="#8A929B" font-family="sans-serif">${min.toFixed(0)}</text>
</svg>`;
}

export function noteSemaine(debut: string, log: Log, cfg: Config): string {
  const jours = Array.from({ length: 7 }, (_, i) => iso(addDays(parseISO(debut), i)));
  const fin = jours[6];
  const serie = poidsSerie(log).filter((p) => p.d >= debut && p.d <= fin);
  const verdicts = analyse(log, cfg, fin);

  const lignes = jours
    .filter((d) => log[d])
    .map((d) => {
      const l = log[d];
      const effets = l.effets.length ? l.effets.join(", ") : "—";
      return `| ${JOURS[parseISO(d).getDay()].slice(0, 3)} ${d.slice(5)} | ${l.poids ?? "—"} | ${l.prot || "—"} | ${l.kcal || "—"} | ${l.eau || "—"} | ${l.gym ?? "—"} | ${effets} |`;
    });

  const moyenne = ma(poidsSerie(log), fin, 7);
  const notes = jours.filter((d) => log[d]?.note).map((d) => `> **${d}** — ${log[d].note}`);

  return `---
type: protocole-glp1
semaine_du: ${debut}
semaine_au: ${fin}
dose: ${cfg.doseActuelle}
---

# Semaine du ${libelleDate(debut)}

${moyenne ? `Moyenne de poids sur 7 jours : **${moyenne.v.toFixed(1)} ${cfg.unite}** (${moyenne.n} pesée${moyenne.n > 1 ? "s" : ""}).` : "Aucune pesée cette semaine."}

## Les jours

| Jour | Poids | Prot | Kcal | Eau | Gym | Effets |
| --- | --- | --- | --- | --- | --- | --- |
${lignes.length ? lignes.join("\n") : "| — | — | — | — | — | — | — |"}

${serie.length >= 2 ? `## La courbe\n\n${courbeSVG(serie)}\n` : ""}
## Les verdicts

${verdicts.map((v) => `- **${v.h}** — ${v.p}`).join("\n")}
${notes.length ? `\n## Journal\n\n${notes.join("\n\n")}\n` : ""}`;
}

export function exporterObsidian(log: Log, cfg: Config) {
  const semaines = [...new Set(Object.keys(log).sort().map(debutSemaine))];
  if (!semaines.length) throw new Error("Il n'y a encore rien à exporter.");
  const enc = new TextEncoder();
  const entrees = semaines.map((debut) => ({
    nom: `Protocole GLP-1/Semaine ${debut}.md`,
    donnees: enc.encode(noteSemaine(debut, log, cfg)),
  }));
  telecharger(`protocole-glp1-obsidian-${iso(new Date())}.zip`, zip(entrees));
  return semaines.length;
}

// ----------------------------------------------------------------- calendrier

function estampille(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Heure « flottante » : sans Z ni fuseau, un calendrier l'affiche à l'heure locale
 * du lecteur. C'est ce qu'on veut ici — 7 h reste 7 h après le changement d'heure.
 */
function flottant(d: Date): string {
  const n = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}${n(d.getMonth() + 1)}${n(d.getDate())}T${n(d.getHours())}${n(d.getMinutes())}00`;
}

function a(jour: Date, heure: number, minute: number): Date {
  return new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), heure, minute, 0);
}

/**
 * Récurrences du protocole, à importer dans Google Agenda.
 * C'est le chemin fiable : voir la note sur les notifications dans l'onglet Suivi.
 */
export function exporterICS(cfg: Config) {
  const JOURS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const now = new Date();
  const stamp = estampille(now);

  // première occurrence de l'injection à partir d'aujourd'hui
  const versInjection = (cfg.jourInjection - now.getDay() + 7) % 7;
  const prochaineInjection = addDays(now, versInjection);
  const demain = addDays(now, 1);

  const evenements = [
    {
      uid: "injection@protocole-glp1",
      titre: `Injection ${cfg.doseActuelle} mg`,
      desc: "Note la dose et le site dans l'app. Les 48 h qui suivent : petites portions, faible en gras.",
      debut: a(prochaineInjection, 20, 0),
      duree: 15,
      rrule: `FREQ=WEEKLY;BYDAY=${JOURS_ICS[cfg.jourInjection]}`,
      alarme: 30,
    },
    {
      uid: "pesee@protocole-glp1",
      titre: "Pesée du matin",
      desc: "Le matin, à jeun, avant de boire. Note-la dans l'app.",
      debut: a(demain, 7, 0),
      duree: 5,
      rrule: "FREQ=DAILY",
      alarme: 0,
    },
    {
      uid: "proteines@protocole-glp1",
      titre: `Point protéines (cible ${cfg.cibleProt} g)`,
      desc: "Le trou est entre 14 h et 17 h. S'il te reste plus de 60 g, prends une ancre sans cuisson.",
      debut: a(demain, 16, 0),
      duree: 10,
      rrule: "FREQ=DAILY",
      alarme: 0,
    },
    {
      uid: "revue@protocole-glp1",
      titre: "Revue de la semaine",
      desc: "Ouvre l'onglet Semaine, lis les verdicts, décide des 2-3 ajustements.",
      debut: a(addDays(now, (7 - now.getDay()) % 7), 19, 0),
      duree: 20,
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      alarme: 0,
    },
  ];

  const plier = (l: string) =>
    l.length <= 74 ? l : l.slice(0, 74) + "\r\n " + (l.slice(74).match(/.{1,73}/g) || []).join("\r\n ");

  const corps = evenements
    .flatMap((e) => {
      const fin = new Date(e.debut.getTime() + e.duree * 60000);
      return [
        "BEGIN:VEVENT",
        `UID:${e.uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${flottant(e.debut)}`,
        `DTEND:${flottant(fin)}`,
        `RRULE:${e.rrule}`,
        plier(`SUMMARY:${e.titre}`),
        plier(`DESCRIPTION:${e.desc}`),
        "BEGIN:VALARM",
        `TRIGGER:-PT${e.alarme}M`,
        "ACTION:DISPLAY",
        plier(`DESCRIPTION:${e.titre}`),
        "END:VALARM",
        "END:VEVENT",
      ];
    })
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Protocole GLP-1//FR-CA//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    corps,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  telecharger("protocole-glp1-rappels.ics", ics, "text/calendar;charset=utf-8");
}
