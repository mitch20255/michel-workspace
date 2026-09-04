import { useEffect, useState } from "react";
import type { Store } from "../store";
import { EFFETS, GYMS, ROUGES, SUPPS } from "../lib/seed";
import { Scanner } from "../components/Scanner";

export function Jour({ s }: { s: Store }) {
  const cfg = s.cfg!;
  const d = s.jourCourant;
  const pct = Math.min(100, Math.round((d.prot / cfg.cibleProt) * 100));
  const estInjection = new Date().getDay() === cfg.jourInjection;

  const [totProt, setTotProt] = useState("");
  const [totKcal, setTotKcal] = useState("");
  const [poids, setPoids] = useState("");
  const [dose, setDose] = useState("");
  const [site, setSite] = useState("Abdomen");
  const [scanOuvert, setScanOuvert] = useState(false);

  // Les champs se remplissent avec ce qui est déjà noté, une fois les données chargées.
  useEffect(() => {
    setTotProt(d.prot ? String(d.prot) : "");
    setTotKcal(d.kcal ? String(d.kcal) : "");
    setPoids(d.poids ? String(d.poids) : "");
    setDose(String(d.dose ?? cfg.doseActuelle));
    setSite(d.site ?? "Abdomen");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pret]);

  function ajouter(p: number, k: number) {
    s.majJour(s.today, (j) => ({
      prot: j.prot + p,
      kcal: j.kcal + k,
      source: j.source ?? "plats",
    }));
  }

  function enregistrerTotal() {
    const p = parseInt(totProt, 10);
    const k = parseInt(totKcal, 10);
    if (isNaN(p) && isNaN(k)) {
      s.dire("Il manque un chiffre");
      return;
    }
    s.majJour(s.today, (j) => ({
      prot: isNaN(p) ? j.prot : p,
      kcal: isNaN(k) ? j.kcal : k,
      totalManuel: true,
      source: "manuel",
    }));
    s.dire("Total du jour enregistré");
  }

  const origine =
    d.source === "manuel" ? "Total saisi à la main (MyFitnessPal)."
    : d.source === "mfp" ? "Importé de MyFitnessPal."
    : d.source === "plats" ? "Additionné à partir des plats de la journée."
    : null;

  return (
    <>
      {/* ---------------------------------------------------- protéines */}
      <div className="sec">
        <h2>Protéines</h2>
        <div className="panel">
          <div className="num-row">
            <span className="num">{d.prot}</span>
            <span className="num-unit">g sur {cfg.cibleProt} g</span>
          </div>
          <div className="meter">
            <i className={pct >= 100 ? "done" : ""} style={{ width: pct + "%" }} />
          </div>
          <div className="num-sub">
            {pct >= 100
              ? "Cible atteinte. C'est la journée qui compte le plus."
              : `Il te reste ${cfg.cibleProt - d.prot} g. Mange la protéine en premier.`}
            {origine && <> {origine}</>}
          </div>
          <div className="chips">
            {s.plats.slice(0, 6).map((p) => (
              <button key={p.id} className="chip" onClick={() => ajouter(p.p, p.k)}>
                {p.n.split(",")[0]} <b>+{p.p}</b>
              </button>
            ))}
            <button className="chip" onClick={() => ajouter(10, 60)}>+10 g</button>
            <button
              className="chip"
              onClick={() => {
                s.majJour(s.today, { prot: 0, kcal: 0, totalManuel: false, source: undefined });
                setTotProt("");
                setTotKcal("");
              }}
            >
              Remettre à zéro
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------- total du jour (MFP) */}
      <div className="sec">
        <h2>Total du jour</h2>
        <div className="panel">
          <div className="num-sub" style={{ marginTop: 0, marginBottom: 10 }}>
            Le soir, ouvre MyFitnessPal et recopie les deux chiffres. Ça écrase le compteur
            ci-dessus au lieu de s'y additionner.
          </div>
          <div className="grid2">
            <div>
              <label className="fld" htmlFor="tprot">Protéines (g)</label>
              <input id="tprot" type="number" inputMode="numeric" value={totProt}
                onChange={(e) => setTotProt(e.target.value)} />
            </div>
            <div>
              <label className="fld" htmlFor="tkcal">Calories</label>
              <input id="tkcal" type="number" inputMode="numeric" value={totKcal}
                onChange={(e) => setTotKcal(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={enregistrerTotal}>Enregistrer le total</button>
            <button className="btn ghost" onClick={() => setScanOuvert(true)}>Scanner un produit</button>
          </div>
        </div>
      </div>

      {scanOuvert && (
        <Scanner
          fermer={() => setScanOuvert(false)}
          ajouter={(p, k) => { ajouter(p, k); s.dire("Ajouté à la journée"); }}
        />
      )}

      {/* ---------------------------------------------------- pesée */}
      <div className="sec">
        <h2>Pesée du matin</h2>
        <div className="panel">
          <div>
            <label className="fld" htmlFor="fpoids">Poids ({cfg.unite})</label>
            <input id="fpoids" type="number" step="0.1" inputMode="decimal" value={poids}
              onChange={(e) => setPoids(e.target.value)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              className="btn"
              onClick={() => {
                const p = parseFloat(poids);
                if (isNaN(p)) { s.dire("Il manque le poids"); return; }
                s.majJour(s.today, { poids: p });
                s.dire("Pesée enregistrée");
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------- jour d'injection */}
      {estInjection && (
        <div className="sec">
          <h2>Jour d'injection</h2>
          <div className="panel">
            <div className="grid2">
              <div>
                <label className="fld" htmlFor="fdose">Dose (mg)</label>
                <input id="fdose" type="number" step="0.5" inputMode="decimal" value={dose}
                  onChange={(e) => setDose(e.target.value)} />
              </div>
              <div>
                <label className="fld" htmlFor="fsite">Site</label>
                <select id="fsite" value={site} onChange={(e) => setSite(e.target.value)}>
                  <option>Abdomen</option>
                  <option>Cuisse</option>
                  <option>Bras</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                className="btn"
                onClick={() => {
                  s.majJour(s.today, { dose: parseFloat(dose) || cfg.doseActuelle, site });
                  s.dire("Injection notée");
                }}
              >
                Marquer l'injection faite
              </button>
            </div>
            <div className="num-sub" style={{ marginTop: 10 }}>
              Prochaines 48 h : petites portions, faible en gras, mange lentement. Les plats
              marqués « jour creux » sont là pour ça.
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- eau */}
      <div className="sec">
        <h2>Eau</h2>
        <div className="panel">
          <div className="num-sub" style={{ marginTop: 0 }}>
            {d.eau} verres de 400 ml sur {cfg.cibleEau}. La soif est émoussée — bois sur horaire.
          </div>
          <div className="dots">
            {Array.from({ length: cfg.cibleEau }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={"dot" + (d.eau >= n ? " on" : "")}
                aria-label={"Verre " + n}
                aria-pressed={d.eau >= n}
                onClick={() => s.majJour(s.today, (j) => ({ eau: j.eau === n ? n - 1 : n }))}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- suppléments */}
      <div className="sec">
        <h2>Le stack</h2>
        <div className="panel">
          <div className="checks">
            {SUPPS.map((sup) => {
              const on = d.supps.indexOf(sup.id) >= 0;
              return (
                <button
                  key={sup.id}
                  className={"ck" + (on ? " on" : "")}
                  aria-pressed={on}
                  onClick={() =>
                    s.majJour(s.today, (j) => ({
                      supps: on ? j.supps.filter((x) => x !== sup.id) : [...j.supps, sup.id],
                    }))
                  }
                >
                  <span className="box" />
                  <span>
                    {sup.n}
                    <br />
                    <span className="why">{sup.w}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- entraînement */}
      <div className="sec">
        <h2>Entraînement</h2>
        <div className="panel">
          <div className="chips">
            {GYMS.map((g) => (
              <button
                key={g}
                className={"chip" + (d.gym === g ? " on" : "")}
                aria-pressed={d.gym === g}
                onClick={() => s.majJour(s.today, (j) => ({ gym: j.gym === g ? null : g }))}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- effets */}
      <div className="sec">
        <h2>Comment tu te sens</h2>
        <div className="panel">
          <div className="chips">
            {EFFETS.concat(ROUGES).map((e) => {
              const on = d.effets.indexOf(e) >= 0;
              const warn = ROUGES.indexOf(e) >= 0 ? " warn" : "";
              return (
                <button
                  key={e}
                  className={"chip" + warn + (on ? " on" : "")}
                  aria-pressed={on}
                  onClick={() =>
                    s.majJour(s.today, (j) => ({
                      effets: on ? j.effets.filter((x) => x !== e) : [...j.effets, e],
                    }))
                  }
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
