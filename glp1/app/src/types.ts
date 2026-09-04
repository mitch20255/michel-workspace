export type Config = {
  depart: string;
  jourInjection: number; // 0 = dimanche
  poidsDepart: number;
  unite: string;
  cibleProt: number;
  cibleKcal: number;
  cibleEau: number; // verres de 400 ml
  cibleGym: number;
  doseActuelle: number;
  doseDepuis: string;
};

export type DayLog = {
  prot: number;
  kcal: number;
  eau: number;
  supps: string[];
  effets: string[];
  gym: string | null;
  poids: number | null;
  dose: number | null;
  site: string | null;
  note: string;
  /** Vrai quand les totaux viennent d'une saisie directe (MyFitnessPal) plutôt que des boutons de plats. */
  totalManuel?: boolean;
  /** Source du total, pour savoir d'où viennent les chiffres six mois plus tard. */
  source?: "manuel" | "mfp" | "plats";
};

export type Log = Record<string, DayLog>;

export type Plat = {
  id: string;
  n: string;
  p: number;
  l: number;
  g: number;
  k: number;
  note: string;
  nausee: boolean;
};

export type Mesure = {
  date: string;
  taille: string;
  cou: string;
  bras: string;
  poitrine: string;
};

export type Photo = {
  id: string;
  date: string;
  blob: Blob;
  poids: number | null;
};

export type VerdictType = "good" | "warn" | "bad" | "info";
export type Verdict = { t: VerdictType; h: string; p: string };

export type Onglet = "jour" | "semaine" | "plats" | "protocole" | "suivi";
