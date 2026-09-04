import { useState } from "react";
import type { Plat } from "../types";
import type { Store } from "../store";

export function Plats({ s }: { s: Store }) {
  const [nom, setNom] = useState("");
  const [prot, setProt] = useState("");
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState("");

  function manger(p: Plat) {
    s.majJour(s.today, (j) => ({
      prot: j.prot + p.p,
      kcal: j.kcal + p.k,
      source: j.source ?? "plats",
    }));
    s.dire(`+${p.p} g de protéines`);
  }

  function ajouterPlat() {
    const n = nom.trim();
    if (!n) { s.dire("Il manque le nom du plat"); return; }
    s.majPlats([
      ...s.plats,
      { id: "p" + Date.now(), n, p: +prot || 0, l: 0, g: 0, k: +kcal || 0, note, nausee: false },
    ]);
    setNom(""); setProt(""); setKcal(""); setNote("");
    s.dire("Plat ajouté");
  }

  const soupers = s.plats.filter((p) => p.id[0] === "p");
  const ancres = s.plats.filter((p) => p.id[0] === "a");

  return (
    <>
      <div className="sec">
        <h2>Soupers — un seul chaudron</h2>
        {soupers.map((p) => <Carte key={p.id} p={p} manger={manger} />)}
      </div>

      <div className="sec">
        <h2>Ancres sans cuisson</h2>
        <div className="muted" style={{ marginBottom: 10 }}>
          Le trou à protéines n'est jamais au souper. Il est entre 14 h et 17 h.
        </div>
        {ancres.map((p) => <Carte key={p.id} p={p} manger={manger} />)}
      </div>

      <div className="sec">
        <h2>Ajouter un plat</h2>
        <div className="panel">
          <label className="fld" htmlFor="mn">Nom</label>
          <input id="mn" type="text" placeholder="Ce que tu as cuisiné" value={nom}
            onChange={(e) => setNom(e.target.value)} />
          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label className="fld" htmlFor="mp">Protéines (g)</label>
              <input id="mp" type="number" inputMode="numeric" value={prot}
                onChange={(e) => setProt(e.target.value)} />
            </div>
            <div>
              <label className="fld" htmlFor="mk">Calories</label>
              <input id="mk" type="number" inputMode="numeric" value={kcal}
                onChange={(e) => setKcal(e.target.value)} />
            </div>
          </div>
          <label className="fld" style={{ marginTop: 10 }} htmlFor="mnote">Comment tu le fais</label>
          <textarea id="mnote" placeholder="La recette en deux phrases, pour le toi de mardi soir."
            value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={ajouterPlat}>Ajouter à la rotation</button>
          </div>
        </div>
      </div>
    </>
  );
}

function Carte({ p, manger }: { p: Plat; manger: (p: Plat) => void }) {
  return (
    <div className="meal">
      <div className="meal-h">
        <div>
          <div className="meal-n">
            {p.n}
            {p.nausee && <span className="tag">jour creux</span>}
          </div>
          <div className="meal-m">
            {p.p} g protéines · {p.k} kcal · {p.l} g lipides · {p.g} g glucides
          </div>
        </div>
        <button className="btn ghost small" onClick={() => manger(p)}>Mangé</button>
      </div>
      <div className="meal-b">{p.note}</div>
    </div>
  );
}
