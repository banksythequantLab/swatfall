// End-to-end check of the hand pipeline in a headless browser using SYNTHETIC XRHand joints
// injected into three.js hand objects (desktop view; not a real XR session).
import { chromium } from 'playwright-core';
const OUT = process.env.OUT || '/workspace/invader-audit';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(process.env.URL || 'http://localhost:4173/'); await p.waitForTimeout(2000);
await p.evaluate(() => {
  const S = window.__swat, T = S.THREE, names = ['wrist','thumb-tip','index-finger-tip','middle-finger-metacarpal','index-finger-metacarpal','pinky-finger-metacarpal','middle-finger-tip','index-finger-phalanx-proximal'];
  window.H = {};
  for (const [i, side] of [[0, 'left'], [1, 'right']]) {
    const s = S.slots[i]; s.src = { hand: {}, handedness: side };
    for (const n of names) { const o = new T.Object3D(); o.visible = true; s.hand.joints[n] = o; }
    // pose(hand, wristWorld, palmUp, pinch): fingers forward (-Z)
    window.H[side] = (w, up = false, pinch = false, tipOverride = null) => {
      const sgn = side === 'right' ? -1 : 1, f = up ? -1 : 1, J = s.hand.joints, set = (n, x, y, z) => J[n].position.set(w.x + x, w.y + y, w.z + z);
      set('wrist', 0, 0, 0); set('index-finger-metacarpal', sgn * f * 0.02, 0, -0.08); set('pinky-finger-metacarpal', -sgn * f * 0.03, 0, -0.07);
      set('middle-finger-metacarpal', 0, 0, -0.08); set('middle-finger-tip', 0, 0, -0.18); set('index-finger-phalanx-proximal', sgn * f * 0.02, 0, -0.1);
      set('index-finger-tip', sgn * f * 0.025, 0, -0.17); set('thumb-tip', sgn * f * (pinch ? 0.03 : 0.07), 0.0, pinch ? -0.165 : -0.09);
      if (tipOverride) J['index-finger-tip'].position.copy(tipOverride);
    };
  }
});
const step = (ms = 120) => p.waitForTimeout(ms);
const log = []; const ok = (name, cond, extra = '') => { log.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const fingertipAt = async (side, btnId, z, wrist = { x: 0.2, y: -0.38, z: -0.2 }) => p.evaluate(([side, btnId, z, wrist]) => {
  const S = window.__swat; const btns = btnId === 'pause' ? [{ x: 0, y: 0 }] : S.buttons.filter(b => b.id === btnId); const mesh = btnId === 'pause' ? S.pauseTile.mesh : S.panel.mesh; if (!btns.length) return 0;
  const v = new S.THREE.Vector3(btns[0].x, btns[0].y, z); mesh.localToWorld(v); H[side](wrist, false, false, v); return btns.length;
}, [side, btnId, z, wrist]);
// park both hands at rest
await p.evaluate(() => { H.left({ x: -0.2, y: -0.38, z: -0.3 }); H.right({ x: 0.2, y: -0.38, z: -0.3 }); }); await step();
// 1. poke START: approach from front then push through
for (const z of [0.06, 0.03, 0.012, 0.0, -0.01]) { await fingertipAt('right', 'start', z); await step(60); }
ok('poke START starts game', await p.evaluate(() => __swat.game.state === 'play'), await p.evaluate(() => __swat.screen));
await p.evaluate(() => H.right({ x: 0.2, y: -0.38, z: -0.3 })); await step(1800);
// 2. steering: left palm far left / far right
await p.evaluate(() => H.left({ x: -0.2 - 0.15, y: -0.38, z: -0.26 })); await step(500); const xl = await p.evaluate(() => __swat.game.cannonX);
await p.evaluate(() => H.left({ x: -0.2 + 0.15, y: -0.38, z: -0.26 })); await step(500); const xr = await p.evaluate(() => __swat.game.cannonX);
ok('left hand steers emitter', xl < -0.25 && xr > 0.25, `x ${xl.toFixed(3)} -> ${xr.toFixed(3)}`);
// 3. fire: right pinch
await p.evaluate(() => { __swat.game.events.length = 0; window.__fired = 0; const g = __swat.game; const f = g.fire.bind(g); g.fire = () => { const r = f(); if (r) __fired++; return r; }; H.right({ x: 0.2, y: -0.38, z: -0.3 }, false, true); }); await step(700);
await p.evaluate(() => H.right({ x: 0.2, y: -0.38, z: -0.3 })); const fired = await p.evaluate(() => __fired);
ok('right pinch fires (held = auto-fire)', fired >= 2, `bolts fired ${fired}`);
await p.screenshot({ path: `${OUT}/e2e-01-steer-fire.png` });
// 4. swat a hovering diver with the right index tip
await p.evaluate(() => { const g = __swat.game; g.bombT = 99; g.cfg.hover = 30; g.diverT = 0.001; }); await step(1700);
const swat0 = await p.evaluate(() => __swat.game.score);
await p.evaluate(() => { const S = __swat, g = S.game, d = g.aliens.find(a => a.dive); if (!d) return; const v = new S.THREE.Vector3(d.x, d.y, d.z); S.field.localToWorld(v); H.right({ x: v.x, y: v.y, z: v.z + 0.17 }, false, false, v); });
await step(200); const swat1 = await p.evaluate(() => __swat.game.score);
ok('hand swat kills diver (+250)', swat1 - swat0 >= 250, `score ${swat0} -> ${swat1}`);
await p.screenshot({ path: `${OUT}/e2e-02-swat.png` });
// 5. palm-up dwell pauses (brief flick should not)
await p.evaluate(() => H.right({ x: 0.2, y: -0.3, z: -0.3 }, true)); await step(250); await p.evaluate(() => H.right({ x: 0.2, y: -0.38, z: -0.3 })); await step(150);
ok('brief palm flick does NOT pause', await p.evaluate(() => __swat.game.state === 'play'));
await p.evaluate(() => H.right({ x: 0.2, y: -0.3, z: -0.3 }, true)); await step(900);
ok('palm-up held ~0.6s pauses', await p.evaluate(() => __swat.game.state === 'paused'));
await p.evaluate(() => H.right({ x: 0.2, y: -0.38, z: -0.3 })); await step(400);
await p.screenshot({ path: `${OUT}/e2e-03-paused.png` });
// 6. poke SWAP then RESUME
for (const z of [0.05, 0.02, 0.0, -0.01]) { await fingertipAt('right', 'swap', z); await step(60); }
ok('poke MOVE HAND swaps to right', await p.evaluate(() => __swat.buttons.find(b => b.id === 'swap').label.includes('RIGHT')));
for (const z of [0.05, 0.02]) { await fingertipAt('right', 'swap', z); await step(60); }
for (const z of [0.05, 0.02, 0.0, -0.01]) { await fingertipAt('right', 'swap', z); await step(60); }
await p.waitForTimeout(400);
for (const z of [0.05, 0.02, 0.0, -0.01]) { await fingertipAt('left', 'resume', z, { x: -0.1, y: -0.38, z: -0.2 }); await step(60); }
ok('poke RESUME resumes', await p.evaluate(() => __swat.game.state === 'play'));
// 7. poke pause tile
await p.evaluate(() => H.left({ x: -0.2, y: -0.38, z: -0.3 })); await step(100);
for (const z of [0.05, 0.02, 0.0, -0.01]) { await fingertipAt('right', 'pause', z, { x: 0.25, y: -0.1, z: -0.3 }); await step(60); }
ok('poke pause tile pauses', await p.evaluate(() => __swat.game.state === 'paused'));
console.log(log.join('\n')); console.log('errors', JSON.stringify(errs)); await b.close();
