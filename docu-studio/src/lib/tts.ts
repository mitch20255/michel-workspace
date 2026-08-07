/**
 * Fine couche autour de la synthèse vocale du navigateur (voix off française).
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Filet de sécurité si l'événement ne se déclenche jamais.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
}

function pickFrenchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  // Préférence pour une voix "premium"/locale si disponible.
  return (
    fr.find((v) => /google|amélie|thomas|premium|natural|enhanced/i.test(v.name)) ||
    fr[0]
  );
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Charge les voix et indique si une voix française utilisable est disponible. */
export async function ensureFrenchVoice(): Promise<boolean> {
  if (!isSpeechSupported()) return false;
  if (!cachedVoices.length) await loadVoices();
  return !!pickFrenchVoice(cachedVoices);
}

export interface SpeakHandle {
  cancel: () => void;
}

/**
 * Prononce un texte. `onEnd` est appelé à la fin (ou en cas d'échec).
 * Renvoie un handle pour annuler.
 */
export async function speak(
  text: string,
  opts: { rate?: number; pitch?: number; onEnd?: () => void } = {},
): Promise<SpeakHandle> {
  if (!isSpeechSupported() || !text.trim()) {
    opts.onEnd?.();
    return { cancel: () => {} };
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  if (!cachedVoices.length) await loadVoices();

  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickFrenchVoice(cachedVoices);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang || "fr-FR";
  utter.rate = opts.rate ?? 0.98;
  utter.pitch = opts.pitch ?? 1;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(keepAlive);
    opts.onEnd?.();
  };
  utter.onend = finish;
  utter.onerror = finish;

  // Contournement du bug Chrome qui met la synthèse en pause après ~15 s.
  const keepAlive = setInterval(() => {
    if (synth.speaking && !synth.paused) {
      synth.pause();
      synth.resume();
    }
  }, 10000);

  synth.speak(utter);

  return {
    cancel: () => {
      done = true;
      clearInterval(keepAlive);
      synth.cancel();
    },
  };
}

export function cancelSpeech(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
