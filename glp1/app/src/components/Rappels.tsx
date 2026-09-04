import type { Store } from "../store";
import { exporterICS } from "../lib/exports";

/**
 * Pourquoi il n'y a pas de vraies notifications planifiées ici : voir le texte
 * ci-dessous. Le calendrier est le seul chemin fiable, alors c'est celui qu'on prend.
 */
export function Rappels({ s }: { s: Store }) {
  return (
    <div className="sec">
      <h2>Rappels</h2>
      <div className="panel">
        <div className="muted" style={{ marginBottom: 12 }}>
          Franchement : une app web installée sur Android ne peut pas déclencher une notification à
          une heure précise si elle est fermée. L'API qui servirait à ça (<i>periodicSync</i>) ne
          garantit aucun horaire, le système la coupe pour économiser la pile, et celle qui
          permettrait de programmer une alerte à l'avance n'a jamais été livrée par les navigateurs.
          Bricoler là-dessus te donnerait des rappels qui arrivent parfois, ce qui est pire que pas
          de rappel du tout.
        </div>
        <div className="note-cobalt" style={{ marginBottom: 12 }}>
          Le chemin fiable : ton calendrier. Télécharge le fichier et importe-le dans Google Agenda —
          les quatre récurrences sont dedans, avec leurs alarmes.
        </div>
        <button
          className="btn"
          onClick={() => {
            exporterICS(s.cfg!);
            s.dire("Fichier de rappels téléchargé");
          }}
        >
          Télécharger les rappels (.ics)
        </button>
        <div className="num-sub">
          Injection {jourNom(s.cfg!.jourInjection)} 20 h · pesée tous les matins 7 h · point
          protéines 16 h · revue de la semaine le dimanche 19 h. L'app, elle, t'affiche ces rappels
          quand tu l'ouvres.
        </div>
      </div>
    </div>
  );
}

function jourNom(i: number) {
  return ["le dimanche", "le lundi", "le mardi", "le mercredi", "le jeudi", "le vendredi", "le samedi"][i];
}

/** Ce que l'app peut faire de façon fiable : te le dire quand tu l'ouvres. */
export function Alertes({ s }: { s: Store }) {
  const cfg = s.cfg!;
  const d = s.jourCourant;
  const maintenant = new Date();
  const heure = maintenant.getHours();
  const messages: string[] = [];

  if (maintenant.getDay() === cfg.jourInjection && d.dose === null) {
    messages.push(`C'est le jour de l'injection. ${cfg.doseActuelle} mg — note-la une fois faite.`);
  }
  if (heure >= 9 && d.poids === null) {
    messages.push("Pas de pesée aujourd'hui. Si tu l'as sautée, ce n'est pas grave — deux par semaine suffisent.");
  }
  if (heure >= 16 && cfg.cibleProt - d.prot > 60) {
    messages.push(`Il te reste ${cfg.cibleProt - d.prot} g de protéines et la journée avance. C'est le moment d'une ancre sans cuisson.`);
  }

  if (!messages.length) return null;

  return (
    <div className="sec">
      {messages.map((m, i) => (
        <div key={i} className="verdict info">
          <p>{m}</p>
        </div>
      ))}
    </div>
  );
}
