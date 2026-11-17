import { describe, it, expect } from 'vitest';
import { updatePinch, updateThumbDrop, palmNormal, isPalmUp, Dwell, Poker, hitButton, PINCH_ON, PINCH_OFF } from '../src/gestures.js';
const P = (x, y, z) => ({ x, y, z });

// Synthetic hand, fingers pointing -Z (away from user). palmDown / palmUp variants for each hand.
function hand(handedness, palm = 'down') {
  const s = handedness === 'right' ? -1 : 1; // thumb/index side is -X for right hand palm-down
  const flip = palm === 'up' ? -1 : 1;        // rolling the hand over mirrors X
  const wrist = P(0, 0, 0);
  return { wrist, indexMeta: P(s * flip * 0.02, 0, -0.08), pinkyMeta: P(-s * flip * 0.03, 0, -0.07), middleTip: P(0, 0, -0.18) };
}

describe('pinch', () => {
  it('engages under PINCH_ON and has hysteresis', () => {
    const t = P(0, 0, 0);
    expect(updatePinch(false, t, P(PINCH_ON + 0.004, 0, 0))).toBe(false);
    expect(updatePinch(false, t, P(PINCH_ON - 0.004, 0, 0))).toBe(true);
    expect(updatePinch(true, t, P((PINCH_ON + PINCH_OFF) / 2, 0, 0))).toBe(true); // stays held in the band
    expect(updatePinch(true, t, P(PINCH_OFF + 0.002, 0, 0))).toBe(false);
  });
});

describe('finger-gun thumb drop', () => {
  const wrist = P(0, 0, 0), indexTip = P(0, 0, -0.17), prox = P(-0.01, 0.01, -0.09);
  it('fires when thumb drops onto the index knuckle with index extended', () => {
    expect(updateThumbDrop(false, P(-0.01, 0.06, -0.07), prox, indexTip, wrist)).toBe(false); // thumb up
    expect(updateThumbDrop(false, P(-0.012, 0.025, -0.085), prox, indexTip, wrist)).toBe(true); // dropped
  });
  it('ignores a closed fist (index not extended)', () => {
    expect(updateThumbDrop(false, P(-0.012, 0.02, -0.085), prox, P(0, 0, -0.07), wrist)).toBe(false);
  });
});

describe('palm normal / palm-up', () => {
  for (const h of ['left', 'right']) {
    it(`${h} hand palm-down points -Y, palm-up points +Y`, () => {
      const d = hand(h, 'down'), u = hand(h, 'up');
      const nd = palmNormal(d.wrist, d.indexMeta, d.pinkyMeta, h), nu = palmNormal(u.wrist, u.indexMeta, u.pinkyMeta, h);
      expect(nd.y).toBeLessThan(-0.99); expect(nu.y).toBeGreaterThan(0.99);
      expect(isPalmUp(nd, d.wrist, d.middleTip)).toBe(false);
      expect(isPalmUp(nu, u.wrist, u.middleTip)).toBe(true);
    });
  }
  it('requires open fingers', () => {
    const u = hand('right', 'up'); const n = palmNormal(u.wrist, u.indexMeta, u.pinkyMeta, 'right');
    expect(isPalmUp(n, u.wrist, P(0, 0.02, -0.06))).toBe(false);
  });
});

describe('dwell', () => {
  it('fires once after hold, then cools down', () => {
    const d = new Dwell(0.6, 1.5); let fires = 0;
    for (let i = 0; i < 50; i++) fires += d.update(true, 0.05); // 2.5 s held
    expect(fires).toBe(1);
    const e = new Dwell(0.6, 1.5); let f2 = 0;
    for (let i = 0; i < 13; i++) f2 += e.update(true, 0.05);  // 0.65 s -> fires
    for (let i = 0; i < 2; i++) e.update(false, 0.05);        // brief release
    for (let i = 0; i < 14; i++) f2 += e.update(true, 0.05);  // re-hold inside cooldown
    expect(f2).toBe(1);
    for (let i = 0; i < 20; i++) e.update(false, 0.05);
    for (let i = 0; i < 14; i++) f2 += e.update(true, 0.05);  // after cooldown -> fires again
    expect(f2).toBe(2);
  });
  it('flicker shorter than hold never fires', () => {
    const d = new Dwell(0.6, 1.5); let fires = 0;
    for (let i = 0; i < 100; i++) fires += d.update(i % 10 < 8, 0.05); // 0.4 s on, 0.1 s off
    expect(fires).toBe(0);
  });
});

describe('poke hit testing', () => {
  const btns = [{ id: 'start', x: 0, y: 0, w: 0.1, h: 0.04 }, { id: 'swap', x: 0, y: -0.06, w: 0.1, h: 0.04 }];
  it('hitButton by rect', () => {
    expect(hitButton(P(0.04, 0.01, 0), btns).id).toBe('start');
    expect(hitButton(P(0, -0.06, 0), btns).id).toBe('swap');
    expect(hitButton(P(0.2, 0, 0), btns)).toBe(null);
  });
  it('press from front fires once, debounced, re-arms after backing off', () => {
    const p = new Poker(); const seq = [0.06, 0.03, 0.01, 0.0, -0.01, -0.01, 0.0];
    const out = seq.map(z => p.update(P(0, 0, z), btns, 0.02)).filter(Boolean);
    expect(out).toEqual(['start']);
    for (let i = 0; i < 30; i++) p.update(P(0, 0, 0.05), btns, 0.02); // back off 0.6 s
    expect([0.01, -0.005].map(z => p.update(P(0, 0, z), btns, 0.02)).filter(Boolean)).toEqual(['start']);
  });
  it('entering from behind or sliding in sideways while inside does not fire', () => {
    const p = new Poker();
    expect([-0.03, -0.01, 0.0].map(z => p.update(P(0, 0, z), btns, 0.02)).filter(Boolean)).toEqual([]);
    const q = new Poker();
    expect([P(0.3, 0, 0.0), P(0, 0, 0.0), P(0, 0, -0.01)].map(l => q.update(l, btns, 0.02)).filter(Boolean)).toEqual([]);
  });
  it('null tip disarms', () => { const p = new Poker(); p.update(P(0, 0, 0.05), btns, 0.02); p.update(null, btns, 0.02); expect(p.update(P(0, 0, 0), btns, 0.02)).toBe(null); });
});
