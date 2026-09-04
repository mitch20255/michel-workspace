/**
 * Recherche de produits par code-barres dans Open Food Facts.
 *
 * Deux détails qui expliquent le relais serveur (`/api/produit`) :
 *  1. Open Food Facts demande un User-Agent descriptif, et un navigateur
 *     interdit de le fixer depuis fetch() ;
 *  2. ça évite de dépendre de la politique CORS du service.
 * Si le relais n'existe pas (ex. `npm run dev` sans Vercel), on tente l'appel direct.
 *
 * Ce qui sort de l'appareil : le numéro de code-barres. Rien d'autre.
 */

import { ecrireCacheProduit, lireCacheProduit } from "./storage";

export type Produit = {
  code: string;
  nom: string;
  marque: string;
  /** Valeurs pour 100 g / 100 ml. */
  prot100: number;
  kcal100: number;
  /** Portion suggérée par l'étiquette, en grammes, si elle est connue. */
  portion: number | null;
};

type ReponseOFF = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_fr?: string;
    brands?: string;
    serving_quantity?: number | string;
    nutriments?: Record<string, number | string>;
  };
};

function nombre(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return isNaN(n) ? 0 : n;
}

function convertir(code: string, r: ReponseOFF): Produit | null {
  const p = r.product;
  if (!p || r.status === 0) return null;
  const n = p.nutriments ?? {};
  const kcal = nombre(n["energy-kcal_100g"]) || Math.round(nombre(n["energy_100g"]) / 4.184);
  const portion = nombre(p.serving_quantity);
  return {
    code,
    nom: (p.product_name_fr || p.product_name || "Produit sans nom").trim(),
    marque: (p.brands || "").split(",")[0].trim(),
    prot100: Math.round(nombre(n["proteins_100g"]) * 10) / 10,
    kcal100: Math.round(kcal),
    portion: portion > 0 ? portion : null,
  };
}

export async function chercherProduit(code: string): Promise<Produit> {
  const propre = code.replace(/\D/g, "");
  if (!propre) throw new Error("Code-barres illisible.");

  const enCache = (await lireCacheProduit(propre)) as Produit | null;
  if (enCache) return enCache;

  let reponse: ReponseOFF | null = null;
  try {
    const r = await fetch(`/api/produit?code=${propre}`);
    if (r.ok) reponse = await r.json();
  } catch {
    /* on tente l'appel direct juste après */
  }
  if (reponse === null) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${propre}.json`);
      if (!r.ok) throw new Error();
      reponse = (await r.json()) as ReponseOFF;
    } catch {
      throw new Error(
        "Impossible de joindre Open Food Facts. Vérifie ta connexion, ou entre les protéines à la main dans « Total du jour ».",
      );
    }
  }

  const produit = convertir(propre, reponse as ReponseOFF);
  if (!produit) throw new Error("Ce produit n'est pas dans Open Food Facts.");
  await ecrireCacheProduit(propre, produit);
  return produit;
}
