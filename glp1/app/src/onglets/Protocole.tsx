import { useEffect, useState } from "react";
import type { Store } from "../store";
import { JOURS } from "../lib/dates";

export function Protocole({ s }: { s: Store }) {
  const cfg = s.cfg!;
  const [f, setF] = useState({
    cibleProt: "", cibleKcal: "", doseActuelle: "", doseDepuis: "",
    poidsDepart: "", cibleGym: "", depart: "", jourInjection: "0",
  });

  useEffect(() => {
    setF({
      cibleProt: String(cfg.cibleProt),
      cibleKcal: String(cfg.cibleKcal),
      doseActuelle: String(cfg.doseActuelle),
      doseDepuis: cfg.doseDepuis,
      poidsDepart: String(cfg.poidsDepart),
      cibleGym: String(cfg.cibleGym),
      depart: cfg.depart,
      jourInjection: String(cfg.jourInjection),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pret]);

  function enregistrer() {
    const jourInj = parseInt(f.jourInjection, 10);
    s.majCfg({
      cibleProt: +f.cibleProt || cfg.cibleProt,
      cibleKcal: +f.cibleKcal || cfg.cibleKcal,
      doseActuelle: +f.doseActuelle || cfg.doseActuelle,
      doseDepuis: f.doseDepuis || cfg.doseDepuis,
      poidsDepart: +f.poidsDepart || cfg.poidsDepart,
      cibleGym: +f.cibleGym || cfg.cibleGym,
      depart: f.depart || cfg.depart,
      jourInjection: isNaN(jourInj) ? cfg.jourInjection : jourInj,
    });
    s.dire("Réglages enregistrés");
  }

  const champ = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value }),
  });

  return (
    <>
      <div className="sec">
        <h2>Pourquoi le protocole est ce qu'il est</h2>
        <div className="panel doc">
          <h3>Le seul paramètre qui décide de tout</h3>
          <p>
            Environ un quart du poids perdu sous tirzepatide est de la masse maigre. C'est une
            proportion normale — mais en valeur absolue, elle explose quand la perte est rapide. Ton
            objectif n'est pas de perdre vite. C'est d'arriver en bas avec le maximum de muscle
            intact, parce que ce que tu ne perds pas, tu n'auras pas à le rebâtir.
          </p>
          <div className="rule">Cible : 0,5 à 1 % du poids par semaine. Au-dessus, tu paies en muscle.</div>

          <h3>La dose n'est pas un escalier</h3>
          <p>
            L'erreur classique est de titrer par réflexe de calendrier. Si tu perds au rythme voulu à
            ta dose actuelle, tu n'as aucune raison de monter : tu achèterais des effets secondaires
            sans bénéfice. Tu montes quand la perte stagne trois ou quatre semaines de suite malgré
            des protéines et un déficit réels.
          </p>

          <h3>Protéines : quatre prises, pas une</h3>
          <p>
            Le seuil de leucine doit être franchi à chaque repas pour déclencher la synthèse
            protéique. Quatre prises de 45 g valent mieux qu'une seule de 180 g. Et sous GLP-1, la
            satiété arrive brutalement : mange la protéine avant tout le reste de l'assiette.
          </p>
          <p>
            Les jours où le solide ne passe pas, le liquide passe. Cinquante grammes de protéine en
            shake valent infiniment mieux que zéro gramme de poulet.
          </p>

          <h3>La charge mécanique, ou rien</h3>
          <p>
            Trois séances full-body par semaine, séries menées à une à trois répétitions de l'échec,
            dix séries par groupe musculaire. Les charges qui tiennent ou montent pendant que le
            poids descend : c'est la seule preuve en temps réel que tu perds du gras et pas autre
            chose.
          </p>
          <div className="rule">
            Si tes charges chutent deux semaines de suite, tu descends trop vite. Remonte les calories.
          </div>

          <h3>Électrolytes</h3>
          <p>
            Quand l'apport alimentaire s'effondre, le sodium s'effondre avec. Vise 4 à 5 g de sodium,
            3500 à 4700 mg de potassium par l'alimentation, 300 à 400 mg de magnésium — en citrate,
            parce que la constipation sera ton irritant numéro un.
          </p>

          <h3>Le visage</h3>
          <p>
            Ce n'est pas un effet du médicament, c'est de la graisse sous-cutanée qui part vite d'une
            peau qui n'a pas le temps de se rétracter. Ce que tu contrôles : la vitesse, encore. Ne
            pas descendre plus bas que nécessaire. Dormir. Développer le cou et les trapèzes, qui
            changent réellement l'allure d'un visage.
          </p>

          <h3>Ce qui n'attend pas</h3>
          <ul>
            <li>Douleur abdominale sévère irradiant au dos — pancréatite, urgence.</li>
            <li>Douleur sous les côtes à droite après un repas gras — calculs biliaires, fréquents en perte rapide.</li>
            <li>Vomissements qui ne passent pas, faiblesse, étourdissements persistants.</li>
            <li>Chute de cheveux vers le troisième mois : généralement transitoire, mais c'est souvent le signal que les protéines ou les calories sont trop basses.</li>
          </ul>
          <p>
            Rien ici ne remplace ton prescripteur. Cet outil sert à lui arriver avec des données au
            lieu d'impressions.
          </p>
        </div>
      </div>

      <div className="sec">
        <h2>Réglages</h2>
        <div className="panel">
          <div className="grid2">
            <div>
              <label className="fld" htmlFor="cprot">Cible protéines (g)</label>
              <input id="cprot" type="number" {...champ("cibleProt")} />
            </div>
            <div>
              <label className="fld" htmlFor="ckcal">Cible calories</label>
              <input id="ckcal" type="number" {...champ("cibleKcal")} />
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label className="fld" htmlFor="cdose">Dose actuelle (mg)</label>
              <input id="cdose" type="number" step="0.5" {...champ("doseActuelle")} />
            </div>
            <div>
              <label className="fld" htmlFor="cdepuis">Cette dose depuis</label>
              <input id="cdepuis" type="date" {...champ("doseDepuis")} />
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label className="fld" htmlFor="cpoids">Poids de départ</label>
              <input id="cpoids" type="number" step="0.1" {...champ("poidsDepart")} />
            </div>
            <div>
              <label className="fld" htmlFor="cgym">Séances/semaine</label>
              <input id="cgym" type="number" {...champ("cibleGym")} />
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label className="fld" htmlFor="cdepart">Première injection</label>
              <input id="cdepart" type="date" {...champ("depart")} />
            </div>
            <div>
              <label className="fld" htmlFor="cjour">Jour d'injection</label>
              <select id="cjour" {...champ("jourInjection")}>
                {JOURS.map((j, i) => (
                  <option key={i} value={i}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={enregistrer}>Enregistrer les réglages</button>
          </div>
        </div>
      </div>
    </>
  );
}
