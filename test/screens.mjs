// Headless desktop-view screenshots (SwiftShader). Not a substitute for on-Quest testing.
import { chromium } from 'playwright-core';
const OUT = process.env.OUT || '/workspace/invader-audit', tag = process.env.TAG || 'v1';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(process.env.URL || 'http://localhost:4173/'); await p.waitForTimeout(2500);
const stats = async name => { const s = await p.evaluate(() => ({ calls: __swat.calls, tris: __swat.tris, fps: __swat.fps })); console.log(name, JSON.stringify(s)); return s; };
await p.screenshot({ path: `${OUT}/${tag}-01-menu.png` }); await stats('menu');
await p.evaluate(() => { __swat.act('start'); }); await p.waitForTimeout(2600);
await p.evaluate(() => { const g = __swat.game; g.bombT = 0.2; g.fire(); }); await p.waitForTimeout(250);
await p.screenshot({ path: `${OUT}/${tag}-02-play.png` }); await stats('play');
// force a diver to hover in front of the player
await p.evaluate(() => { const g = __swat.game; g.diverT = 0.001; g.cfg.hover = 30; }); await p.waitForTimeout(1600);
await p.screenshot({ path: `${OUT}/${tag}-03-diver.png` }); await stats('diver');
await p.evaluate(() => { const g = __swat.game; const d = g.aliens.find(a => a.dive); if (d) g.swat([{ x: d.x, y: d.y, z: d.z }]); }); await p.waitForTimeout(180);
await p.screenshot({ path: `${OUT}/${tag}-04-swat.png` }); await stats('swat');
await p.evaluate(() => { const g = __swat.game; const a = g.aliens.filter(a => a.alive).slice(0, 6); a.forEach(x => g.kill(x, 10, 'kill')); }); await p.waitForTimeout(120);
await p.screenshot({ path: `${OUT}/${tag}-05-kills.png` }); await stats('kills');
await p.evaluate(() => { __swat.act('pause'); }); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/${tag}-06-paused.png` });
await p.evaluate(() => { __swat.act('resume'); const g = __swat.game; g.invuln = 0; g.lives = 1; g.hurt(); }); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/${tag}-07-over.png` }); await stats('over');
console.log('errors', JSON.stringify(errs)); await b.close();
