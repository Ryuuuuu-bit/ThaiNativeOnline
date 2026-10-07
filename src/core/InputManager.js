// Keyboard, mouse and touch input. Movement keys (and the touch joystick,
// src/ui/TouchControls.js → setStick) are polled each frame; actions are
// dispatched as named events.
const MOVE = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
const ACTIONS = { KeyR: 'resetCamera', KeyH: 'photo', KeyE: 'interact', KeyM: 'map', Escape: 'escape', F3: 'debug' };
// + / − zoom the camera (held keys repeat).
const ZOOM_KEYS = { Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1 };

export class InputManager {
  constructor(host) {
    this.host = host; this.keys = new Set(); this.handlers = {}; this.pan = null; this.shift = false;
    this.stick = { x: 0, y: 0, run: false };
    window.addEventListener('keydown', e => {
      // Escape closes panels even while a settings control has focus.
      if (e.code === 'Escape' && !e.repeat) return this.emit('escape');
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (MOVE[e.code]) { e.preventDefault(); this.keys.add(MOVE[e.code]); this.emit('move'); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = true;
      if (ZOOM_KEYS[e.code]) { e.preventDefault(); this.emit('zoomStep', ZOOM_KEYS[e.code]); }
      if (!e.repeat && ACTIONS[e.code]) { if (e.code === 'F3') e.preventDefault(); this.emit(ACTIONS[e.code]); }
    });
    window.addEventListener('keyup', e => {
      if (MOVE[e.code]) this.keys.delete(MOVE[e.code]);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.pan = null; this.shift = false; });
    document.addEventListener('visibilitychange', () => this.keys.clear());
    host.addEventListener('contextmenu', e => e.preventDefault());
    // Two-finger pinch zooms on touch screens: 'zoomBy' gets the distance ratio since the last move.
    const touches = new Map(); let pinch = 0;
    const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    host.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) pinch = spread(); } }, true);
    host.addEventListener('pointermove', e => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch) { const d = spread(); if (d > 0) { this.emit('zoomBy', d / pinch); pinch = d; } }
    });
    for (const name of ['pointerup', 'pointercancel']) host.addEventListener(name, e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; });
    host.addEventListener('pointerdown', e => {
      if (touches.size > 1) return;   // the second finger of a pinch is not a click
      if (e.button === 2) { this.pan = { x: e.clientX, y: e.clientY }; host.setPointerCapture(e.pointerId); this.emit('panStart'); }
      // A click the combat layer consumed (a monster) must not also start a ground walk.
      else if (e.button === 0 && !e.cancelBubble) this.emit('click', e);
    });
    host.addEventListener('pointermove', e => { if (this.pan) this.emit('pan', e.clientX - this.pan.x, e.clientY - this.pan.y); });
    for (const name of ['pointerup', 'pointercancel']) host.addEventListener(name, () => { this.pan = null; });
    host.addEventListener('wheel', e => { e.preventDefault(); this.emit('zoom', e.deltaY); }, { passive: false });
  }
  // Running: Shift held, or the joystick pushed to its rim.
  get running() { return this.shift || this.stick.run; }
  // The touch joystick: x right, y down (screen), each -1..1; a push from rest counts as a move key.
  setStick(x, y, run = false) {
    const was = this.stick.x || this.stick.y;
    Object.assign(this.stick, { x, y, run: run && !!(x || y) });
    if (!was && (x || y)) this.emit('move');
  }
  on(name, fn) { (this.handlers[name] ??= []).push(fn); }
  emit(name, ...args) { for (const fn of this.handlers[name] ?? []) fn(...args); }
  direction(forward, right, out) {
    out.set(0, 0, 0);
    if (this.keys.has('up')) out.add(forward);
    if (this.keys.has('down')) out.sub(forward);
    if (this.keys.has('right')) out.add(right);
    if (this.keys.has('left')) out.sub(right);
    if (this.stick.x || this.stick.y) out.addScaledVector(right, this.stick.x).addScaledVector(forward, -this.stick.y);
    return out.lengthSq() ? out.normalize() : out;
  }
}
