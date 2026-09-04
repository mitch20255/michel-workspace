import { useRef, useState } from "react";
import type { Store } from "../store";
import type { Log } from "../types";
import { JOUR_VIDE } from "../lib/analyse";
import { exporterJSON, exporterObsidian, lireSauvegarde } from "../lib/exports";
import type { Apercu } from "../lib/mfp";
import { lireFichierMFP } from "../lib/mfp";

export function Sauvegarde({ s }: { s: Store }) {
  const champJSON = useRef<HTMLInputElement | null>(null);
  const champMFP = useRef<HTMLInputElement | null>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [ecraser, setEcraser] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function importerJSON(f: File) {
    setErreur(null);
    try {
      const d = lireSauvegarde(await f.text());
      const jours = Object.keys(d.log).length;
      if (!confirm(`Cette sauvegarde contient ${jours} journée${jours > 1 ? "s" : ""}. Elle remplace ce qui est dans l'app. Continuer ?`)) return;
      s.remplacerTout(d);
      s.dire("Sauvegarde restaurée");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Fichier illisible.");
    }
  }

  async function ouvrirMFP(f: File) {
    setErreur(null);
    setApercu(null);
    try {
      setApercu(await lireFichierMFP(f));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Fichier illisible.");
    }
  }

  function appliquerMFP() {
    if (!apercu) return;
    const suivant: Log = { ...s.log };
    let ecrits = 0;
    let sautes = 0;
    for (const j of apercu.jours) {
      const existant = suivant[j.date];
      if (existant?.totalManuel && !ecraser) { sautes++; continue; }
      suivant[j.date] = {
        ...(existant ?? JOUR_VIDE),
        prot: j.prot,
        kcal: j.kcal,
        totalManuel: false,
        source: "mfp",
      };
      ecrits++;
    }
    s.majLog(suivant);
    setApercu(null);
    s.dire(`${ecrits} journée${ecrits > 1 ? "s" : ""} importée${ecrits > 1 ? "s" : ""}${sautes ? `, ${sautes} gardée${sautes > 1 ? "s" : ""} telle${sautes > 1 ? "s" : ""} quelle${sautes > 1 ? "s" : ""}` : ""}`);
  }

  const conflits = apercu
    ? apercu.jours.filter((j) => s.log[j.date]?.totalManuel).length
    : 0;

  return (
    <>
      <div className="sec">
        <h2>Sauvegarde et export</h2>
        <div className="panel">
          <div className="muted" style={{ marginBottom: 12 }}>
            Le JSON est ton filet de sécurité : il contient tout et il se réimporte ici. Fais-en un
            par mois et mets-le où tu veux — dans ton Drive, dans un courriel à toi-même.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn"
              onClick={() => {
                exporterJSON(s.cfg!, s.log, s.plats, s.mesures);
                s.dire("Sauvegarde téléchargée");
              }}
            >
              Exporter en JSON
            </button>
            <button className="btn ghost" onClick={() => champJSON.current?.click()}>
              Importer une sauvegarde
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                try {
                  const n = exporterObsidian(s.log, s.cfg!);
                  s.dire(`${n} note${n > 1 ? "s" : ""} pour Obsidian`);
                } catch (e) {
                  setErreur(e instanceof Error ? e.message : "Export impossible.");
                }
              }}
            >
              Exporter pour Obsidian
            </button>
          </div>
          <input
            ref={champJSON}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importerJSON(f);
              e.target.value = "";
            }}
          />
          <div className="num-sub">
            L'export Obsidian donne un .zip : une note par semaine, avec le tableau des jours, la
            courbe et les verdicts. Décompresse-le dans ton coffre.
          </div>
        </div>
      </div>

      <div className="sec">
        <h2>Importer de MyFitnessPal</h2>
        <div className="panel">
          <div className="muted" style={{ marginBottom: 12 }}>
            Pour rattraper les journées où tu n'as pas recopié tes totaux. Deux fichiers possibles :
            l'export CSV en un clic (réservé au Premium) ou la demande « Download My Data », gratuite,
            qui t'arrive par courriel en .zip. Dépose l'un ou l'autre — le fichier ne part nulle part,
            il est lu ici même.
          </div>
          <button className="btn" onClick={() => champMFP.current?.click()}>
            Choisir le fichier
          </button>
          <input
            ref={champMFP}
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ouvrirMFP(f);
              e.target.value = "";
            }}
          />
        </div>

        {apercu && (
          <div className="panel">
            <div className="meal-n">Ce que l'app a compris</div>
            <div className="meal-m" style={{ marginBottom: 10 }}>
              {apercu.fichier} · colonnes « {apercu.colonnes.date} », « {apercu.colonnes.prot} », «{" "}
              {apercu.colonnes.kcal} » · {apercu.jours.length} journée
              {apercu.jours.length > 1 ? "s" : ""}
              {apercu.ignorees ? ` · ${apercu.ignorees} ligne(s) sans date, ignorées` : ""}
            </div>

            {apercu.avertissement && (
              <div className="note-ochre" style={{ marginBottom: 10 }}>{apercu.avertissement}</div>
            )}

            <table className="meas">
              <thead>
                <tr><th>Jour</th><th>Prot</th><th>Kcal</th><th>Lignes</th><th>Dans l'app</th></tr>
              </thead>
              <tbody>
                {apercu.jours.map((j) => {
                  const existant = s.log[j.date];
                  return (
                    <tr key={j.date}>
                      <td>{j.date.slice(5)}</td>
                      <td>{j.prot}</td>
                      <td>{j.kcal}</td>
                      <td>{j.lignes}</td>
                      <td>{existant?.totalManuel ? "saisie manuelle" : existant?.prot ? String(existant.prot) + " g" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {conflits > 0 && (
              <label className="ck" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={ecraser}
                  onChange={(e) => setEcraser(e.target.checked)}
                  style={{ width: "auto" }}
                />
                <span>
                  Écraser aussi les {conflits} journée{conflits > 1 ? "s" : ""} que tu as saisie
                  {conflits > 1 ? "s" : ""} à la main
                </span>
              </label>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={appliquerMFP}>Importer ces journées</button>
              <button className="btn ghost" onClick={() => setApercu(null)}>Annuler</button>
            </div>
          </div>
        )}
      </div>

      {erreur && <div className="err">{erreur}</div>}
    </>
  );
}
