import { useEffect, useRef, useState } from "react";
import type { Produit } from "../lib/off";
import { chercherProduit } from "../lib/off";

type Detecteur = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type FenetreScan = Window & {
  BarcodeDetector?: new (o?: { formats?: string[] }) => Detecteur;
};

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

export function Scanner({
  fermer, ajouter,
}: {
  fermer: () => void;
  ajouter: (prot: number, kcal: number) => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const boucle = useRef<number | undefined>(undefined);

  const [supporte] = useState(() => "BarcodeDetector" in window);
  const [camera, setCamera] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [produit, setProduit] = useState<Produit | null>(null);
  const [grammes, setGrammes] = useState("100");
  const [charge, setCharge] = useState(false);

  useEffect(() => () => arreter(), []);

  function arreter() {
    window.clearInterval(boucle.current);
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    setCamera(false);
  }

  async function demarrer() {
    setErreur(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      flux.current = s;
      setCamera(true);
      // le <video> n'existe qu'après le rendu
      setTimeout(() => {
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => undefined);
        }
      }, 0);

      const D = (window as FenetreScan).BarcodeDetector;
      if (!D) return;
      const detecteur = new D({ formats: FORMATS });
      boucle.current = window.setInterval(async () => {
        if (!video.current || video.current.readyState < 2) return;
        try {
          const trouves = await detecteur.detect(video.current);
          if (trouves.length) {
            const valeur = trouves[0].rawValue;
            arreter();
            setCode(valeur);
            void rechercher(valeur);
          }
        } catch {
          /* une image ratée n'est pas une erreur */
        }
      }, 400);
    } catch {
      setErreur("Impossible d'ouvrir la caméra. Autorise l'accès, ou entre le code à la main.");
    }
  }

  async function rechercher(valeur: string) {
    setCharge(true);
    setErreur(null);
    try {
      const p = await chercherProduit(valeur);
      setProduit(p);
      setGrammes(String(p.portion ?? 100));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Recherche impossible.");
    } finally {
      setCharge(false);
    }
  }

  const g = parseFloat(grammes) || 0;
  const prot = produit ? Math.round((produit.prot100 * g) / 100) : 0;
  const kcal = produit ? Math.round((produit.kcal100 * g) / 100) : 0;

  return (
    <div className="sec">
      <h2>Scanner un produit</h2>
      <div className="panel">
        <div className="note-ochre" style={{ marginBottom: 12 }}>
          Un scan envoie le numéro de code-barres à Open Food Facts, une base ouverte et gratuite.
          Aucune donnée personnelle ne sort de ton téléphone — mais ce n'est plus « rien ne sort ».
        </div>

        {!produit && (
          <>
            {camera ? (
              <div className="scan-view">
                <video ref={video} playsInline muted />
                <div className="scan-frame" />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={demarrer}>Ouvrir la caméra</button>
                <button className="btn ghost" onClick={() => { arreter(); fermer(); }}>Annuler</button>
              </div>
            )}

            {!supporte && (
              <div className="num-sub">
                Ce navigateur ne sait pas décoder les codes-barres tout seul. La caméra s'ouvre
                quand même : lis le chiffre sous le code et entre-le ici.
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <label className="fld" htmlFor="scode">Code-barres</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="scode" type="text" inputMode="numeric" value={code}
                  placeholder="0 12345 67890 5" onChange={(e) => setCode(e.target.value)} />
                <button className="btn" disabled={charge || !code.trim()}
                  onClick={() => { arreter(); void rechercher(code); }}>
                  {charge ? "…" : "Chercher"}
                </button>
              </div>
            </div>
          </>
        )}

        {erreur && <div className="err" style={{ margin: "12px 0 0" }}>{erreur}</div>}

        {produit && (
          <>
            <div className="meal-n">{produit.nom}</div>
            <div className="meal-m" style={{ marginBottom: 10 }}>
              {produit.marque && produit.marque + " · "}
              {produit.prot100} g protéines et {produit.kcal100} kcal par 100 g
            </div>
            <label className="fld" htmlFor="sgr">Quantité mangée (g)</label>
            <input id="sgr" type="number" inputMode="decimal" value={grammes}
              onChange={(e) => setGrammes(e.target.value)} />
            <div className="num-row" style={{ marginTop: 12 }}>
              <span className="num">{prot}</span>
              <span className="num-unit">g de protéines · {kcal} kcal</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => { ajouter(prot, kcal); fermer(); }}>
                Ajouter à la journée
              </button>
              <button className="btn ghost" onClick={() => { setProduit(null); setCode(""); }}>
                Scanner un autre
              </button>
              <button className="btn ghost" onClick={fermer}>Fermer</button>
            </div>
            {produit.prot100 === 0 && (
              <div className="num-sub">
                Open Food Facts ne connaît pas les protéines de ce produit. Va lire l'étiquette et
                corrige le chiffre à la main plutôt que de te fier à ce zéro.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
