import type { Config, DayLog, Log, Verdict } from "../types";
import { addDays, aujourdhui, daysBetween, iso, parseISO } from "./dates";
import { ROUGES } from "./seed";

export const JOUR_VIDE: DayLog = {
  prot: 0, kcal: 0, eau: 0, supps: [], effets: [],
  gym: null, poids: null, dose: null, site: null, note: "",
};

/** Lecture d'une journée sans jamais créer d'entrée : le journal reste propre. */
export function jour(log: Log, d: string): DayLog {
  return log[d] ?? JOUR_VIDE;
}

export function existe(log: Log, d: string): boolean {
  return !!log[d];
}

export function moy(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export type Point = { d: string; v: number };

export function poidsSerie(log: Log): Point[] {
  return Object.keys(log)
    .filter((d) => log[d].poids)
    .sort()
    .map((d) => ({ d, v: log[d].poids as number }));
}

/** Moyenne mobile de poids sur une fenêtre de `jours` finissant à `fin`. */
export function ma(serie: Point[], fin: string, jours: number): { v: number; n: number } | null {
  const vals = serie
    .filter((x) => {
      const dd = daysBetween(x.d, fin);
      return dd >= 0 && dd < jours;
    })
    .map((x) => x.v);
  return vals.length ? { v: moy(vals), n: vals.length } : null;
}

/**
 * Les règles de décision du prototype, reprises sans y toucher.
 * Seuils de rythme : >1,3 % trop vite · 1,0–1,3 % rapide · 0,4–1,0 % cible · <0,4 % lent.
 */
export function analyse(log: Log, cfg: Config, ref: string = aujourdhui()): Verdict[] {
  const out: Verdict[] = [];
  const serie = poidsSerie(log);
  const TODAY = ref;
  const base = parseISO(ref); // « aujourd'hui », ou la fin d'une semaine passée pour les exports
  const jour1 = daysBetween(cfg.depart, TODAY);

  // --- rythme de perte
  const recent = ma(serie, TODAY, 7);
  const precedent = ma(serie, iso(addDays(base, -7)), 7);
  if (recent && precedent && precedent.n >= 2 && recent.n >= 2) {
    const delta = precedent.v - recent.v;
    const pct = (delta / precedent.v) * 100;
    const txt = `${delta.toFixed(1)} ${cfg.unite} cette semaine (${pct.toFixed(2)} %/sem)`;
    if (pct > 1.3) {
      out.push({ t: "bad", h: "Tu descends trop vite", p: txt + ". Au-dessus de 1 %/sem, la part de masse maigre perdue grimpe. Remonte de 250 kcal, vérifie que les protéines sont pleines, et ne monte pas la dose." });
    } else if (pct > 1.0) {
      out.push({ t: "warn", h: "Un peu rapide", p: txt + ". Tiens ta dose actuelle et ajoute 150 kcal, surtout si tes charges au gym stagnent." });
    } else if (pct >= 0.4) {
      out.push({ t: "good", h: "Dans la cible", p: txt + ". Ne change rien. C'est exactement le rythme qui protège le muscle." });
    } else if (pct >= 0) {
      out.push({ t: "info", h: "Perte lente", p: txt + ". Normal certaines semaines (eau, sel, sommeil). Attends 2 semaines avant de conclure quoi que ce soit." });
    } else {
      out.push({ t: "info", h: "Poids stable ou en hausse", p: "Une semaine isolée ne dit rien. Regarde plutôt ta moyenne sur 14 jours et ton tour de taille." });
    }
  } else {
    out.push({ t: "info", h: "Pas assez de pesées", p: "Il faut au moins 2 pesées cette semaine et 2 la semaine dernière pour calculer un rythme fiable. Pèse-toi le matin, à jeun." });
  }

  // --- protéines
  const last7: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = iso(addDays(base, -i));
    if (existe(log, d) && (log[d].prot > 0 || log[d].kcal > 0)) last7.push(log[d].prot);
  }
  if (last7.length >= 3) {
    const mp = moy(last7);
    if (mp >= cfg.cibleProt * 0.95) {
      out.push({ t: "good", h: "Protéines tenues", p: `${Math.round(mp)} g/jour en moyenne. C'est ton assurance-muscle et elle est payée.` });
    } else if (mp >= cfg.cibleProt * 0.8) {
      out.push({ t: "warn", h: "Protéines un peu basses", p: `${Math.round(mp)} g/jour contre une cible de ${cfg.cibleProt} g. Ajoute une ancre sans cuisson en après-midi — c'est le trou habituel.` });
    } else {
      out.push({ t: "bad", h: "Protéines nettement sous la cible", p: `${Math.round(mp)} g/jour contre ${cfg.cibleProt} g. C'est le levier nº1 de perte de muscle. Mange la protéine en premier dans l'assiette et garde du liquide en backup.` });
    }
  }

  // --- entraînement
  let gyms = 0;
  for (let j = 0; j < 7; j++) {
    const dg = iso(addDays(base, -j));
    if (existe(log, dg) && log[dg].gym) gyms++;
  }
  if (jour1 >= 0) {
    if (gyms >= cfg.cibleGym) {
      out.push({ t: "good", h: `${gyms} séances cette semaine`, p: "La charge mécanique est le signal qui dit à ton corps de garder le muscle. C'est fait." });
    } else if (gyms > 0) {
      out.push({ t: "warn", h: `${gyms} séance${gyms > 1 ? "s" : ""} sur ${cfg.cibleGym}`, p: "Sans résistance, les protéines seules ne suffisent pas. Une séance courte compte plus qu'une séance parfaite reportée." });
    } else {
      out.push({ t: "bad", h: "Aucune séance cette semaine", p: "C'est la variable qui décide si tu perds du gras ou du poids. Va faire 30 minutes, même léger." });
    }
  }

  // --- titration
  const semDose = Math.floor(daysBetween(cfg.doseDepuis, TODAY) / 7);
  if (jour1 >= 0 && semDose >= 4) {
    const pertePossible = !!recent && !!precedent && precedent.v - recent.v > 0.4;
    if (pertePossible) {
      out.push({ t: "info", h: `${semDose} semaines à ${cfg.doseActuelle} mg — et ça descend encore`, p: "Tu n'as aucune raison de monter. La dose la plus basse qui produit une perte est la bonne dose. Monter par réflexe de calendrier, c'est acheter des effets secondaires pour rien." });
    } else {
      out.push({ t: "info", h: `${semDose} semaines à ${cfg.doseActuelle} mg, perte à plat`, p: "Si le plateau tient encore 2 semaines avec des protéines et un déficit réels, c'est le moment d'en parler à ton prescripteur pour la dose suivante." });
    }
  }

  // --- hydratation
  const eaux: number[] = [];
  for (let e = 0; e < 5; e++) {
    const de = iso(addDays(base, -e));
    if (existe(log, de) && log[de].eau) eaux.push(log[de].eau);
  }
  if (eaux.length >= 3 && moy(eaux) < cfg.cibleEau * 0.7) {
    out.push({ t: "warn", h: "Hydratation basse", p: "Sous GLP-1, la soif est émoussée en même temps que la faim. Bois sur horaire, pas sur signal — et garde le sodium haut." });
  }

  // --- drapeaux rouges
  let rouge: string | null = null;
  for (let r = 0; r < 5; r++) {
    const dr = iso(addDays(base, -r));
    if (existe(log, dr)) {
      log[dr].effets.forEach((x) => {
        if (ROUGES.indexOf(x) >= 0) rouge = x;
      });
    }
  }
  if (rouge) {
    out.unshift({
      t: "bad",
      h: "Signal à ne pas ignorer : " + (rouge as string).toLowerCase(),
      p: "Ce symptôme sort du cadre des effets secondaires courants. Appelle ton prescripteur ou Info-Santé aujourd'hui, pas la semaine prochaine.",
    });
  }

  return out;
}
