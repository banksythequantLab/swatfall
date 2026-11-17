import * as THREE from 'three';
import { Game, HALF_W, TOP, COLS, ROWS, FLOOR, KINDS } from './game.js';
import * as G from './gestures.js';
import { Sound } from './audio.js';
import * as A from './art.js';

const FONT = 'system-ui, Roboto, "Segoe UI", Arial, sans-serif';
const KIND_COLOR = { moth: new THREE.Color('#ffb347'), urchin: new THREE.Color('#ff4fd8'), lumen: new THREE.Color('#4dffc3') };
const CYAN = new THREE.Color('#5fe4ff'), RED = new THREE.Color('#ff3b5c'), WHITE = new THREE.Color('#ffffff');
const settings = { moveSide: localStorage.getItem('swatfall.move') || 'left', sound: localStorage.getItem('swatfall.sound') !== 'off', desk: localStorage.getItem('swatfall.desk') !== 'off' };

let hitSource = null, deskSeen = 0, deskSnapped = false; const deskPt = new THREE.Vector3();

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local'); renderer.xr.setFoveation?.(1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.02, 60);
camera.position.set(0, 0.16, 0.24); camera.lookAt(0, -0.22, -0.68);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x2a1838, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(0.4, 1, 0.8); scene.add(sun);

// VR / desktop sky: gradient dome + stars (hidden in passthrough AR)
const sky = new THREE.Group(); scene.add(sky);
sky.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 p; void main(){ float h = p.y*.5+.5; vec3 c = mix(vec3(.02,.01,.05), vec3(.01,.03,.09), h); c += vec3(.25,.05,.3)*pow(max(0.,1.-abs(p.y+.15)*2.5),3.)*.35; gl_FragColor = vec4(c,1.); }' })));
{ const n = 700, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(15); v.y = Math.abs(v.y) * 0.9 - 2; pos.set(v.toArray(), i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sky.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false }))); }

const root = new THREE.Group(); scene.add(root);
// Play field: a tilted glass slab in front of a seated player. y runs up/away, z points back at the player.
const FIELD_Y = -0.30; const field = new THREE.Group(); field.position.set(0, FIELD_Y, -0.55); field.rotation.x = THREE.MathUtils.degToRad(-55); root.add(field);

const glow = A.glowTex(), ring = A.ringTex();
{ // plate + grid + glowing rails
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF_W + 0.05, TOP + 0.16), new THREE.MeshBasicMaterial({ color: 0x050a1c, transparent: true, opacity: 0.5, depthWrite: false }));
  plate.position.set(0, (TOP + 0.16) / 2 - 0.06, -0.006); plate.name = 'plate'; field.add(plate);
  const p = [], c = [], add = (x0, y0, x1, y1, col, k) => { p.push(x0, y0, 0, x1, y1, 0); for (let i = 0; i < 2; i++) c.push(col.r * k, col.g * k, col.b * k); };
  for (let x = -HALF_W; x <= HALF_W + 1e-6; x += 0.05) add(x, -0.04, x, TOP + 0.08, CYAN, 0.14);
  for (let y = 0; y <= TOP + 0.08; y += 0.05) add(-HALF_W, y, HALF_W, y, CYAN, 0.14);
  add(-HALF_W, FLOOR, HALF_W, FLOOR, RED, 0.8);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  field.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const strips = []; const strip = (w, h, x, y, rz = 0) => { const s = new THREE.PlaneGeometry(w, h); s.rotateZ(rz); s.translate(x, y, 0.001); strips.push(s); };
  strip(0.022, TOP + 0.14, -HALF_W - 0.006, (TOP + 0.14) / 2 - 0.05); strip(0.022, TOP + 0.14, HALF_W + 0.006, (TOP + 0.14) / 2 - 0.05);
  strip(0.018, 2 * HALF_W, 0, 0, Math.PI / 2);
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 4; const sx = sc.getContext('2d'); const gr = sx.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 4);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  field.add(new THREE.Mesh(mergeG(strips), A.additive(st, 0x5fe4ff, 0.75)));
}
function mergeG(list) { const pos = [], uv = []; for (const g of list) { const n = g.toNonIndexed(); pos.push(...n.attributes.position.array); uv.push(...n.attributes.uv.array); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; }

// ---------- swarm (instanced per species) ----------
const game = new Game(); game.best = +localStorage.getItem('swatfall.best') || 0;
const geos = { moth: A.mothGeo().scale(1.3, 1.3, 1.3), urchin: A.urchinGeo().scale(1.2, 1.2, 1.2), lumen: A.lumenGeo().scale(1.25, 1.25, 1.25) };
const swarm = {}, slotOf = [];
for (const k of ['moth', 'urchin', 'lumen']) {
  const n = game.aliens.filter(a => a.kind === k).length;
  const m = new THREE.InstancedMesh(geos[k], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.15, emissive: KIND_COLOR[k], emissiveIntensity: 0.45 }), n);
  m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); field.add(m); swarm[k] = { m, n: 0 };
}
for (const a of game.aliens) slotOf[a.i] = [swarm[a.kind].m, swarm[a.kind].n++];
// One shared additive halo pool: 0..31 aliens, 32..34 bolts, 35..48 bombs, 49 cannon
const HALO_BOLT = 32, HALO_BOMB = 35, HALO_CANNON = 49, HALO_N = 50;
const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), A.additive(glow, 0xffffff, 0.9), HALO_N);
halos.frustumCulled = false; halos.instanceMatrix.setUsage(THREE.DynamicDrawUsage); halos.setColorAt(0, WHITE); field.add(halos);
// Shot cores (bolts + bombs) share one instanced octahedron
const SHOT_N = game.bolts.length + game.bombs.length;
const shots = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), SHOT_N);
shots.frustumCulled = false; shots.setColorAt(0, WHITE); field.add(shots);
const cannon = new THREE.Mesh(A.cannonGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.3, emissive: CYAN, emissiveIntensity: 0.35 }));
field.add(cannon);

// ---------- FX: shards, rings, reticles, popups ----------
const SHARDS = 220, RINGS = 8, RETICLES = 4;
const shardMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.0045), new THREE.MeshBasicMaterial({ toneMapped: false }), SHARDS);
shardMesh.frustumCulled = false; shardMesh.setColorAt(0, WHITE); shardMesh.count = 0; field.add(shardMesh);
const shards = Array.from({ length: SHARDS }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), c: new THREE.Color() }));
const ringMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), A.additive(ring, 0xffffff, 1), RINGS);
ringMesh.frustumCulled = false; ringMesh.setColorAt(0, WHITE); ringMesh.count = 0; field.add(ringMesh);
const rings = Array.from({ length: RINGS }, () => ({ life: 0, max: 0.5, size: 0.1, p: new THREE.Vector3(), c: new THREE.Color() }));
const retMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), A.additive(ring, 0xff5c7a, 1), RETICLES);
retMesh.frustumCulled = false; retMesh.count = 0; field.add(retMesh);
let shardI = 0, ringI = 0;
function burst(x, y, z, color, n = 22, speed = 0.35, life = 0.7) {
  for (let k = 0; k < n; k++) { const s = shards[shardI = (shardI + 1) % SHARDS]; s.life = s.max = life * (0.6 + Math.random() * 0.6); s.p.set(x, y, z);
    s.v.randomDirection().multiplyScalar(speed * (0.3 + Math.random())); s.v.z = Math.abs(s.v.z) * 0.8; s.r.set(Math.random() * 6, Math.random() * 6, 0); s.c.copy(color).multiplyScalar(1.4); }
}
function shock(x, y, z, color, size = 0.12, life = 0.45) { const r = rings[ringI = (ringI + 1) % RINGS]; r.life = r.max = life; r.size = size; r.p.set(x, y, z); r.c.copy(color); }
const popups = Array.from({ length: 4 }, () => {
  const pnl = A.canvasPanel(0.24, 0.05, 512, (x, w, h, text, col) => { x.font = `800 ${h * 0.6}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = col; x.fillText(text, w / 2, h / 2); x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = 0.6; x.fillText(text, w / 2, h / 2); });
  pnl.mesh.visible = false; scene.add(pnl.mesh); return { ...pnl, life: 0, p: new THREE.Vector3() };
});
let popI = 0;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
function popup(text, color, fx, fy, fz) { const p = popups[popI = (popI + 1) % popups.length]; p.redraw(text, color); p.life = 1.0; p.p.set(fx, fy, fz).applyMatrix4(field.matrixWorld); p.mesh.visible = true; }

// ---------- HUD (world space, above the far edge of the field) ----------
let banner = '', bannerT = 0;
const hud = A.canvasPanel(0.62, 0.15, 1024, (x, w, h) => {
  x.font = `700 ${h * 0.26}px ${FONT}`; x.textBaseline = 'middle'; x.shadowColor = '#5fe4ff'; x.shadowBlur = 14;
  x.fillStyle = '#dff8ff'; x.textAlign = 'left'; x.fillText(`SCORE ${game.score}`, 16, h * 0.22);
  x.textAlign = 'center'; x.fillStyle = '#ffcf6b'; x.shadowColor = '#ff8a3d'; x.fillText(game.state === 'menu' ? 'SWATFALL' : `WAVE ${game.wave}`, w / 2, h * 0.22);
  x.textAlign = 'right'; x.fillStyle = '#dff8ff'; x.shadowColor = '#5fe4ff'; x.fillText(`BEST ${game.best}`, w - 16, h * 0.22);
  for (let i = 0; i < 3; i++) { const cx = w / 2 - 50 + i * 50, cy = h * 0.5; x.beginPath(); x.moveTo(cx, cy - 14); x.lineTo(cx + 12, cy); x.lineTo(cx, cy + 14); x.lineTo(cx - 12, cy); x.closePath(); x.fillStyle = i < game.lives ? '#5fe4ff' : 'rgba(95,228,255,0.15)'; x.fill(); }
  if (banner) { x.font = `800 ${h * 0.3}px ${FONT}`; x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.shadowColor = '#ff4fd8'; x.shadowBlur = 24; x.fillText(banner, w / 2, h * 0.82); }
});
hud.mesh.position.set(0, 0.075, -1.02); root.add(hud.mesh); let hudDirty = true;

// ---------- poke panels ----------
const PW = 0.40, PH = 0.31;
let screen = 'menu', hoverId = null;
function buttonsFor(s) {
  const B = (id, label, x, y, w = 0.16, h = 0.045, big = false) => ({ id, label, x, y, w, h, big });
  const ar = renderer.xr.isPresenting && hitSource;
  const row = ar ? [-0.128, 0, 0.128] : [-0.095, 0.095, 0], bw = ar ? 0.118 : 0.16;
  const swap = B('swap', `MOVE: ${settings.moveSide.toUpperCase()}`, row[1], -0.07, bw);
  const snd = B('sound', `SOUND: ${settings.sound ? 'ON' : 'OFF'}`, row[0], -0.07, bw);
  const desk = ar ? [B('desk', `DESK SNAP: ${settings.desk ? 'ON' : 'OFF'}`, row[2], -0.07, bw)] : [];
  if (s === 'menu') return [B('start', 'START', 0, -0.005, 0.2, 0.055, true), swap, snd, ...desk];
  if (s === 'paused') return [B('resume', 'RESUME', -0.095, -0.005, 0.16, 0.05, true), B('restart', 'RESTART', 0.095, -0.005), swap,
    renderer.xr.isPresenting ? B('exit', 'EXIT XR', row[0], -0.07, bw) : snd, ...desk];
  if (s === 'over') return [B('start', 'PLAY AGAIN', 0, -0.005, 0.2, 0.055, true), swap, snd, ...desk];
  return [];
}
let buttons = buttonsFor('menu');
const panel = A.canvasPanel(PW, PH, 1024, (x, w, h) => {
  const s = w / PW, X = v => (v + PW / 2) * s, Y = v => (PH / 2 - v) * s;
  x.fillStyle = 'rgba(6,10,26,0.86)'; A.roundRect(x, 4, 4, w - 8, h - 8, 36); x.fill(); x.lineWidth = 4; x.strokeStyle = 'rgba(95,228,255,0.7)'; x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const title = screen === 'menu' ? 'SWATFALL' : screen === 'paused' ? 'PAUSED' : 'THE SWARM GOT THROUGH';
  x.font = `800 ${screen === 'over' ? 52 : 86}px ${FONT}`; x.shadowColor = '#ff8a3d'; x.shadowBlur = 20; x.fillStyle = '#ffcf6b'; x.fillText(title, w / 2, Y(0.105)); x.shadowBlur = 0;
  x.font = `500 26px ${FONT}`; x.fillStyle = '#cfe6ff';
  const mv = settings.moveSide === 'left' ? 'LEFT' : 'RIGHT', fr = settings.moveSide === 'left' ? 'RIGHT' : 'LEFT';
  const sub = screen === 'over' ? `Score ${game.score}  ·  Wave ${game.wave}  ·  Best ${game.best}` : screen === 'paused' ? 'Poke a button with your fingertip' :
    `${mv} hand slides · ${fr} hand pinches to fire · swat divers · palm up pauses`;
  x.fillText(sub, w / 2, Y(0.058));
  if (screen === 'menu') { // three gesture "cards" under the buttons
    const cards = [[`${mv} HAND`, '◀  SLIDE  ▶', '#ffb347'], [`${fr} HAND`, 'PINCH = FIRE', '#5fe4ff'], ['EITHER HAND', 'SWAT DIVERS', '#ff5c7a']];
    cards.forEach(([a, b, c], i) => { const cx = X(-0.125 + i * 0.125), cy = Y(-0.122);
      x.font = `700 19px ${FONT}`; x.fillStyle = c; x.globalAlpha = 0.75; x.fillText(a, cx, cy - 14); x.globalAlpha = 1; x.font = `800 22px ${FONT}`; x.fillText(b, cx, cy + 12); });
  }
  for (const b of buttons) {
    const hov = hoverId === b.id; x.fillStyle = b.big ? (hov ? '#ffcf6b' : '#ff9d3d') : (hov ? '#5fe4ff' : 'rgba(95,228,255,0.18)');
    A.roundRect(x, X(b.x - b.w / 2), Y(b.y + b.h / 2), b.w * s, b.h * s, 18); x.fill(); x.lineWidth = 3; x.strokeStyle = b.big ? '#ffe2a8' : '#5fe4ff'; x.stroke();
    x.font = `800 ${b.big ? 40 : b.w < 0.13 ? 21 : 26}px ${FONT}`; x.fillStyle = b.big || hov ? '#140a00' : '#e8fbff'; x.fillText(b.label, X(b.x), Y(b.y) + 2);
  }
});
panel.mesh.position.set(0, -0.15, -0.40); panel.mesh.rotation.x = -0.45; root.add(panel.mesh); panel.redraw();
const pauseTile = A.canvasPanel(0.055, 0.055, 128, (x, w, h) => { x.fillStyle = 'rgba(6,10,26,0.8)'; A.roundRect(x, 4, 4, w - 8, h - 8, 22); x.fill(); x.strokeStyle = '#5fe4ff'; x.lineWidth = 5; x.stroke(); x.fillStyle = '#dff8ff'; x.fillRect(w * 0.33, h * 0.28, w * 0.11, h * 0.44); x.fillRect(w * 0.56, h * 0.28, w * 0.11, h * 0.44); });
pauseTile.mesh.position.set(0.3, -0.03, -0.47); pauseTile.mesh.lookAt(0, 0, 0); root.add(pauseTile.mesh); pauseTile.redraw(); pauseTile.mesh.visible = false;
const PAUSE_BTN = [{ id: 'pause', x: 0, y: 0, w: 0.055, h: 0.055 }];
function setScreen(s) { screen = s; buttons = buttonsFor(s); hoverId = null; panel.redraw(); panel.mesh.visible = s !== 'play'; pauseTile.mesh.visible = s === 'play'; hudDirty = true; }

// ---------- move rail + fire pad (feedback next to each hand) ----------
const railGroup = new THREE.Group(); root.add(railGroup);
const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55 })); rail.rotation.z = Math.PI / 2; railGroup.add(rail);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 10), new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a3d, emissiveIntensity: 0.8 })); railGroup.add(knob);
const firePad = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0025, 6, 32), new THREE.MeshBasicMaterial({ color: 0x5fe4ff, toneMapped: false })); firePad.rotation.x = -Math.PI / 2; root.add(firePad);
const RAIL_HALF = 0.15;
function placeRails() { const s = settings.moveSide === 'left' ? -1 : 1; const y = deskSnapped ? field.position.y + 0.04 : -0.38; railGroup.position.set(0.2 * s, y, -0.34); firePad.position.set(-0.2 * s, y, -0.34); }
placeRails();

// ---------- hands / controllers ----------
const JOINTS = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip', 'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip', 'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
const jointMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, toneMapped: false }), 50);
jointMesh.frustumCulled = false; jointMesh.setColorAt(0, WHITE); jointMesh.count = 0; scene.add(jointMesh);
const V = () => new THREE.Vector3();
const slots = [0, 1].map(i => {
  const s = { i, src: null, hand: renderer.xr.getHand(i), ctrl: renderer.xr.getController(i), pinch: false, thumb: false, trig: false, prevTrig: false, palmUp: false, pauseBtn: false,
    dwell: new G.Dwell(0.6, 1.5), pokers: { panel: new G.Poker(), pause: new G.Poker() }, ok: false,
    tip: V(), thumbTip: V(), palm: V(), wrist: V(), iMeta: V(), pMeta: V(), mTip: V(), iProx: V(), n: { x: 0, y: 0, z: 0 } };
  scene.add(s.hand); scene.add(s.ctrl);
  const on = e => { s.src = e.data; }, off = () => { s.src = null; s.ok = false; };
  s.hand.addEventListener('connected', on); s.hand.addEventListener('disconnected', off);
  s.ctrl.addEventListener('connected', on); s.ctrl.addEventListener('disconnected', off);
  return s;
});
function readSlot(s) {
  s.ok = false; const src = s.src; if (!src) return;
  if (src.hand) {
    const j = s.hand.joints; const get = (n, out) => { const o = j[n]; if (!o || !o.visible) return false; out.copy(o.position); return true; };
    s.ok = get('index-finger-tip', s.tip) && get('thumb-tip', s.thumbTip) && get('middle-finger-metacarpal', s.palm) && get('wrist', s.wrist)
      && get('index-finger-metacarpal', s.iMeta) && get('pinky-finger-metacarpal', s.pMeta) && get('middle-finger-tip', s.mTip) && get('index-finger-phalanx-proximal', s.iProx);
    if (!s.ok) { s.pinch = s.thumb = false; return; }
    s.pinch = G.updatePinch(s.pinch, s.thumbTip, s.tip);
    s.thumb = G.updateThumbDrop(s.thumb, s.thumbTip, s.iProx, s.tip, s.wrist);
    s.trig = s.pinch || s.thumb;
    G.palmNormal(s.wrist, s.iMeta, s.pMeta, src.handedness, s.n); s.palmUp = G.isPalmUp(s.n, s.wrist, s.mTip);
  } else if (src.gamepad) {
    s.ok = true; s.ctrl.updateMatrixWorld(); s.palm.setFromMatrixPosition(s.ctrl.matrixWorld);
    s.tip.set(0, 0, -0.05).applyMatrix4(s.ctrl.matrixWorld); s.wrist.copy(s.palm);
    const b = src.gamepad.buttons; s.trig = !!b[0]?.pressed; s.palmUp = !!(b[5]?.pressed || b[4]?.pressed);
  }
}

const dwellRing = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 32, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xffcf6b, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
dwellRing.visible = false; scene.add(dwellRing);

// ---------- audio ----------
const sound = new Sound(); sound.on = settings.sound;
const unlock = () => sound.unlock(); addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

// ---------- actions ----------
function act(id) {
  sound.click();
  if (id === 'start' || id === 'restart') { recenter(); game.reset(); setScreen('play'); }
  else if (id === 'resume') { game.state = 'play'; setScreen('play'); }
  else if (id === 'pause') pause();
  else if (id === 'swap') { settings.moveSide = settings.moveSide === 'left' ? 'right' : 'left'; localStorage.setItem('swatfall.move', settings.moveSide); placeRails(); buttons = buttonsFor(screen); panel.redraw(); }
  else if (id === 'sound') { settings.sound = !settings.sound; sound.on = settings.sound; localStorage.setItem('swatfall.sound', settings.sound ? 'on' : 'off'); buttons = buttonsFor(screen); panel.redraw(); }
  else if (id === 'desk') { settings.desk = !settings.desk; localStorage.setItem('swatfall.desk', settings.desk ? 'on' : 'off'); buttons = buttonsFor(screen); panel.redraw(); }
  else if (id === 'exit') renderer.xr.getSession()?.end();
}
// Re-anchor the whole play space to the player's current head position + facing (XR only), so the
// field always sits ~30 cm below the eyes and ~55 cm ahead however they are seated.
function recenter() {
  if (!renderer.xr.isPresenting) return;
  const cam = renderer.xr.getCamera(); cam.getWorldPosition(_v2); cam.getWorldDirection(_v); 
  root.position.copy(_v2); root.rotation.set(0, Math.atan2(-_v.x, -_v.z), 0); root.updateMatrixWorld(true);
  // Desk snap: if passthrough hit-test found a real tabletop in front of and below the player, rest the
  // emitter rail on it so the swarm launches off the actual desk. Otherwise keep the default height.
  field.position.y = FIELD_Y; deskSnapped = false;
  if (settings.desk && deskSeen > 0) { const dy = deskPt.y - _v2.y; if (dy > -0.6 && dy < -0.18) { field.position.y = dy + 0.02; deskSnapped = true; } }
  placeRails();
}
function pause() { if (game.state !== 'play') return; game.state = 'paused'; setScreen('paused'); }

// ---------- desktop input ----------
const keys = {}; let mouseX = null, deskFire = false;
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyP' || e.code === 'Escape') { if (game.state === 'play') pause(); else if (game.state === 'paused') act('resume'); } if (e.code === 'Enter' && screen !== 'play') act(buttons[0].id); });
addEventListener('keyup', e => { keys[e.code] = false; });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', e => { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseX = ndc.x;
  if (panel.mesh.visible) { const id = pickPanel(panel.mesh, buttons, PW, PH); if (id !== hoverId) { hoverId = id; panel.redraw(); } } });
renderer.domElement.addEventListener('pointerdown', e => {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (panel.mesh.visible) { const id = pickPanel(panel.mesh, buttons, PW, PH); if (id) act(id); return; }
  if (pauseTile.mesh.visible && pickPanel(pauseTile.mesh, PAUSE_BTN, 0.055, 0.055)) { act('pause'); return; }
  if (game.state === 'play') { // click a diver to swat it, else fire
    ray.setFromCamera(ndc, camera); _m.copy(field.matrixWorld).invert(); const o = ray.ray.origin.clone().applyMatrix4(_m), d = ray.ray.direction.clone().transformDirection(_m);
    for (const a of game.aliens) if (a.alive && a.dive) { _v.set(a.x, a.y, a.z).sub(o); const t = _v.dot(d); if (_v.lengthSq() - t * t < 0.03 * 0.03) { game.swat([{ x: a.x, y: a.y, z: a.z }]); return; } }
    deskFire = true;
  }
});
addEventListener('pointerup', () => { deskFire = false; });
function pickPanel(mesh, btns, w, h) {
  ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(mesh)[0]; if (!hit) return null;
  const b = G.hitButton({ x: (hit.uv.x - 0.5) * w, y: (hit.uv.y - 0.5) * h }, btns, 0); return b ? b.id : null;
}

// ---------- XR session buttons ----------
const xrDiv = document.getElementById('xr'); let xrMode = null;
async function addXR(mode, label) {
  const b = document.createElement('button'); b.textContent = label; b.disabled = true; xrDiv.appendChild(b);
  if (!navigator.xr || !(await navigator.xr.isSessionSupported(mode).catch(() => false))) { b.textContent = label + ' (not available)'; return; }
  b.disabled = false;
  b.onclick = async () => {
    sound.unlock();
    try { const session = await navigator.xr.requestSession(mode, { optionalFeatures: ['hand-tracking', 'hit-test'] }); xrMode = mode; await renderer.xr.setSession(session); }
    catch (err) { document.getElementById('stat').textContent = 'XR error: ' + err.message; }
  };
}
addXR('immersive-ar', 'Enter AR (passthrough)'); addXR('immersive-vr', 'Enter VR');
renderer.xr.addEventListener('sessionstart', () => { sky.visible = xrMode !== 'immersive-ar'; document.getElementById('overlay').style.display = 'none'; if (game.state === 'play') pause(); });
renderer.xr.addEventListener('sessionend', () => { root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); sky.visible = true; document.getElementById('overlay').style.display = ''; for (const s of slots) s.src = null; if (game.state === 'play') pause(); });

// ---------- passthrough desk detection (WebXR hit-test, AR only, optional) ----------
const deskRing = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.058, 40), new THREE.MeshBasicMaterial({ color: 0x5fe4ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
deskRing.rotation.x = -Math.PI / 2; deskRing.visible = false; scene.add(deskRing);
renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession(); if (xrMode !== 'immersive-ar' || !session.requestHitTestSource) return;
  try { const viewer = await session.requestReferenceSpace('viewer'); hitSource = await session.requestHitTestSource({ space: viewer }); buttons = buttonsFor(screen); panel.redraw(); }
  catch (e) { hitSource = null; }
});
renderer.xr.addEventListener('sessionend', () => { hitSource = null; deskSeen = 0; deskRing.visible = false; field.position.y = FIELD_Y; deskSnapped = false; placeRails(); });
function updateDesk(dt) {
  deskSeen = Math.max(0, deskSeen - dt); const frame = renderer.xr.getFrame?.();
  if (hitSource && frame) {
    const r = frame.getHitTestResults(hitSource); const pose = r.length ? r[0].getPose(renderer.xr.getReferenceSpace()) : null;
    if (pose) { const o = pose.transform.position, q = pose.transform.orientation; _q.set(q.x, q.y, q.z, q.w); _v.set(0, 1, 0).applyQuaternion(_q);
      renderer.xr.getCamera().getWorldPosition(_v2); const dy = o.y - _v2.y, dh = Math.hypot(o.x - _v2.x, o.z - _v2.z);
      if (_v.y > 0.9 && dy > -0.6 && dy < -0.18 && dh < 1.2) { deskPt.set(o.x, o.y, o.z); deskSeen = 1.5; } }
  }
  deskRing.visible = settings.desk && deskSeen > 0 && screen !== 'play';
  if (deskRing.visible) { deskRing.position.copy(deskPt).y += 0.003; deskRing.scale.setScalar(1 + 0.1 * Math.sin(clock.elapsedTime * 4)); }
}

// ---------- events -> fx/audio ----------
function handleEvents() {
  for (const e of game.events) {
    const col = KIND_COLOR[e.kind] || CYAN;
    switch (e.type) {
      case 'fire': sound.zap(); firePad.scale.setScalar(1.6); break;
      case 'kill': burst(e.x, e.y, e.z, col, 22); shock(e.x, e.y, e.z, col, 0.09); sound.pop(e.kind); hudDirty = true; break;
      case 'swat': burst(e.x, e.y, e.z, col, 48, 0.6, 0.9); shock(e.x, e.y, e.z, WHITE, 0.22, 0.55); sound.swat(); popup(`SWAT! +${e.v}`, '#ffcf6b', e.x, e.y, e.z + 0.03); hudDirty = true; break;
      case 'hurt': burst(e.x, 0.01, 0.01, RED, 50, 0.5, 0.9); shock(e.x, 0.01, 0.01, RED, 0.25, 0.6); sound.hurt(); flashT = 0.5; hudDirty = true; break;
      case 'wave': banner = e.v === 1 ? 'WAVE 1 · PINCH TO FIRE' : `WAVE ${e.v}`; bannerT = 1.8; sound.wave(); hudDirty = true; break;
      case 'clear': shock(0, TOP - 0.1, 0, CYAN, 0.6, 0.8); break;
      case 'dive': sound.dive(); break;
      case 'hover': popup('SWAT IT!', '#ff5c7a', e.x, e.y + 0.04, e.z); break;
      case 'strike': sound.strike(); break;
      case 'sting': case 'miss': burst(e.x, 0.01, 0.01, KIND_COLOR.moth, 20); break;
      case 'bomb': sound.bomb(); break;
      case 'intercept': burst(e.x, e.y, 0, WHITE, 10, 0.2, 0.4); sound.intercept(); hudDirty = true; break;
      case 'over': localStorage.setItem('swatfall.best', game.best); sound.over(); banner = ''; setScreen('over'); break;
    }
  }
  game.events.length = 0;
}
let flashT = 0;

// ---------- frame ----------
const clock = new THREE.Clock(); let fpsT = 0, fpsN = 0, fps = 0;
const fieldInv = new THREE.Matrix4(), swatPts = [V(), V(), V(), V()], swatList = [null, null, null, null];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const plate = field.getObjectByName('plate');
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;
  fpsT += dt; fpsN++; if (fpsT > 1) { fps = Math.round(fpsN / fpsT); fpsT = fpsN = 0; }
  field.updateMatrixWorld(); fieldInv.copy(field.matrixWorld).invert();
  const xr = renderer.xr.isPresenting;
  if (xr) updateDesk(dt);
  // --- read hands
  let jn = 0, moveSlot = null, fireSlot = null, dwellShown = false;
  for (const s of slots) {
    readSlot(s); if (!s.ok) continue;
    const role = s.src.handedness === settings.moveSide ? 'move' : 'fire';
    if (role === 'move') moveSlot = s; else fireSlot = s;
    if (s.src.hand) {
      _c.copy(role === 'move' ? KIND_COLOR.moth : CYAN); if (s.trig) _c.copy(WHITE);
      for (const n of JOINTS) { const o = s.hand.joints[n]; if (!o || !o.visible) continue; const r = (o.jointRadius || 0.008) * (n.endsWith('tip') ? 1.1 : 0.8);
        _m.compose(o.position, _q.identity(), _s.setScalar(r)); jointMesh.setMatrixAt(jn, _m); jointMesh.setColorAt(jn, _c); jn++; }
    }
    // pokes on visible panels
    const pokeP = panel.mesh.visible ? s.pokers.panel.update(panel.mesh.worldToLocal(_v.copy(s.tip)), buttons, dt) : s.pokers.panel.update(null, buttons, dt);
    if (panel.mesh.visible && s.pokers.panel.hover !== hoverId && xr) { hoverId = s.pokers.panel.hover; panel.redraw(); }
    if (pokeP) { act(pokeP); continue; }
    const pokeT = pauseTile.mesh.visible ? s.pokers.pause.update(pauseTile.mesh.worldToLocal(_v.copy(s.tip)), PAUSE_BTN, dt) : s.pokers.pause.update(null, PAUSE_BTN, dt);
    if (pokeT) act(pokeT);
    if (s.dwell.update(s.palmUp && game.state === 'play', dt)) pause();
    if (s.src.hand && s.dwell.progress > 0.15) { dwellShown = true; dwellRing.visible = true; dwellRing.position.copy(s.palm).y += 0.06; dwellRing.rotation.set(-Math.PI / 2, 0, 0); dwellRing.scale.setScalar(0.4 + 0.6 * s.dwell.progress); dwellRing.material.opacity = s.dwell.progress; }
  }
  if (!dwellShown) dwellRing.visible = false;
  jointMesh.count = jn; jointMesh.instanceMatrix.needsUpdate = true; if (jointMesh.instanceColor) jointMesh.instanceColor.needsUpdate = true;
  // --- gameplay input
  if (game.state === 'play') {
    let target = game.cannonX;
    if (moveSlot) { root.worldToLocal(_v.copy(moveSlot.palm)); const ux = (_v.x - railGroup.position.x) / RAIL_HALF; target = THREE.MathUtils.clamp(ux, -1, 1) * (HALF_W - 0.03); }
    else if (!xr) { if (keys.ArrowLeft || keys.KeyA) mouseX = null, target -= 0.6 * dt; if (keys.ArrowRight || keys.KeyD) mouseX = null, target += 0.6 * dt; if (mouseX !== null) target = THREE.MathUtils.clamp(mouseX * 1.25, -1, 1) * (HALF_W - 0.03); }
    game.setCannon(game.cannonX + (target - game.cannonX) * Math.min(1, dt * 16));
    if ((fireSlot && fireSlot.trig) || (!xr && (keys.Space || deskFire))) game.fire();
    let k = 0; for (const s of slots) if (s.ok) { swatList[k] = swatPts[k].copy(s.tip).applyMatrix4(fieldInv); k++; swatList[k] = swatPts[k].copy(s.palm).applyMatrix4(fieldInv); k++; }
    for (; k < 4; k++) swatList[k] = null;
    game.swat(swatList);
  }
  knob.position.x = game.cannonX / (HALF_W - 0.03) * RAIL_HALF;
  firePad.scale.lerp(_s.setScalar(fireSlot?.trig ? 1.25 : 1), Math.min(1, dt * 10));
  game.update(dt); handleEvents();
  sound.tempo = 1 + 0.8 * (1 - game.aliveCount() / (COLS * ROWS)); sound.music(game.state === 'play', dt);
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) { banner = ''; hudDirty = true; } }
  if (hudDirty) { hud.redraw(); hudDirty = false; }
  // --- draw swarm + halos (billboarded toward the camera, in field space)
  const cam = xr ? renderer.xr.getCamera() : camera; cam.getWorldQuaternion(_q2); field.getWorldQuaternion(_q).invert(); _q.multiply(_q2);
  for (const a of game.aliens) {
    const [mesh, idx] = slotOf[a.i];
    if (!a.alive) { mesh.setMatrixAt(idx, ZERO); halos.setMatrixAt(a.i, ZERO); continue; }
    const flap = a.kind === 'moth' ? 1 + 0.22 * Math.sin(a.phase * 4) : 1, sc = a.dive ? 1.45 : 1;
    _e.set(a.dive ? 0.6 : 0.25, a.kind === 'urchin' ? a.phase * 0.6 : 0, a.dive ? Math.sin(a.phase * 2) * 0.3 : 0);
    _m.compose(_v.set(a.x, a.y, a.z + 0.01), _q2.setFromEuler(_e), _s.set(sc * flap, sc, sc)); mesh.setMatrixAt(idx, _m);
    _m.compose(_v, _q, _s.setScalar((a.dive ? 0.11 : 0.06) * (1 + 0.08 * Math.sin(a.phase * 2)))); halos.setMatrixAt(a.i, _m); halos.setColorAt(a.i, _c.copy(KIND_COLOR[a.kind]).multiplyScalar(a.dive ? 0.9 : 0.5));
  }
  for (const k in swarm) swarm[k].m.instanceMatrix.needsUpdate = true;
  let si = 0;
  game.bolts.forEach((b, i) => { if (b.on) { _m.compose(_v.set(b.x, b.y, 0.01), _q2.identity(), _s.set(0.0035, 0.018, 0.0035)); shots.setMatrixAt(si, _m); shots.setColorAt(si++, _c.setRGB(0.75, 1.0, 1.0));
    _m.compose(_v, _q, _s.setScalar(0.05)); halos.setMatrixAt(HALO_BOLT + i, _m); halos.setColorAt(HALO_BOLT + i, CYAN); } else halos.setMatrixAt(HALO_BOLT + i, ZERO); });
  game.bombs.forEach((b, i) => { if (b.on) { _e.set(t * 6, t * 4, 0); _m.compose(_v.set(b.x, b.y, 0.01), _q2.setFromEuler(_e), _s.setScalar(0.0065)); shots.setMatrixAt(si, _m); shots.setColorAt(si++, _c.setRGB(1, 0.3, 0.45));
    _m.compose(_v, _q, _s.setScalar(0.04)); halos.setMatrixAt(HALO_BOMB + i, _m); halos.setColorAt(HALO_BOMB + i, RED); } else halos.setMatrixAt(HALO_BOMB + i, ZERO); });
  shots.count = si; shots.instanceMatrix.needsUpdate = true; if (shots.instanceColor) shots.instanceColor.needsUpdate = true;
  const blink = game.invuln > 0 && Math.sin(t * 40) > 0;
  cannon.position.set(game.cannonX, 0, 0.012); cannon.visible = !blink; cannon.rotation.z = (game.cannonX - (cannon.userData.px ?? 0)) * -8; cannon.userData.px = game.cannonX;
  _m.compose(_v.set(game.cannonX, 0.01, 0.015), _q, _s.setScalar(0.09)); halos.setMatrixAt(HALO_CANNON, blink ? ZERO : _m); halos.setColorAt(HALO_CANNON, CYAN);
  halos.instanceMatrix.needsUpdate = true; if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
  // --- reticles around hovering divers
  let ri = 0; for (const a of game.aliens) if (a.alive && a.dive && ri < RETICLES) { const s = a.dive.stage === 'hover' ? 0.13 + 0.02 * Math.sin(t * 10) : 0.1; _m.compose(_v.set(a.x, a.y, a.z), _q, _s.setScalar(s)); retMesh.setMatrixAt(ri++, _m); }
  retMesh.count = ri; retMesh.instanceMatrix.needsUpdate = true;
  // --- fx
  let n = 0;
  for (const s of shards) { if (s.life <= 0) continue; s.life -= dt; if (s.life <= 0) continue; s.v.multiplyScalar(1 - 1.8 * dt); s.p.addScaledVector(s.v, dt); s.r.x += dt * 9; s.r.y += dt * 7;
    const k = s.life / s.max; _m.compose(s.p, _q2.setFromEuler(s.r), _s.setScalar(0.5 + k)); shardMesh.setMatrixAt(n, _m); shardMesh.setColorAt(n++, _c.copy(s.c).multiplyScalar(k)); }
  shardMesh.count = n; shardMesh.instanceMatrix.needsUpdate = true; if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
  n = 0; for (const r of rings) { if (r.life <= 0) continue; r.life -= dt; if (r.life <= 0) continue; const k = 1 - r.life / r.max, e = 1 - Math.pow(1 - k, 3);
    _m.compose(r.p, _q, _s.setScalar(0.01 + r.size * e)); ringMesh.setMatrixAt(n, _m); ringMesh.setColorAt(n++, _c.copy(r.c).multiplyScalar(1 - k)); }
  ringMesh.count = n; ringMesh.instanceMatrix.needsUpdate = true; if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
  for (const p of popups) { if (!p.mesh.visible) continue; p.life -= dt; if (p.life <= 0) { p.mesh.visible = false; continue; } p.p.y += dt * 0.05; p.mesh.position.copy(p.p); cam.getWorldPosition(_v2); p.mesh.lookAt(_v2); p.mesh.material.opacity = Math.min(1, p.life * 2.5); }
  if (flashT > 0) { flashT -= dt; plate.material.color.setRGB(0.02 + flashT * 0.6, 0.04, 0.11); } else plate.material.color.setHex(0x050a1c);
  renderer.render(scene, camera);
  window.__swat.calls = renderer.info.render.calls; window.__swat.tris = renderer.info.render.triangles; window.__swat.fps = fps;
}
window.__swat = { game, camera, act, setScreen, renderer, scene, burst, shock, popup, slots, panel, pauseTile, field, root, THREE: { Vector3: THREE.Vector3, Object3D: THREE.Object3D }, get buttons() { return buttons; }, get screen() { return screen; } };
setScreen('menu');
renderer.setAnimationLoop(tick);
