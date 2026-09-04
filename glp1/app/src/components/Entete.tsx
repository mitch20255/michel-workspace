import type { Config, Log } from "../types";
import { JCOURT, addDays, daysBetween, iso, libelleLong } from "../lib/dates";

export function Entete({ cfg, log, today }: { cfg: Config; log: Log; today: string }) {
  const now = new Date();
  const debutSemaine = addDays(now, -now.getDay());
  const j = daysBetween(cfg.depart, today);
  const meta =
    j < 0
      ? `Départ dans ${-j} jour${-j > 1 ? "s" : ""}`
      : `Jour ${j + 1} · ${cfg.doseActuelle} mg`;

  return (
    <div className="top">
      <div className="top-line">
        <div className="top-day">{libelleLong(now)}</div>
        <div className="top-meta">{meta}</div>
      </div>
      <div className="week">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(debutSemaine, i);
          const k = iso(d);
          const entree = log[k];
          const rempli = !!entree && (!!entree.poids || entree.prot > 0);
          const cls = "wk" + (rempli ? " filled" : "") + (k === today ? " today" : "");
          return (
            <div key={k} className={cls}>
              {i === cfg.jourInjection && <span className="pen" />}
              <div className="wk-d">{JCOURT[i]}</div>
              <div className="wk-n">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
