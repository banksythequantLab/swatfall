// Original synthesized WebAudio sound set for SWATFALL (no samples, no third-party audio).
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.beat = 0; this.nextT = 0; this.tempo = 1; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  get ok() { return this.on && this.ctx && this.ctx.state === 'running'; }
  tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
    if (!this.ok) return; const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur, f, vol = 0.3, q = 0.8, delay = 0) {
    if (!this.ok) return; const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(80, t + dur); bp.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(bp).connect(g).connect(this.master); s.start(t); s.stop(t + dur);
  }
  zap() { this.tone('sawtooth', 1400, 320, 0.12, 0.07); this.tone('sine', 2600, 900, 0.08, 0.05); }
  pop(kind) { const f = kind === 'lumen' ? 900 : kind === 'urchin' ? 640 : 480; this.burst(0.28, 3200, 0.22); this.tone('triangle', f, f * 0.4, 0.2, 0.12); }
  swat() { this.burst(0.12, 6000, 0.35, 2); this.tone('square', 220, 70, 0.25, 0.12); [784, 988, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.09, 0.06 + i * 0.06)); }
  hurt() { this.burst(0.6, 1800, 0.4); this.tone('sawtooth', 300, 40, 0.6, 0.15); }
  dive() { this.tone('sine', 300, 1100, 0.9, 0.06); this.tone('sine', 303, 1110, 0.9, 0.05); }
  strike() { this.tone('sawtooth', 900, 120, 0.5, 0.08); }
  bomb() { this.tone('sine', 520, 260, 0.18, 0.03); }
  intercept() { this.tone('square', 1800, 2400, 0.06, 0.05); }
  click() { this.tone('square', 1200, 1200, 0.03, 0.06); this.tone('sine', 600, 600, 0.06, 0.08); }
  wave() { [440, 554, 659, 880].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.08, i * 0.09)); }
  over() { [523, 415, 330, 262].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.32, 0.07, i * 0.22)); }
  // Ambient pulse: a low two-chord bass throb + soft hat, tempo rises as the swarm thins.
  music(playing, dt) {
    if (!this.ok || !this.musicOn || !playing) { this.nextT = 0; return; }
    const now = this.ctx.currentTime; if (!this.nextT || this.nextT < now) this.nextT = now + 0.05;
    const step = 0.24 / this.tempo;
    while (this.nextT < now + 0.15) {
      const b = this.beat++ % 16, root = b < 8 ? 55 : 49; const delay = this.nextT - now;
      if (b % 2 === 0) this.tone('triangle', root * (b % 4 === 0 ? 1 : 2), root * 0.9, 0.2, 0.09, delay);
      if (b % 2 === 1) this.burst(0.04, 9000, 0.03, 0.5, delay);
      this.nextT += step;
    }
  }
}
