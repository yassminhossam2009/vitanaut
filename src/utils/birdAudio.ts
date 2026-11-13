class BirdsongSynthesizer {
  private ctx: AudioContext | null = null;
  private timerId: number | null = null;
  private isPlaying = false;

  public start(birdCount: number) {
    if (this.isPlaying) return;
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.isPlaying = true;
    this.playChirp();

    const intervalMs = Math.max(1400, 3600 - Math.min(birdCount, 6) * 320);
    this.timerId = window.setInterval(() => {
      if (this.isPlaying) {
        this.playChirp();
      }
    }, intervalMs);
  }

  public playSingleChirp() {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    this.playChirp();
  }

  private playChirp() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const notes = [1760, 2093, 2349, 2637];
    const baseFreq = notes[Math.floor(Math.random() * notes.length)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.21);

    if (Math.random() > 0.35) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      const start2 = now + 0.22;
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.12, start2);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.38, start2 + 0.09);

      gain2.gain.setValueAtTime(0.001, start2);
      gain2.gain.linearRampToValueAtTime(0.045, start2 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, start2 + 0.16);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc2.start(start2);
      osc2.stop(start2 + 0.18);
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const birdAudio = new BirdsongSynthesizer();
