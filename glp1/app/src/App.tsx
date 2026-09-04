import { useEffect, useState } from "react";
import type { Onglet } from "./types";
import { useStore } from "./store";
import { Entete } from "./components/Entete";
import { Nav } from "./components/Nav";
import { Alertes } from "./components/Rappels";
import { Jour } from "./onglets/Jour";
import { Semaine } from "./onglets/Semaine";
import { Plats } from "./onglets/Plats";
import { Protocole } from "./onglets/Protocole";
import { Suivi } from "./onglets/Suivi";

export default function App() {
  const s = useStore();
  const [onglet, setOnglet] = useState<Onglet>("jour");

  // L'onglet ouvert survit à une fermeture de l'app.
  useEffect(() => {
    const garde = sessionStorage.getItem("glp1:onglet") as Onglet | null;
    if (garde) setOnglet(garde);
  }, []);

  function changer(o: Onglet) {
    setOnglet(o);
    sessionStorage.setItem("glp1:onglet", o);
    window.scrollTo(0, 0);
  }

  if (!s.pret || !s.cfg) return <div className="boot">Chargement de tes données…</div>;

  return (
    <>
      <Entete cfg={s.cfg} log={s.log} today={s.today} />

      {!s.ecritureOK && (
        <div className="err">
          Tes données n'ont pas pu être enregistrées. Note tes chiffres ailleurs pour aujourd'hui.
        </div>
      )}

      {onglet === "jour" && <Alertes s={s} />}
      {onglet === "jour" && <Jour s={s} />}
      {onglet === "semaine" && <Semaine s={s} />}
      {onglet === "plats" && <Plats s={s} />}
      {onglet === "protocole" && <Protocole s={s} />}
      {onglet === "suivi" && <Suivi s={s} />}

      <Nav actif={onglet} choisir={changer} />
      {s.toast && <div className="toast">{s.toast}</div>}
    </>
  );
}
