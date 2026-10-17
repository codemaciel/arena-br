/** Sons sintetizados com Web Audio API (sem arquivos de áudio). */
export class AudioManager {
  constructor(volume = 0.6) {
    this.volume = volume;
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  /** Deve ser chamado dentro de um gesto do usuário (clique). */
  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null; // sem áudio: o jogo continua funcionando
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  #burst(duration, freq, q, gain, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  #tone(f0, f1, duration, type, gain, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  shoot() { this.#burst(0.12, 1800, 0.8, 0.5); this.#tone(160, 50, 0.1, 'square', 0.25); }
  enemyShoot(distance = 10) {
    const g = Math.max(0.05, 0.35 - distance / 120);
    this.#burst(0.1, 1200, 0.8, g);
  }
  reload() { this.#tone(900, 700, 0.05, 'square', 0.15); this.#tone(500, 400, 0.06, 'square', 0.15, 0.7); this.#tone(1000, 800, 0.05, 'square', 0.18, 1.45); }
  hit(headshot = false) { this.#tone(headshot ? 1500 : 1000, headshot ? 1100 : 800, 0.07, 'sine', 0.3); }
  kill() { this.#tone(600, 1200, 0.12, 'triangle', 0.35); this.#tone(900, 1500, 0.15, 'triangle', 0.3, 0.1); }
  hurt() { this.#burst(0.15, 300, 0.7, 0.4); this.#tone(120, 60, 0.15, 'sawtooth', 0.2); }
  respawn() { this.#tone(300, 700, 0.2, 'sine', 0.25); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.#tone(f, f, 0.18, 'triangle', 0.3, i * 0.15)); }
  lose() { [392, 330, 262].forEach((f, i) => this.#tone(f, f * 0.95, 0.25, 'triangle', 0.3, i * 0.2)); }

  dispose() {
    this.ctx?.close?.();
    this.ctx = null;
  }
}
