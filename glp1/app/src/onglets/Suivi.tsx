import { useEffect, useState } from "react";
import type { Store } from "../store";
import { Photos } from "../components/Photos";
import { Rappels } from "../components/Rappels";
import { Sauvegarde } from "../components/Sauvegarde";

export function Suivi({ s }: { s: Store }) {
  const [m, setM] = useState({ taille: "", cou: "", bras: "", poitrine: "" });
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote(s.jourCourant.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pret]);

  const notes = Object.keys(s.log).filter((k) => s.log[k].note).sort().reverse();

  return (
    <>
      <div className="sec">
        <h2>Mesures</h2>
        <div className="panel">
          <div className="muted" style={{ marginBottom: 12 }}>
            Le tour de taille bouge quand la balance boude. Prends-les une fois par mois, le matin.
          </div>
          <div className="grid2">
            <Champ id="mtaille" nom="Taille (po)" v={m.taille} set={(v) => setM({ ...m, taille: v })} />
            <Champ id="mcou" nom="Cou (po)" v={m.cou} set={(v) => setM({ ...m, cou: v })} />
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <Champ id="mbras" nom="Bras (po)" v={m.bras} set={(v) => setM({ ...m, bras: v })} />
            <Champ id="mpoit" nom="Poitrine (po)" v={m.poitrine} set={(v) => setM({ ...m, poitrine: v })} />
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              className="btn"
              onClick={() => {
                if (!m.taille && !m.cou && !m.bras && !m.poitrine) { s.dire("Il manque une mesure"); return; }
                s.majMesures([...s.mesures, { date: s.today, ...m }]);
                setM({ taille: "", cou: "", bras: "", poitrine: "" });
                s.dire("Mesures enregistrées");
              }}
            >
              Enregistrer les mesures
            </button>
          </div>
        </div>

        {s.mesures.length > 0 && (
          <div className="panel">
            <table className="meas">
              <thead>
                <tr><th>Date</th><th>Taille</th><th>Cou</th><th>Bras</th><th>Poitrine</th></tr>
              </thead>
              <tbody>
                {[...s.mesures].reverse().map((x, i) => (
                  <tr key={x.date + i}>
                    <td>{x.date.slice(5)}</td>
                    <td>{x.taille || "—"}</td>
                    <td>{x.cou || "—"}</td>
                    <td>{x.bras || "—"}</td>
                    <td>{x.poitrine || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sec">
        <h2>Journal du jour</h2>
        <div className="panel">
          <textarea
            id="jnote"
            placeholder="Ce que tu veux que le toi du mois prochain sache. Une observation, une victoire, un truc qui a marché."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <button
              className="btn"
              onClick={() => { s.majJour(s.today, { note }); s.dire("Journal enregistré"); }}
            >
              Enregistrer
            </button>
          </div>
        </div>

        {notes.length > 0 && (
          <>
            <h2 style={{ marginTop: 20 }}>Entrées précédentes</h2>
            {notes.slice(0, 20).map((k) => (
              <div className="panel" key={k}>
                <div className="meal-m" style={{ marginBottom: 6 }}>{k}</div>
                <div className="muted">{s.log[k].note}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <Photos s={s} />
      <Rappels s={s} />
      <Sauvegarde s={s} />
    </>
  );
}

function Champ({ id, nom, v, set }: { id: string; nom: string; v: string; set: (v: string) => void }) {
  return (
    <div>
      <label className="fld" htmlFor={id}>{nom}</label>
      <input id={id} type="number" step="0.25" inputMode="decimal" value={v}
        onChange={(e) => set(e.target.value)} />
    </div>
  );
}
