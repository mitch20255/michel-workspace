import type { DocStyle, Scene } from "../types";

/**
 * Construit l'URL d'une image générée par IA pour une scène.
 * Utilise Pollinations (gratuit, sans clé). Si la génération échoue,
 * le lecteur bascule sur un fond procédural (voir gradientFor).
 */
export function sceneImageUrl(scene: Scene, style: DocStyle): string {
  const styleHint =
    style === "realistic"
      ? "cinematic photorealistic, film still, dramatic lighting, 35mm"
      : "stylized animated illustration, painterly, vibrant, concept art";
  const prompt = `${scene.visualPrompt}, ${styleHint}`;
  const encoded = encodeURIComponent(prompt);
  const seed = scene.id * 7919; // déterministe par scène
  return `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=720&nologo=true&seed=${seed}`;
}

/** Dégradé de secours dérivé de la palette de la scène. */
export function gradientFor(scene: Scene): string {
  const [a, b, c] = scene.palette;
  return `radial-gradient(120% 120% at 30% 20%, ${b} 0%, ${a} 55%, #000 100%), linear-gradient(160deg, ${a}, ${c})`;
}

/** Précharge une image et résout true/false selon le succès. */
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
