import { useEffect, useState } from "react";
import type { DocStyle, GenerateOptions, InputMode } from "../types";

const KEY_STORAGE = "docustudio.apiKey";

const MODELS = [
  { id: "claude-opus-5", label: "Opus 5 — qualité maximale" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — équilibré (rapide)" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — économique" },
];

interface Props {
  onGenerate: (opts: GenerateOptions) => void;
  onDemo: () => void;
  loading: boolean;
}

export function InputPanel({ onGenerate, onDemo, loading }: Props) {
  const [mode, setMode] = useState<InputMode>("topic");
  const [input, setInput] = useState("");
  const [style, setStyle] = useState<DocStyle>("realistic");
  const [model, setModel] = useState(MODELS[0].id);
  const [sceneCount, setSceneCount] = useState(5);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);

  const canGenerate = input.trim().length > 2 && apiKey.trim().length > 10;

  function submit() {
    localStorage.setItem(KEY_STORAGE, apiKey.trim());
    onGenerate({
      mode,
      input: input.trim(),
      style,
      model,
      sceneCount,
      apiKey: apiKey.trim(),
    });
  }

  return (
    <div className="panel">
      <div className="seg">
        <button
          className={mode === "topic" ? "seg-btn on" : "seg-btn"}
          onClick={() => setMode("topic")}
        >
          Un sujet
        </button>
        <button
          className={mode === "text" ? "seg-btn on" : "seg-btn"}
          onClick={() => setMode("text")}
        >
          Un texte à résumer
        </button>
      </div>

      {mode === "topic" ? (
        <input
          className="field"
          placeholder="Ex. : les trous noirs, la Révolution française, l'IA générative…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      ) : (
        <textarea
          className="field area"
          placeholder="Collez ici un article, un rapport, des notes…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={7}
        />
      )}

      <div className="row">
        <label className="control">
          <span>Style</span>
          <div className="seg small">
            <button
              className={style === "realistic" ? "seg-btn on" : "seg-btn"}
              onClick={() => setStyle("realistic")}
            >
              🎬 Réaliste
            </button>
            <button
              className={style === "animated" ? "seg-btn on" : "seg-btn"}
              onClick={() => setStyle("animated")}
            >
              ✨ Animé
            </button>
          </div>
        </label>

        <label className="control">
          <span>Scènes : {sceneCount}</span>
          <input
            type="range"
            min={3}
            max={8}
            value={sceneCount}
            onChange={(e) => setSceneCount(Number(e.target.value))}
          />
        </label>

        <label className="control">
          <span>Modèle</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="keyrow">
        <input
          className="field"
          type={showKey ? "text" : "password"}
          placeholder="Clé API Anthropic (sk-ant-…)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button className="ghost" onClick={() => setShowKey((s) => !s)}>
          {showKey ? "Masquer" : "Afficher"}
        </button>
      </div>
      <p className="hint">
        La clé reste sur votre appareil (stockage local du navigateur) et sert
        uniquement à appeler l'API. Pas de clé ? Essayez le mode démo.
      </p>

      <div className="actions">
        <button
          className="primary"
          disabled={!canGenerate || loading}
          onClick={submit}
        >
          {loading ? "Génération…" : "Générer le documentaire"}
        </button>
        <button className="ghost" disabled={loading} onClick={onDemo}>
          Voir la démo (sans clé)
        </button>
      </div>
    </div>
  );
}
