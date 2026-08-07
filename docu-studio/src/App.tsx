import { useEffect, useRef, useState } from "react";
import { InputPanel } from "./components/InputPanel";
import { SummaryView } from "./components/SummaryView";
import { DocumentaryPlayer } from "./components/DocumentaryPlayer";
import { VideoStudio } from "./components/VideoStudio";
import { Loader } from "./components/Loader";
import { generateProduction } from "./lib/claude";
import { DEMO_PRODUCTION } from "./lib/demo";
import type { ClipMap, GenerateOptions, Production } from "./types";

type View = "input" | "summary" | "video" | "player";

export function App() {
  const [view, setView] = useState<View>("input");
  const [production, setProduction] = useState<Production | null>(null);
  const [clips, setClips] = useState<ClipMap>({});
  const [loading, setLoading] = useState(false);
  const [loaderStep, setLoaderStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepTimer = useRef<number | null>(null);

  // Avance visuellement les étapes du chargement.
  useEffect(() => {
    if (loading) {
      setLoaderStep(0);
      let s = 0;
      stepTimer.current = window.setInterval(() => {
        s = Math.min(s + 1, 4);
        setLoaderStep(s);
      }, 4000);
    } else if (stepTimer.current) {
      window.clearInterval(stepTimer.current);
      stepTimer.current = null;
    }
    return () => {
      if (stepTimer.current) window.clearInterval(stepTimer.current);
    };
  }, [loading]);

  async function handleGenerate(opts: GenerateOptions) {
    setError(null);
    setLoading(true);
    try {
      const result = await generateProduction(opts);
      setProduction(result);
      setClips({});
      setView("summary");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur inconnue pendant la génération.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDemo() {
    setError(null);
    setProduction(DEMO_PRODUCTION);
    setClips({});
    setView("summary");
  }

  if (view === "player" && production) {
    return (
      <DocumentaryPlayer
        production={production}
        clips={clips}
        onExit={() => setView(Object.keys(clips).length ? "video" : "summary")}
      />
    );
  }

  if (view === "video" && production) {
    return (
      <VideoStudio
        production={production}
        onDone={(c) => {
          setClips(c);
          setView("player");
        }}
        onBack={() => setView("summary")}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◐</span>
          <div>
            <strong>Docu Studio</strong>
            <span className="brand-sub">
              Sommaire expert → mini-documentaire
            </span>
          </div>
        </div>
      </header>

      <main className="main">
        {view === "input" && (
          <section className="hero">
            <h1 className="hero-title">
              D'un sujet à un <span className="grad">mini-documentaire</span>.
            </h1>
            <p className="hero-sub">
              Entrez un sujet ou un texte. L'IA rédige un sommaire de niveau
              expert, puis met en scène un documentaire cinématique — voix off,
              visuels, musique et sous-titres.
            </p>

            {loading ? (
              <Loader step={loaderStep} />
            ) : (
              <InputPanel
                onGenerate={handleGenerate}
                onDemo={handleDemo}
                loading={loading}
              />
            )}

            {error && <div className="error">⚠ {error}</div>}
          </section>
        )}

        {view === "summary" && production && (
          <SummaryView
            production={production}
            onPlay={() => setView("player")}
            onVideo={() => setView("video")}
            onReset={() => {
              setProduction(null);
              setClips({});
              setView("input");
            }}
          />
        )}
      </main>

      <footer className="footer">
        Généré à la demande · voix off via la synthèse du navigateur · visuels
        via un générateur d'images ouvert.
      </footer>
    </div>
  );
}
