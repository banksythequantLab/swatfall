// SWATFALL core rules. Pure, deterministic given an rng; no rendering.
// Field space (metres): x across (-HALF_W..HALF_W), y up the playfield away from the player
// (cannon at y=0, swarm near TOP), z out of the playfield plane toward the player.
export const COLS = 8, ROWS = 4, SX = 0.058, SY = 0.052, HALF_W = 0.35, TOP = 0.52, FLOOR = 0.075;
export const KINDS = ['lumen', 'urchin', 'moth', 'moth']; // by row (front rows easier)
export const POINTS = { urchin: 20, lumen: 40, moth: 10 };
export const BOLT_SPEED = 1.25, FIRE_COOLDOWN = 0.32, MAX_BOLTS = 3, MAX_BOMBS = 14, LIVES = 3;
export const SWAT_RADIUS = 0.075, SWAT_POINTS = 250, DIVER_SHOT_POINTS = 100;
// Hover point ~ world (x, -0.12, -0.42) relative to the seated head: just above the hands, within arm's reach.
export const HOVER_Z = 0.22, HOVER_Y = 0.0;

export const waveConfig = n => ({
  speed: 0.05 + 0.012 * n,
  bombEvery: Math.max(0.45, 1.5 - 0.12 * n),
  bombSpeed: 0.26 + 0.02 * n,
  diverEvery: Math.max(3.2, 8 - 0.7 * n),
  maxDivers: 1 + Math.floor(n / 3),
  hover: Math.max(1.6, 3.0 - 0.15 * n),
  startY: TOP - Math.min(n - 1, 4) * 0.018,
});

export class Game {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.aliens = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      this.aliens.push({ i: r * COLS + c, r, c, kind: KINDS[r], alive: false, dive: null, x: 0, y: 0, z: 0, phase: 0 });
    this.bolts = Array.from({ length: MAX_BOLTS }, () => ({ on: false, x: 0, y: 0 }));
    this.bombs = Array.from({ length: MAX_BOMBS }, () => ({ on: false, x: 0, y: 0, z: 0 }));
    this.events = [];
    this.best = 0;
    this.reset();
    this.state = 'menu'; this.events.length = 0;
  }
  reset() {
    this.score = 0; this.lives = LIVES; this.wave = 0; this.cannonX = 0; this.invuln = 0; this.time = 0;
    this.state = 'play'; this.nextWave();
  }
  nextWave() {
    this.wave++; this.cfg = waveConfig(this.wave);
    this.ox = 0; this.oy = this.cfg.startY; this.dir = 1; this.intro = 1.6;
    this.bombT = this.cfg.bombEvery * 1.5; this.diverT = this.cfg.diverEvery;
    for (const a of this.aliens) { a.alive = true; a.dive = null; a.phase = this.rng() * 6.28; }
    for (const b of this.bolts) b.on = false; for (const b of this.bombs) b.on = false;
    this.emit('wave', 0, 0, 0, this.wave);
  }
  emit(type, x, y, z, v = 0, kind = '') { this.events.push({ type, x, y, z, v, kind }); }
  slotPos(a) { this.sx = this.ox + (a.c - (COLS - 1) / 2) * SX; this.sy = this.oy - a.r * SY; } // writes sx/sy (no allocation)
  aliveCount() { let n = 0; for (const a of this.aliens) if (a.alive) n++; return n; }
  setCannon(x) { this.cannonX = Math.max(-HALF_W + 0.03, Math.min(HALF_W - 0.03, x)); }
  fire() {
    if (this.state !== 'play' || this.intro > 0 || this.fireCd > 0) return false;
    const b = this.bolts.find(b => !b.on); if (!b) return false;
    b.on = true; b.x = this.cannonX; b.y = 0.03; this.fireCd = FIRE_COOLDOWN; this.emit('fire', b.x, b.y, 0);
    return true;
  }
  // Hand points in field space; kills any diver within SWAT_RADIUS. Returns number swatted.
  swat(points) {
    if (this.state !== 'play') return 0; let n = 0;
    for (const a of this.aliens) {
      if (!a.alive || !a.dive) continue;
      for (const p of points) {
        if (!p) continue;
        const d = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
        if (d < SWAT_RADIUS) { this.kill(a, SWAT_POINTS, 'swat'); n++; break; }
      }
    }
    return n;
  }
  kill(a, pts, how) {
    a.alive = false; a.dive = null; this.score += pts; if (this.score > this.best) this.best = this.score;
    this.emit(how, a.x, a.y, a.z, pts, a.kind);
  }
  hurt() {
    if (this.invuln > 0) return;
    this.lives--; this.invuln = 1.6; this.emit('hurt', this.cannonX, 0, 0, this.lives);
    if (this.lives <= 0) this.gameOver();
  }
  gameOver() { this.state = 'over'; this.emit('over', 0, 0, 0, this.score); }
  update(dt) {
    if (this.state !== 'play') return;
    this.time += dt; this.fireCd = Math.max(0, (this.fireCd || 0) - dt); this.invuln = Math.max(0, this.invuln - dt);
    if (this.intro > 0) { this.intro -= dt; }
    const cfg = this.cfg;
    // formation march (smooth), speeds up as it thins out
    const alive = this.aliveCount();
    if (alive === 0) { this.emit('clear', 0, 0, 0, this.wave); this.nextWave(); return; }
    if (this.intro <= 0) {
      const speed = cfg.speed * (1 + 1.6 * (1 - alive / (COLS * ROWS)));
      this.ox += this.dir * speed * dt;
      let minX = 1, maxX = -1, minY = 1;
      for (const a of this.aliens) if (a.alive && !a.dive) {
        this.slotPos(a); const x = this.sx, y = this.sy; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y;
      }
      if (maxX > HALF_W - 0.03 && this.dir > 0) { this.dir = -1; this.oy -= 0.024; this.emit('step', 0, 0, 0); }
      else if (minX < -HALF_W + 0.03 && this.dir < 0) { this.dir = 1; this.oy -= 0.024; this.emit('step', 0, 0, 0); }
      if (minY < FLOOR && minX <= maxX) { this.lives = 0; this.gameOver(); return; }
    }
    // alien positions + divers
    for (const a of this.aliens) {
      if (!a.alive) continue; a.phase += dt * 3;
      this.slotPos(a); const sx = this.sx, sy = this.sy;
      if (!a.dive) { a.x = sx; a.y = sy; a.z = 0.012 * Math.sin(a.phase); continue; }
      const d = a.dive; d.t += dt;
      if (d.stage === 'rise') {
        const k = Math.min(1, d.t / 1.1), e = k * k * (3 - 2 * k);
        a.x = d.x0 + (d.hx - d.x0) * e; a.y = d.y0 + (d.hy - d.y0) * e; a.z = HOVER_Z * Math.sin(e * Math.PI / 2) + 0.05 * Math.sin(k * Math.PI);
        if (k >= 1) { d.stage = 'hover'; d.t = 0; this.emit('hover', a.x, a.y, a.z); }
      } else if (d.stage === 'hover') {
        a.x = d.hx + 0.03 * Math.sin(d.t * 5); a.y = d.hy + 0.015 * Math.sin(d.t * 7.3); a.z = HOVER_Z + 0.01 * Math.sin(d.t * 9);
        if (d.t >= cfg.hover) { d.stage = 'strike'; d.t = 0; d.sx = a.x; d.sy = a.y; d.tx = this.cannonX; this.emit('strike', a.x, a.y, a.z); }
      } else {
        const k = Math.min(1, d.t / 0.55);
        a.x = d.sx + (d.tx - d.sx) * k; a.y = d.sy * (1 - k); a.z = HOVER_Z * (1 - k);
        if (k >= 1) { a.alive = false; a.dive = null; this.emit('sting', a.x, 0, 0); if (Math.abs(this.cannonX - a.x) < 0.09) this.hurt(); else this.emit('miss', a.x, 0, 0); }
      }
    }
    if (this.intro > 0) return;
    // launch divers
    this.diverT -= dt;
    if (this.diverT <= 0) {
      this.diverT = cfg.diverEvery * (0.8 + 0.4 * this.rng());
      let diving = 0; for (const a of this.aliens) if (a.alive && a.dive) diving++;
      if (diving < cfg.maxDivers) {
        const pool = this.aliens.filter(a => a.alive && !a.dive);
        if (pool.length > 1) {
          const a = pool[Math.floor(this.rng() * pool.length)];
          a.dive = { stage: 'rise', t: 0, x0: a.x, y0: a.y, hx: (this.rng() - 0.5) * 0.34, hy: HOVER_Y };
          this.emit('dive', a.x, a.y, 0);
        }
      }
    }
    // bombs from the lowest alien in a random occupied column
    this.bombT -= dt;
    if (this.bombT <= 0) {
      this.bombT = cfg.bombEvery * (0.7 + 0.6 * this.rng());
      const c = Math.floor(this.rng() * COLS); let low = null;
      for (let k = 0; k < COLS && !low; k++) {
        const cc = (c + k) % COLS;
        for (let r = ROWS - 1; r >= 0; r--) { const a = this.aliens[r * COLS + cc]; if (a.alive && !a.dive) { low = a; break; } }
      }
      const b = this.bombs.find(b => !b.on);
      if (low && b) { b.on = true; b.x = low.x; b.y = low.y - 0.02; b.z = 0; this.emit('bomb', b.x, b.y, 0); }
    }
    for (const b of this.bombs) {
      if (!b.on) continue; b.y -= cfg.bombSpeed * dt;
      if (b.y < 0.03 && b.y > -0.01 && Math.abs(b.x - this.cannonX) < 0.032) { b.on = false; this.hurt(); continue; }
      if (b.y < -0.04) b.on = false;
    }
    for (const bl of this.bolts) {
      if (!bl.on) continue; bl.y += BOLT_SPEED * dt;
      if (bl.y > TOP + 0.1) { bl.on = false; continue; }
      for (const a of this.aliens) {
        if (!a.alive || Math.abs(a.z) > 0.04) continue;
        if (Math.abs(a.x - bl.x) < 0.024 && Math.abs(a.y - bl.y) < 0.022) {
          bl.on = false; this.kill(a, a.dive ? DIVER_SHOT_POINTS : POINTS[a.kind], 'kill'); break;
        }
      }
      if (!bl.on) continue;
      for (const b of this.bombs) if (b.on && Math.abs(b.x - bl.x) < 0.015 && Math.abs(b.y - bl.y) < 0.02) { b.on = false; bl.on = false; this.score += 5; this.emit('intercept', b.x, b.y, 0); break; }
    }
  }
}
