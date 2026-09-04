// Relais vers Open Food Facts.
// Deux raisons d'exister : le navigateur ne peut pas fixer le User-Agent
// qu'Open Food Facts demande, et ça met l'app à l'abri d'un changement
// de politique CORS. La requête ne contient qu'un code-barres.

export default async function handler(req, res) {
  const code = String(req.query.code || "").replace(/\D/g, "");
  if (!code || code.length > 20) {
    res.status(400).json({ erreur: "Code-barres invalide." });
    return;
  }

  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      headers: {
        "User-Agent": "ProtocoleGLP1/1.0 (application personnelle de suivi; https://github.com/mitch20255/michel-workspace)",
        Accept: "application/json",
      },
    });
    if (!r.ok) {
      res.status(502).json({ erreur: "Open Food Facts a répondu " + r.status });
      return;
    }
    const data = await r.json();
    // Les produits changent peu : une journée de cache CDN suffit largement.
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json(data);
  } catch {
    res.status(502).json({ erreur: "Open Food Facts est injoignable." });
  }
}
