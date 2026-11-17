import { describe, it, expect } from 'vitest';
import { Game, COLS, ROWS, LIVES, SWAT_POINTS, HOVER_Z } from '../src/game.js';
const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const run = (g, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) g.update(dt); };

describe('game', () => {
  it('starts in menu, reset starts wave 1 with full formation', () => {
    const g = new Game(seeded()); expect(g.state).toBe('menu'); g.reset();
    expect(g.wave).toBe(1); expect(g.aliveCount()).toBe(COLS * ROWS); expect(g.lives).toBe(LIVES);
  });
  it('a bolt fired under a column kills an alien and scores', () => {
    const g = new Game(seeded()); g.reset(); run(g, 1.7); g.bombT = 99; g.diverT = 99;
    const a = g.aliens.find(a => a.r === ROWS - 1 && a.alive); g.setCannon(a.x); g.cfg.speed = 0; g.fire();
    run(g, 0.6); expect(g.score).toBeGreaterThan(0); expect(g.aliveCount()).toBe(COLS * ROWS - 1);
  });
  it('fire has cooldown and bolt cap', () => {
    const g = new Game(seeded()); g.reset(); run(g, 1.7);
    expect(g.fire()).toBe(true); expect(g.fire()).toBe(false);
  });
  it('divers rise out of the plane toward the player and can be swatted', () => {
    const g = new Game(seeded(7)); g.reset(); run(g, 1.7); g.bombT = 99; g.diverT = 0.001; run(g, 1.3);
    const d = g.aliens.find(a => a.dive); expect(d).toBeTruthy(); expect(d.dive.stage).toBe('hover'); expect(d.z).toBeGreaterThan(HOVER_Z * 0.8);
    const s0 = g.score; expect(g.swat([{ x: d.x + 0.02, y: d.y, z: d.z }])).toBe(1); expect(g.score - s0).toBe(SWAT_POINTS);
  });
  it('an unswatted diver stings the cannon and costs a life', () => {
    const g = new Game(seeded(7)); g.reset(); run(g, 1.7); g.bombT = 99; g.diverT = 0.001; run(g, 0.05); g.diverT = 99;
    run(g, 6); expect(g.lives).toBe(LIVES - 1);
  });
  it('clearing all aliens advances the wave', () => {
    const g = new Game(seeded()); g.reset(); run(g, 1.7); for (const a of g.aliens) a.alive = false; g.update(1 / 60);
    expect(g.wave).toBe(2); expect(g.aliveCount()).toBe(COLS * ROWS);
  });
  it('losing all lives ends the game; formation reaching the floor ends it', () => {
    const g = new Game(seeded()); g.reset(); for (let i = 0; i < LIVES; i++) { g.invuln = 0; g.hurt(); } expect(g.state).toBe('over');
    const h = new Game(seeded()); h.reset(); h.oy = 0.2; run(h, 0.01); run(h, 2); expect(h.state).toBe('over');
  });
});
