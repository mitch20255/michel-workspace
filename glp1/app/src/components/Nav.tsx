import type { Onglet } from "../types";

const ONGLETS: [Onglet, string, string][] = [
  ["jour", "Aujourd'hui", "◉"],
  ["semaine", "Semaine", "◐"],
  ["plats", "Plats", "▤"],
  ["protocole", "Protocole", "§"],
  ["suivi", "Suivi", "◈"],
];

export function Nav({ actif, choisir }: { actif: Onglet; choisir: (o: Onglet) => void }) {
  return (
    <nav className="nav">
      {ONGLETS.map(([id, libelle, glyphe]) => (
        <button
          key={id}
          className={actif === id ? "on" : ""}
          aria-current={actif === id ? "page" : undefined}
          onClick={() => choisir(id)}
        >
          <span className="gl" aria-hidden="true">{glyphe}</span>
          {libelle}
        </button>
      ))}
    </nav>
  );
}
