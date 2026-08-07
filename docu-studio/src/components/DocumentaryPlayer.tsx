import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipMap, Production } from "../types";
import { AmbientMusic } from "../lib/audio";
import {
  cancelSpeech,
  ensureFrenchVoice,
  speak,
  type SpeakHandle,
} from "../lib/tts";
import { gradientFor, sceneImageUrl } from "../lib/visuals";

interface Props {
  production: Production;
  clips?: ClipMap;
  onExit: () => void;
}

export function DocumentaryPlayer({ production, clips = {}, onExit }: Props) {
  const scenes = production.documentary.scenes;
  const style = production.documentary.style;

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"intro" | "scene" | "outro">("intro");
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [nonce, setNonce] = useState(0); // force le redémarrage des animations

  const speakRef = useRef<SpeakHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const musicRef = useRef<AmbientMusic | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const scene = scenes[index];
  const imgUrl = useMemo(
    () => (scene ? sceneImageUrl(scene, style) : ""),
    [scene, style],
  );

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const stopSpeech = () => {
    speakRef.current?.cancel();
    speakRef.current = null;
    cancelSpeech();
  };

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < scenes.length) return i + 1;
      setPhase("outro");
      setIsPlaying(false);
      return i;
    });
  }, [scenes.length]);

  // Détecte une voix française utilisable au montage.
  useEffect(() => {
    ensureFrenchVoice().then(setVoiceAvailable);
  }, []);

  // --- Musique d'ambiance ---
  useEffect(() => {
    musicRef.current = new AmbientMusic();
    return () => {
      musicRef.current?.stop();
      stopSpeech();
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = musicRef.current;
    if (!m) return;
    if (isPlaying && phase === "scene") {
      m.start(musicMuted ? 0 : 0.12);
      m.setVolume(musicMuted ? 0 : 0.12);
    } else {
      m.setVolume(0);
    }
  }, [isPlaying, phase, musicMuted]);

  // --- Déroulé d'une scène ---
  useEffect(() => {
    if (phase !== "scene" || !isPlaying || !scene) return;
    stopSpeech();
    clearTimer();

    const durationMs = scene.durationSec * 1000;

    if (!voiceMuted && voiceAvailable) {
      let advanced = false;
      const go = () => {
        if (advanced) return;
        advanced = true;
        advance();
      };
      speak(scene.narration, { onEnd: go }).then((h) => {
        speakRef.current = h;
      });
      // Filet de sécurité si onend ne se déclenche jamais.
      timerRef.current = window.setTimeout(go, durationMs + 30000);
    } else {
      timerRef.current = window.setTimeout(advance, durationMs);
    }

    return () => {
      stopSpeech();
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, isPlaying, nonce, voiceMuted, voiceAvailable]);

  // Recharge l'état d'image à chaque scène.
  useEffect(() => {
    setImgLoaded(false);
  }, [index]);

  // --- Commandes ---
  const begin = () => {
    setPhase("scene");
    setIndex(0);
    setIsPlaying(true);
    setNonce((n) => n + 1);
  };

  const togglePlay = () => {
    if (phase === "outro") {
      begin();
      return;
    }
    if (phase === "intro") {
      begin();
      return;
    }
    setIsPlaying((p) => {
      const next = !p;
      if (next) setNonce((n) => n + 1); // relance la narration de la scène
      return next;
    });
  };

  const goto = (i: number) => {
    const clamped = Math.max(0, Math.min(scenes.length - 1, i));
    setPhase("scene");
    setIndex(clamped);
    setIsPlaying(true);
    setNonce((n) => n + 1);
  };

  const restart = () => {
    setPhase("intro");
    setIndex(0);
    setIsPlaying(false);
    stopSpeech();
    clearTimer();
  };

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  // Raccourcis clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") goto(index + 1);
      else if (e.key === "ArrowLeft") goto(index - 1);
      else if (e.key === "Escape" && !document.fullscreenElement) onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, isPlaying]);

  const bg = scene ? gradientFor(scene) : "#000";
  const clipUrl = scene ? clips[scene.id] : undefined;

  return (
    <div className="player" ref={stageRef}>
      {/* Fond de secours (dégradé) toujours présent sous l'image. */}
      <div className="player-bg" style={{ background: bg }} />

      {phase === "scene" && scene && clipUrl && (
        <video
          key={`vid-${index}-${nonce}`}
          className="player-img show"
          src={clipUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}

      {phase === "scene" && scene && !clipUrl && imgUrl && (
        <img
          key={`${index}-${nonce}`}
          className={`player-img kenburns ${imgLoaded ? "show" : ""}`}
          style={{ animationDuration: `${scene.durationSec + 4}s` }}
          src={imgUrl}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(false)}
        />
      )}

      <div className="player-vignette" />

      {/* Intro */}
      {phase === "intro" && (
        <div className="player-card">
          <p className="kicker">
            {style === "realistic" ? "Documentaire" : "Documentaire animé"}
          </p>
          <h1>{production.title}</h1>
          {production.subtitle && <p className="tagline">{production.subtitle}</p>}
          <button className="big-play" onClick={begin}>
            ▶ Commencer
          </button>
        </div>
      )}

      {/* Outro */}
      {phase === "outro" && (
        <div className="player-card">
          <p className="kicker">Fin</p>
          <h1>{production.title}</h1>
          <p className="tagline">Merci d'avoir regardé.</p>
          <div className="outro-actions">
            <button className="big-play" onClick={begin}>
              ⟳ Revoir
            </button>
            <button className="ghost light" onClick={onExit}>
              Retour au sommaire
            </button>
          </div>
        </div>
      )}

      {/* Scène : textes superposés */}
      {phase === "scene" && scene && (
        <div className="player-overlay">
          <div className="scene-top">
            <span className="scene-heading">{scene.heading}</span>
          </div>
          {scene.onScreenText && (
            <div key={`ost-${index}-${nonce}`} className="scene-hero">
              {scene.onScreenText}
            </div>
          )}
          <div key={`sub-${index}-${nonce}`} className="scene-sub">
            {scene.narration}
          </div>
        </div>
      )}

      {/* Barre de progression par scène */}
      {phase === "scene" && (
        <div className="progress">
          {scenes.map((s, i) => (
            <div key={s.id} className="progress-seg">
              <div
                className={`progress-fill ${
                  i < index ? "full" : i === index ? "run" : ""
                }`}
                style={
                  i === index
                    ? {
                        animationDuration: `${s.durationSec}s`,
                        animationPlayState: isPlaying ? "running" : "paused",
                      }
                    : undefined
                }
                key={`${i}-${nonce}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Contrôles */}
      <div className="controls">
        <div className="controls-left">
          <button className="ctrl" onClick={() => goto(index - 1)} title="Précédent">
            ⏮
          </button>
          <button className="ctrl play" onClick={togglePlay} title="Lecture / Pause">
            {isPlaying && phase === "scene" ? "⏸" : "▶"}
          </button>
          <button className="ctrl" onClick={() => goto(index + 1)} title="Suivant">
            ⏭
          </button>
          {phase === "scene" && (
            <span className="counter">
              {index + 1} / {scenes.length}
            </span>
          )}
        </div>
        <div className="controls-right">
          <button
            className={`ctrl ${voiceMuted ? "off" : ""}`}
            onClick={() => setVoiceMuted((v) => !v)}
            title="Voix off"
          >
            {voiceMuted ? "🔇 Voix" : "🎙 Voix"}
          </button>
          <button
            className={`ctrl ${musicMuted ? "off" : ""}`}
            onClick={() => setMusicMuted((v) => !v)}
            title="Musique"
          >
            {musicMuted ? "🔕 Musique" : "🎵 Musique"}
          </button>
          <button className="ctrl" onClick={restart} title="Recommencer">
            ⟳
          </button>
          <button className="ctrl" onClick={toggleFullscreen} title="Plein écran">
            ⛶
          </button>
          <button className="ctrl exit" onClick={onExit} title="Quitter">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
