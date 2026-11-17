// Procedural low-poly art for SWATFALL. All original; no external assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const C = c => new THREE.Color(c);
function part(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count, col = new Float32Array(n * 3), cc = C(color);
  for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function tri(a, b, c, th = 0.002) { // thin double-sided wing panel
  const g = new THREE.BufferGeometry(); const p = [...a, ...b, ...c, ...c, ...b, ...a];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}
const merge = parts => { const g = mergeGeometries(parts); g.computeVertexNormals(); g.computeBoundingSphere(); return g; };

// Glowmoth: faceted spindle body, two swept crystal wing pairs, antenna spurs. ~0.04 m wide.
export function mothGeo() {
  return merge([
    part(new THREE.OctahedronGeometry(0.009), '#ffcf6b', M(0, 0, 0, 0, 0, 0, 0.8, 1.7, 0.8)),
    part(new THREE.OctahedronGeometry(0.005), '#fff2c4', M(0, 0.013, 0.003)),
    part(tri([0.003, 0.004, 0], [0.024, 0.016, 0.004], [0.02, -0.004, 0.002]), '#ff8a3d'),
    part(tri([-0.003, 0.004, 0], [-0.024, 0.016, 0.004], [-0.02, -0.004, 0.002]), '#ff8a3d'),
    part(tri([0.003, -0.004, 0], [0.017, -0.016, 0.004], [0.006, -0.018, 0.002]), '#ffb347'),
    part(tri([-0.003, -0.004, 0], [-0.017, -0.016, 0.004], [-0.006, -0.018, 0.002]), '#ffb347'),
    part(new THREE.ConeGeometry(0.0015, 0.012, 3), '#fff2c4', M(0.004, 0.022, 0.002, 0, 0, -0.5)),
    part(new THREE.ConeGeometry(0.0015, 0.012, 3), '#fff2c4', M(-0.004, 0.022, 0.002, 0, 0, 0.5)),
  ]);
}
// Urchin: icosahedral core with a spike on every vertex and a bright "eye" facet toward the player.
export function urchinGeo() {
  const core = new THREE.IcosahedronGeometry(0.011, 0); const parts = [part(core.clone(), '#ff4fd8')];
  const pos = core.attributes.position, seen = new Set(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize(); const k = v.toArray().map(n => n.toFixed(3)).join(); if (seen.has(k)) continue; seen.add(k);
    q.setFromUnitVectors(up, v); const m = new THREE.Matrix4().compose(v.clone().multiplyScalar(0.016), q, new THREE.Vector3(1, 1, 1));
    parts.push(part(new THREE.ConeGeometry(0.0028, 0.012, 4), '#ffa6ef', m));
  }
  parts.push(part(new THREE.OctahedronGeometry(0.004), '#ffffff', M(0, 0, 0.011)));
  return merge(parts);
}
// Lumen: faceted bell with a crown gem and four hanging crystal tendrils (point toward the player's side of the field).
export function lumenGeo() {
  const parts = [part(new THREE.SphereGeometry(0.014, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#5cffc8', M(0, -0.002, 0, Math.PI / 2 * 0, 0, 0, 1, 0.9, 1))];
  parts.push(part(new THREE.CylinderGeometry(0.014, 0.011, 0.004, 7, 1, true), '#2fd6ff', M(0, -0.004, 0)));
  parts.push(part(new THREE.OctahedronGeometry(0.0045), '#e9fffb', M(0, 0.015, 0)));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; parts.push(part(new THREE.ConeGeometry(0.0025, 0.016, 3), '#9effe6', M(Math.cos(a) * 0.007, -0.013, Math.sin(a) * 0.007, Math.PI, 0, 0))); }
  return merge(parts);
}
// Player emitter: hexagonal hover-sled with side fins and a tall crystal prism.
export function cannonGeo() {
  return merge([
    part(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 6), '#1b2a4a', M(0, 0, 0, Math.PI / 2, Math.PI / 6, 0)),
    part(new THREE.CylinderGeometry(0.022, 0.03, 0.006, 6), '#5fe4ff', M(0, 0, 0.009, Math.PI / 2, Math.PI / 6, 0)),
    part(new THREE.OctahedronGeometry(0.012), '#d8fbff', M(0, 0.016, 0.016, 0, 0, 0, 0.7, 1.8, 0.7)),
    part(new THREE.BoxGeometry(0.03, 0.006, 0.004), '#5fe4ff', M(0.036, -0.004, 0.004, 0, 0, 0.35)),
    part(new THREE.BoxGeometry(0.03, 0.006, 0.004), '#5fe4ff', M(-0.036, -0.004, 0.004, 0, 0, -0.35)),
  ]);
}
export function glowTex(inner = 'rgba(255,255,255,1)', size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(0.6, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function ringTex(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const additive = (map, color = 0xffffff, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// Canvas-backed text panel. draw(ctx, w, h) callback repaints; returns {mesh, redraw}.
export function canvasPanel(wm, hm, px = 1024, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * hm / wm); const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, ...opts });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), mat);
  const redraw = (...a) => { ctx.clearRect(0, 0, c.width, c.height); draw(ctx, c.width, c.height, ...a); tex.needsUpdate = true; };
  return { mesh, redraw, ctx, canvas: c, s: c.width / wm };
}
export function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
