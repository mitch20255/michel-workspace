import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Config, DayLog, Log, Mesure, Photo, Plat } from "./types";
import { JOUR_VIDE } from "./lib/analyse";
import {
  chargerConfig, chargerLog, chargerMesures, chargerPhotos, chargerPlats,
  sauverConfig, sauverLog, sauverMesures, sauverPhotos, sauverPlats, stockageOK,
} from "./lib/storage";
import { aujourdhui } from "./lib/dates";

export type Store = ReturnType<typeof useStore>;

export function useStore() {
  const [pret, setPret] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [log, setLog] = useState<Log>({});
  const [plats, setPlats] = useState<Plat[]>([]);
  const [mesures, setMesures] = useState<Mesure[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [ecritureOK, setEcritureOK] = useState(true);
  const minuterie = useRef<number | undefined>(undefined);

  useEffect(() => {
    Promise.all([chargerConfig(), chargerLog(), chargerPlats(), chargerMesures(), chargerPhotos()]).then(
      ([c, l, p, m, ph]) => {
        setCfg(c);
        setLog(l);
        setPlats(p);
        setMesures(m);
        setPhotos(ph);
        setPret(true);
      },
    );
  }, []);

  const dire = useCallback((t: string) => {
    setToast(t);
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const apresEcriture = useCallback(() => setEcritureOK(stockageOK()), []);

  const majLog = useCallback(
    (suivant: Log) => {
      setLog(suivant);
      sauverLog(suivant).then(apresEcriture);
    },
    [apresEcriture],
  );

  /** Modifie une journée. Le journal n'est jamais muté sur place. */
  const majJour = useCallback(
    (date: string, patch: Partial<DayLog> | ((j: DayLog) => Partial<DayLog>)) => {
      setLog((precedent) => {
        const actuel = precedent[date] ?? JOUR_VIDE;
        const morceau = typeof patch === "function" ? patch(actuel) : patch;
        const suivant = { ...precedent, [date]: { ...actuel, ...morceau } };
        sauverLog(suivant).then(apresEcriture);
        return suivant;
      });
    },
    [apresEcriture],
  );

  const majCfg = useCallback(
    (patch: Partial<Config>) => {
      setCfg((precedent) => {
        const suivant = { ...(precedent as Config), ...patch };
        sauverConfig(suivant).then(apresEcriture);
        return suivant;
      });
    },
    [apresEcriture],
  );

  const majPlats = useCallback(
    (suivant: Plat[]) => {
      setPlats(suivant);
      sauverPlats(suivant).then(apresEcriture);
    },
    [apresEcriture],
  );

  const majMesures = useCallback(
    (suivant: Mesure[]) => {
      setMesures(suivant);
      sauverMesures(suivant).then(apresEcriture);
    },
    [apresEcriture],
  );

  const majPhotos = useCallback(
    (suivant: Photo[]) => {
      setPhotos(suivant);
      sauverPhotos(suivant).then(apresEcriture);
    },
    [apresEcriture],
  );

  const remplacerTout = useCallback(
    (d: { config?: Config; log?: Log; plats?: Plat[]; mesures?: Mesure[] }) => {
      if (d.config) majCfg(d.config);
      if (d.log) majLog(d.log);
      if (d.plats) majPlats(d.plats);
      if (d.mesures) majMesures(d.mesures);
    },
    [majCfg, majLog, majPlats, majMesures],
  );

  const today = aujourdhui();
  const jourCourant = useMemo(() => log[today] ?? JOUR_VIDE, [log, today]);

  return {
    pret, cfg, log, plats, mesures, photos, toast, ecritureOK, today, jourCourant,
    dire, majJour, majLog, majCfg, majPlats, majMesures, majPhotos, remplacerTout,
  };
}
