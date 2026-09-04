import { get, set, del, createStore } from "idb-keyval";
import type { Config, Log, Mesure, Photo, Plat } from "../types";
import { DEFAULT_CFG, PLATS_SEED } from "./seed";

// Un seul magasin IndexedDB, quatre clés (plus les photos, ajoutées en phase 2).
const store = createStore("protocole-glp1", "donnees");

export const CLES = {
  config: "config",
  log: "log",
  plats: "plats",
  mesures: "mesures",
  photos: "photos",
} as const;

/** Passe à false si une écriture échoue : l'app le dit alors franchement à l'écran. */
let ecritureOK = true;
export function stockageOK() {
  return ecritureOK;
}

async function lire<T>(cle: string, defaut: T): Promise<T> {
  try {
    const v = await get<T>(cle, store);
    return v === undefined ? defaut : v;
  } catch {
    return defaut;
  }
}

async function ecrire(cle: string, valeur: unknown): Promise<void> {
  try {
    await set(cle, valeur, store);
  } catch {
    ecritureOK = false;
  }
}

export const chargerConfig = () =>
  lire<Partial<Config>>(CLES.config, {}).then((c) => ({ ...DEFAULT_CFG, ...c }));
export const chargerLog = () => lire<Log>(CLES.log, {});
export const chargerPlats = () =>
  lire<Plat[]>(CLES.plats, []).then((p) => (p && p.length ? p : PLATS_SEED));
export const chargerMesures = () => lire<Mesure[]>(CLES.mesures, []);
export const chargerPhotos = () => lire<Photo[]>(CLES.photos, []);

export const sauverConfig = (c: Config) => ecrire(CLES.config, c);
export const sauverLog = (l: Log) => ecrire(CLES.log, l);
export const sauverPlats = (p: Plat[]) => ecrire(CLES.plats, p);
export const sauverMesures = (m: Mesure[]) => ecrire(CLES.mesures, m);
export const sauverPhotos = (p: Photo[]) => ecrire(CLES.photos, p);

/** Cache local des produits scannés, pour que les mêmes items reviennent hors ligne. */
export const lireCacheProduit = (code: string) => lire<unknown>("produit:" + code, null);
export const ecrireCacheProduit = (code: string, produit: unknown) =>
  ecrire("produit:" + code, produit);

export async function toutEffacer() {
  for (const cle of Object.values(CLES)) {
    try {
      await del(cle, store);
    } catch {
      ecritureOK = false;
    }
  }
}
