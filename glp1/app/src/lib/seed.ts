import type { Config, Plat } from "../types";

export const DEFAULT_CFG: Config = {
  depart: "2026-09-03",
  jourInjection: 4, // 0 = dimanche
  poidsDepart: 340,
  unite: "lb",
  cibleProt: 180,
  cibleKcal: 2400,
  cibleEau: 8, // verres de 400 ml
  cibleGym: 3,
  doseActuelle: 2.5,
  doseDepuis: "2026-09-03",
};

export const SUPPS = [
  { id: "crea", n: "Créatine 5 g", w: "masse maigre + force" },
  { id: "multi", n: "Multivitamine", w: "l'apport chute avec les calories" },
  { id: "d3", n: "Vitamine D3", w: "déficience quasi systématique" },
  { id: "o3", n: "Oméga-3", w: "2–3 g EPA+DHA" },
  { id: "mag", n: "Magnésium citrate", w: "crampes + transit" },
  { id: "psy", n: "Psyllium + fibres", w: "le transit est l'irritant nº1" },
  { id: "sel", n: "Sodium 4–5 g", w: "sinon: étourdissements" },
  { id: "kal", n: "Potassium (bouffe)", w: "avocat, patate, épinards" },
];

export const EFFETS = [
  "Nausée", "Constipation", "Reflux", "Fatigue",
  "Crampes", "Étourdissements", "Rien à signaler",
];

export const ROUGES = [
  "Douleur abdo sévère",
  "Vomissements répétés",
  "Douleur côtes droites",
];

export const GYMS = ["Full body A", "Full body B", "Full body C", "Marche seulement"];

export const PLATS_SEED: Plat[] = [
  { id: "p1", n: "Poulet-brocoli sur plaque", p: 53, l: 22, g: 12, k: 460, note: "250 g de cuisses désossées, brocoli, huile d'olive, ail. 30 min à 425 °F.", nausee: false },
  { id: "p2", n: "Bœuf haché, patate douce, poivrons", p: 48, l: 40, g: 45, k: 730, note: "Bœuf 85 %, une poêle, tout ensemble. Cumin et paprika fumé.", nausee: false },
  { id: "p3", n: "Saumon, asperges, grelots", p: 45, l: 28, g: 30, k: 560, note: "Une plaque, 18 min. Citron à la sortie.", nausee: false },
  { id: "p4", n: "Porc effiloché + salade de chou", p: 52, l: 24, g: 14, k: 480, note: "Épaule à la mijoteuse le dimanche, sert 4 soupers.", nausee: false },
  { id: "p5", n: "Chili bœuf et haricots noirs", p: 44, l: 20, g: 38, k: 510, note: "Gros chaudron, congèle en portions. Meilleur le lendemain.", nausee: false },
  { id: "p6", n: "Frittata jambon-fromage", p: 40, l: 26, g: 6, k: 420, note: "6 œufs, jambon, cheddar. 12 min au four, zéro planification.", nausee: false },
  { id: "p7", n: "Crevettes, riz, edamame", p: 46, l: 12, g: 48, k: 490, note: "Wok, 10 minutes. Le plat le plus rapide de la liste.", nausee: true },
  { id: "p8", n: "Poulet shawarma, patates, yogourt", p: 55, l: 20, g: 40, k: 560, note: "Marine le matin, plaque le soir. Sauce yogourt grec-ail.", nausee: false },
  { id: "p9", n: "Soupe poulet-lentilles", p: 38, l: 10, g: 30, k: 350, note: "Pour les 48 h après l'injection: liquide, tiède, faible en gras.", nausee: true },
  { id: "p10", n: "Steak haché de dinde, courgettes", p: 47, l: 16, g: 10, k: 380, note: "Léger quand l'appétit est coupé mais que tu veux du solide.", nausee: true },
  { id: "a1", n: "Shake isolat + lait", p: 40, l: 4, g: 12, k: 250, note: "Ancre sans cuisson. Le plan B des jours difficiles.", nausee: true },
  { id: "a2", n: "Yogourt grec 0 % + whey", p: 45, l: 2, g: 14, k: 260, note: "Ancre sans cuisson. Déjeuner léger.", nausee: true },
  { id: "a3", n: "Cottage + fruits", p: 28, l: 5, g: 18, k: 230, note: "Ancre sans cuisson. Caséine lente, bon avant le coucher.", nausee: true },
  { id: "a4", n: "Thon + craquelins", p: 32, l: 8, g: 20, k: 290, note: "Ancre sans cuisson. Garde-manger, zéro préparation.", nausee: false },
  { id: "a5", n: "3 œufs durs + fromage", p: 26, l: 20, g: 2, k: 290, note: "Ancre sans cuisson. Prépare-en 8 le dimanche.", nausee: false },
];
