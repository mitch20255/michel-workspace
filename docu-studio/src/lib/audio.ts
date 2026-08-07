/**
 * Musique d'ambiance générée à la volée avec la Web Audio API — un pad
 * cinématique évolutif, sans aucun fichier externe.
 */
export class AmbientMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private playing = false;

  private buildChord(base: number): number[] {
    // Accord mineur ample (fondamentale, quinte, octave, dixième mineure).
    return [base, base * 1.5, base * 2, base * 2.4];
  }

  start(volume = 0.12): void {
    if (this.playing) return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    this.master.gain.linearRampToValueAtTime(volume, now + 2.5);

    // Filtre passe-bas pour un rendu chaleureux.
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.5;
    filter.connect(this.master);

    for (const freq of this.buildChord(98)) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = 0.25;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      this.nodes.push(osc);
    }

    // LFO lent qui module le filtre pour un mouvement organique.
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.05;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 300;
    this.lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    this.lfo.start();

    this.playing = true;
  }

  setVolume(volume: number): void {
    if (this.ctx && this.master) {
      this.master.gain.linearRampToValueAtTime(
        volume,
        this.ctx.currentTime + 0.4,
      );
    }
  }

  stop(): void {
    if (!this.playing || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.linearRampToValueAtTime(0, now + 1);
    const ctx = this.ctx;
    setTimeout(() => {
      this.nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* déjà arrêté */
        }
      });
      try {
        this.lfo?.stop();
      } catch {
        /* déjà arrêté */
      }
      ctx.close();
    }, 1100);
    this.nodes = [];
    this.lfo = null;
    this.playing = false;
  }
}
