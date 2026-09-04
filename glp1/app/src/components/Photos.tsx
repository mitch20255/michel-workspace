import { useEffect, useMemo, useRef, useState } from "react";
import type { Store } from "../store";

/** Les photos restent dans IndexedDB, sur l'appareil. Rien n'est envoyé nulle part. */
export function Photos({ s }: { s: Store }) {
  const champ = useRef<HTMLInputElement | null>(null);
  const [avant, setAvant] = useState("");
  const [apres, setApres] = useState("");

  const triees = useMemo(
    () => [...s.photos].sort((a, b) => a.date.localeCompare(b.date)),
    [s.photos],
  );

  // Une URL par photo, révoquée dès que la liste change : sinon la mémoire fuit.
  const urls = useMemo(() => {
    const m = new Map<string, string>();
    triees.forEach((p) => m.set(p.id, URL.createObjectURL(p.blob)));
    return m;
  }, [triees]);

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  useEffect(() => {
    if (triees.length && !avant) setAvant(triees[0].id);
    if (triees.length && !apres) setApres(triees[triees.length - 1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triees.length]);

  async function ajouter(fichier: File) {
    const poids = s.log[s.today]?.poids ?? null;
    s.majPhotos([
      ...s.photos,
      { id: "ph" + Date.now(), date: s.today, blob: fichier, poids },
    ]);
    s.dire("Photo enregistrée sur l'appareil");
  }

  const pAvant = triees.find((p) => p.id === avant);
  const pApres = triees.find((p) => p.id === apres);

  return (
    <div className="sec">
      <h2>Photos de progression</h2>
      <div className="panel">
        <div className="muted" style={{ marginBottom: 12 }}>
          Une photo par mois, même endroit, même lumière. C'est la mesure qui te convaincra les
          semaines où la balance ment. Elles restent sur ton téléphone.
        </div>
        <input
          ref={champ}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void ajouter(f);
            e.target.value = "";
          }}
        />
        <button className="btn" onClick={() => champ.current?.click()}>Prendre une photo</button>
      </div>

      {triees.length >= 2 && (
        <div className="panel">
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div>
              <label className="fld" htmlFor="pav">Avant</label>
              <select id="pav" value={avant} onChange={(e) => setAvant(e.target.value)}>
                {triees.map((p) => <option key={p.id} value={p.id}>{p.date}</option>)}
              </select>
            </div>
            <div>
              <label className="fld" htmlFor="pap">Après</label>
              <select id="pap" value={apres} onChange={(e) => setApres(e.target.value)}>
                {triees.map((p) => <option key={p.id} value={p.id}>{p.date}</option>)}
              </select>
            </div>
          </div>
          <div className="photo-grid">
            {[pAvant, pApres].map((p, i) =>
              p ? (
                <figure key={p.id + i}>
                  <img src={urls.get(p.id)} alt={"Photo du " + p.date} />
                  <figcaption>
                    {p.date}
                    {p.poids ? ` · ${p.poids} ${s.cfg!.unite}` : ""}
                  </figcaption>
                </figure>
              ) : null,
            )}
          </div>
          {pAvant && pApres && pAvant.poids && pApres.poids && (
            <div className="legend">
              Écart entre les deux : {(pAvant.poids - pApres.poids).toFixed(1)} {s.cfg!.unite}.
            </div>
          )}
        </div>
      )}

      {triees.length > 0 && (
        <div className="panel">
          <table className="meas">
            <thead>
              <tr><th>Date</th><th>Poids</th><th></th></tr>
            </thead>
            <tbody>
              {[...triees].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{p.poids ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn ghost small"
                      onClick={() => {
                        s.majPhotos(s.photos.filter((x) => x.id !== p.id));
                        s.dire("Photo supprimée");
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
