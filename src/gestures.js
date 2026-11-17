// Pure hand-gesture logic for SWATFALL. No three.js dependency so it can be unit-tested with
// synthetic joint data. Inputs are any {x,y,z} objects (THREE.Vector3 works). Distances in metres.
// Thresholds are initial values, NOT yet tuned on a real Quest.
export const PINCH_ON = 0.018, PINCH_OFF = 0.032;
export const THUMB_ON = 0.028, THUMB_OFF = 0.045, INDEX_EXTENDED = 0.12;
export const PALM_UP_DOT = 0.7, FINGERS_OPEN = 0.12;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Pinch with hysteresis: engage under PINCH_ON, release over PINCH_OFF.
export function updatePinch(prev, thumbTip, indexTip) {
  const d = dist(thumbTip, indexTip);
  return prev ? d < PINCH_OFF : d < PINCH_ON;
}

// Finger-gun trigger: index finger extended away from the wrist, thumb tip dropped onto the
// side of the index/middle knuckle. Hysteresis on the thumb distance.
export function updateThumbDrop(prev, thumbTip, indexProximal, indexTip, wrist) {
  if (dist(indexTip, wrist) < INDEX_EXTENDED) return false;
  const d = dist(thumbTip, indexProximal);
  return prev ? d < THUMB_OFF : d < THUMB_ON;
}

// Unit normal pointing OUT OF THE PALM. handedness 'left' | 'right'.
export function palmNormal(wrist, indexMeta, pinkyMeta, handedness, out = { x: 0, y: 0, z: 0 }) {
  const ax = indexMeta.x - wrist.x, ay = indexMeta.y - wrist.y, az = indexMeta.z - wrist.z;
  const bx = pinkyMeta.x - wrist.x, by = pinkyMeta.y - wrist.y, bz = pinkyMeta.z - wrist.z;
  // right hand: a x b ; left hand: b x a
  let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
  if (handedness === 'left') { x = -x; y = -y; z = -z; }
  const l = Math.hypot(x, y, z) || 1;
  out.x = x / l; out.y = y / l; out.z = z / l; return out;
}

export function isPalmUp(normal, wrist, middleTip) {
  return normal.y > PALM_UP_DOT && dist(middleTip, wrist) > FINGERS_OPEN;
}

// Hold-to-trigger with cooldown. update() returns true exactly once per completed dwell.
export class Dwell {
  constructor(hold = 0.6, cool = 1.5) { this.hold = hold; this.cool = cool; this.t = 0; this.cd = 0; this.latched = false; }
  update(active, dt) {
    this.cd = Math.max(0, this.cd - dt);
    if (!active) { this.t = 0; this.latched = false; return false; }
    if (this.latched || this.cd > 0) return false;
    this.t += dt;
    if (this.t >= this.hold) { this.t = 0; this.latched = true; this.cd = this.cool; return true; }
    return false;
  }
  get progress() { return Math.min(1, this.t / this.hold); }
}

// Poke a flat panel. `local` is the fingertip in panel space (x right, y up, z out of the face,
// metres). Buttons: [{id, x, y, w, h}] centred rects. A press fires when the tip enters from in
// front (z > ARM) and crosses the surface (z < PRESS) inside a button. Re-arms once the tip
// backs off in front of the panel again. Debounced.
export const POKE_ARM = 0.015, POKE_PRESS = 0.003, POKE_DEPTH = 0.05, POKE_DEBOUNCE = 0.35;
export function hitButton(local, buttons, pad = 0.006) {
  for (const b of buttons) if (Math.abs(local.x - b.x) <= b.w / 2 + pad && Math.abs(local.y - b.y) <= b.h / 2 + pad) return b;
  return null;
}
export class Poker {
  constructor() { this.armed = false; this.cool = 0; this.hover = null; }
  update(local, buttons, dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (!local) { this.armed = false; this.hover = null; return null; }
    const b = hitButton(local, buttons);
    this.hover = b && local.z < 0.08 && local.z > -POKE_DEPTH ? b.id : null;
    if (!b || local.z < -POKE_DEPTH) { this.armed = false; return null; }
    if (local.z > POKE_ARM) { this.armed = true; return null; }
    if (this.armed && local.z < POKE_PRESS && this.cool === 0) { this.armed = false; this.cool = POKE_DEBOUNCE; return b.id; }
    return null;
  }
}
