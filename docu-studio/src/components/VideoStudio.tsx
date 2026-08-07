import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AspectRatio,
  ClipMap,
  Production,
  VideoConfig,
  VideoProvider,
} from "../types";
import {
  checkHealth,
  generateClip,
  PROVIDER_LABELS,
  VIDEO_MODELS,
  type HealthInfo,
} from "../lib/video";

const KEY_STORAGE = "docustudio.videoKey";
const CFG_STORAGE = "docustudio.videoCfg";

type SceneStatus = {
  progress: number;
  status: "idle" | "running" | "done" | "error";
  error?: string;
};

interface Props {
  production: Production;
  onDone: (clips: ClipMap) => void;
  onBack: () => void;
}

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1"];

export function VideoStudio({ production, onDone, onBack }: Props) {
  const scenes = production.documentary.scenes;

  const [provider, setProvider] = useState<VideoProvider>("replicate");
  const [model, setModel] = useState(VIDEO_MODELS.replicate[0].id);
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [seconds, setSeconds] = useState(8);
  const [apiKey, setApiKey] = useState("");
  const [health, setHealth] = useState<HealthInfo | null>(null);

  const [statuses, setStatuses] = useState<Record<number, SceneStatus>>({});
  const [clips, setClips] = useState<ClipMap>({});
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    checkHealth().then(setHealth);
    const savedKey = localStorage.getItem(KEY_STORAGE);
    if (savedKey) setApiKey(savedKey);
    const savedCfg = localStorage.getItem(CFG_STORAGE);
    if (savedCfg) {
      try {
        const c = JSON.parse(savedCfg) as Partial<VideoConfig>;
        if (c.provider) setProvider(c.provider);
        if (c.model) setModel(c.model);
        if (c.aspect) setAspect(c.aspect);
        if (c.seconds) setSeconds(c.seconds);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Réinitialise le modèle quand le fournisseur change.
  function changeProvider(p: VideoProvider) {
    setProvider(p);
    setModel(VIDEO_MODELS[p][0].id);
  }

  const keyPresent = useMemo(
    () => !!apiKey.trim() || !!health?.keys?.[provider],
    [apiKey, health, provider],
  );

  const doneCount = Object.keys(clips).length;

  async function generateAll() {
    localStorage.setItem(KEY_STORAGE, apiKey.trim());
    localStorage.setItem(
      CFG_STORAGE,
      JSON.stringify({ provider, model, aspect, seconds }),
    );
    const cfg: VideoConfig = { provider, model, aspect, seconds, apiKey };
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);

    // Ne (re)génère que les scènes sans clip.
    const queue = scenes.filter((s) => !clips[s.id]);
    setStatuses((prev) => {
      const next = { ...prev };
      for (const s of queue) next[s.id] = { progress: 0, status: "running" };
      return next;
    });

    const POOL = 2;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const scene = queue[cursor++];
        try {
          const url = await generateClip(
            scene,
            production.documentary.style,
            cfg,
            (p) =>
              setStatuses((prev) => ({
                ...prev,
                [scene.id]: { progress: p, status: "running" },
              })),
            controller.signal,
          );
          setClips((prev) => ({ ...prev, [scene.id]: url }));
          setStatuses((prev) => ({
            ...prev,
            [scene.id]: { progress: 100, status: "done" },
          }));
        } catch (e) {
          setStatuses((prev) => ({
            ...prev,
            [scene.id]: {
              progress: 0,
              status: "error",
              error: e instanceof Error ? e.message : "Erreur",
            },
          }));
        }
      }
    };
    await Promise.all(Array.from({ length: POOL }, worker));
    setGenerating(false);
    abortRef.current = null;
  }

  function cancel() {
    abortRef.current?.abort();
    setGenerating(false);
  }

  return (
    <div className="vstudio">
      <div className="vstudio-head">
        <div>
          <h1>Studio vidéo IA</h1>
          <p className="sub">
            Génère un vrai clip par scène avec les modèles de pointe, puis
            assemble le documentaire.
          </p>
        </div>
        <button className="ghost" onClick={onBack} disabled={generating}>
          ← Sommaire
        </button>
      </div>

      <div className="vcfg">
        <label className="control">
          <span>Fournisseur</span>
          <select
            value={provider}
            onChange={(e) => changeProvider(e.target.value as VideoProvider)}
            disabled={generating}
          >
            {(Object.keys(PROVIDER_LABELS) as VideoProvider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="control">
          <span>Modèle</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={generating}
          >
            {VIDEO_MODELS[provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="control">
          <span>Format</span>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as AspectRatio)}
            disabled={generating}
          >
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="control">
          <span>Durée/clip : {seconds}s</span>
          <input
            type="range"
            min={4}
            max={12}
            step={2}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            disabled={generating}
          />
        </label>
      </div>

      <div className="keyrow">
        <input
          className="field"
          type="password"
          placeholder={
            health?.keys?.[provider]
              ? "Clé détectée côté serveur (.env) — laissez vide"
              : `Clé ${PROVIDER_LABELS[provider]} (ou définissez-la dans .env)`
          }
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={generating}
        />
      </div>
      <p className="hint">
        La clé vidéo n'est jamais mise dans le navigateur : elle est transmise au
        backend local qui appelle le modèle. Idéalement, placez-la dans{" "}
        <code>.env</code>.
      </p>

      <div className="vscenes">
        {scenes.map((s) => {
          const st = statuses[s.id];
          const done = !!clips[s.id];
          return (
            <div
              key={s.id}
              className={`vscene ${done ? "ok" : st?.status === "error" ? "err" : ""}`}
            >
              <div className="vscene-info">
                <span className="vscene-idx">{s.id}</span>
                <span className="vscene-heading">{s.heading}</span>
              </div>
              <div className="vscene-state">
                {done ? (
                  <span className="tag ok">✓ prêt</span>
                ) : st?.status === "running" ? (
                  <div className="vbar">
                    <div
                      className="vbar-fill"
                      style={{ width: `${Math.max(5, st.progress)}%` }}
                    />
                  </div>
                ) : st?.status === "error" ? (
                  <span className="tag err" title={st.error}>
                    ⚠ {st.error?.slice(0, 40)}
                  </span>
                ) : (
                  <span className="tag">en attente</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions">
        {!generating ? (
          <button
            className="primary"
            onClick={generateAll}
            disabled={!keyPresent}
          >
            {doneCount > 0
              ? `Générer les clips manquants (${scenes.length - doneCount})`
              : `Générer les ${scenes.length} clips`}
          </button>
        ) : (
          <button className="ghost" onClick={cancel}>
            Annuler la génération
          </button>
        )}

        <button
          className="primary alt"
          onClick={() => onDone(clips)}
          disabled={doneCount === 0 || generating}
        >
          ▶ Lancer le documentaire vidéo ({doneCount}/{scenes.length})
        </button>
      </div>

      {!keyPresent && (
        <p className="hint warn">
          Aucune clé détectée pour {PROVIDER_LABELS[provider]}. Saisissez-la
          ci-dessus ou renseignez <code>.env</code> puis relancez le serveur.
        </p>
      )}
    </div>
  );
}
