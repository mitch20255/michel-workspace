import type { Store } from "../store";
import type { Point } from "../lib/analyse";
import { analyse, ma, poidsSerie } from "../lib/analyse";
import { addDays, iso, parseISO } from "../lib/dates";

export function Semaine({ s }: { s: Store }) {
  const cfg = s.cfg!;
  const verdicts = analyse(s.log, cfg);
  const serie = poidsSerie(s.log);

  return (
    <>
      <div className="sec">
        <h2>Ce que les chiffres disent</h2>
        {verdicts.map((v, i) => (
          <div key={i} className={"verdict " + v.t}>
            <h3>{v.h}</h3>
            <p>{v.p}</p>
          </div>
        ))}
      </div>

      <div className="sec">
        <h2>Courbe de poids</h2>
        <div className="panel">
          {serie.length < 2 ? (
            <div className="muted">La courbe apparaît après deux pesées. Une seule donnée ne raconte rien.</div>
          ) : (
            <>
              <Courbe serie={serie} />
              <div className="legend">
                Trait plein : moyenne sur 7 jours. Points : pesées. Total perdu :{" "}
                {(cfg.poidsDepart - serie[serie.length - 1].v).toFixed(1)} {cfg.unite}.
              </div>
            </>
          )}
        </div>
      </div>

      <div className="sec">
        <h2>Les 14 derniers jours</h2>
        <div className="panel">
          <table className="meas">
            <thead>
              <tr><th>Jour</th><th>Poids</th><th>Prot</th><th>Gym</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: 14 }, (_, i) => iso(addDays(new Date(), -i)))
                .filter((k) => s.log[k])
                .map((k) => {
                  const l = s.log[k];
                  return (
                    <tr key={k}>
                      <td>{k.slice(5)}</td>
                      <td>{l.poids || "—"}</td>
                      <td>{l.prot || "—"}</td>
                      <td>{l.gym ? "✓" : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function Courbe({ serie }: { serie: Point[] }) {
  const W = 320, H = 150, pad = 22;
  const vals = serie.map((x) => x.v);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const d0 = parseISO(serie[0].d).getTime();
  const dN = parseISO(serie[serie.length - 1].d).getTime();
  const span = Math.max(1, (dN - d0) / 86400000);
  const X = (d: string) => pad + ((parseISO(d).getTime() - d0) / 86400000 / span) * (W - pad - 6);
  const Y = (v: number) => 10 + (1 - (v - min) / (max - min || 1)) * (H - 30);

  const maPts = serie
    .map((x) => {
      const m = ma(serie, x.d, 7);
      return `${X(x.d).toFixed(1)},${Y(m ? m.v : x.v).toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Courbe de poids">
      <line x1={pad} y1={H - 18} x2={W - 6} y2={H - 18} stroke="#D6D6CE" />
      <polyline points={maPts} fill="none" stroke="#2743C4" strokeWidth="2" strokeLinejoin="round" />
      {serie.map((x) => (
        <circle key={x.d} cx={X(x.d).toFixed(1)} cy={Y(x.v).toFixed(1)} r="2.5" fill="#8A929B" />
      ))}
      <text x="2" y="14" fontSize="9" fill="#8A929B">{max.toFixed(0)}</text>
      <text x="2" y={H - 22} fontSize="9" fill="#8A929B">{min.toFixed(0)}</text>
    </svg>
  );
}
