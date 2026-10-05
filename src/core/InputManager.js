// Keyboard, mouse and touch input. Movement keys are polled each frame;
// actions are dispatched as named events.
const MOVE = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
const ACTIONS = { KeyR: 'resetCamera', KeyH: 'photo', KeyE: 'interact', KeyM: 'map', Escape: 'escape', F3: 'debug' };

export class InputManager {
  constructor(host) {
    this.host = host; this.keys = new Set(); this.handlers = {}; this.pan = null; this.running = false;
    window.addEventListener('keydown', e => {
      // Escape closes panels even while a settings control has focus.
      if (e.code === 'Escape' && !e.repeat) return this.emit('escape');
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (MOVE[e.code]) { e.preventDefault(); this.keys.add(MOVE[e.code]); this.emit('move'); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.running = true;
      if (!e.repeat && ACTIONS[e.code]) { if (e.code === 'F3') e.preventDefault(); this.emit(ACTIONS[e.code]); }
    });
    window.addEventListener('keyup', e => {
      if (MOVE[e.code]) this.keys.delete(MOVE[e.code]);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.running = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.pan = null; this.running = false; });
    document.addEventListener('visibilitychange', () => this.keys.clear());
    host.addEventListener('contextmenu', e => e.preventDefault());
    host.addEventListener('pointerdown', e => {
      if (e.button === 2) { this.pan = { x: e.clientX, y: e.clientY }; host.setPointerCapture(e.pointerId); this.emit('panStart'); }
      // A click the combat layer consumed (a monster) must not also start a ground walk.
      else if (e.button === 0 && !e.cancelBubble) this.emit('click', e);
    });
    host.addEventListener('pointermove', e => { if (this.pan) this.emit('pan', e.clientX - this.pan.x, e.clientY - this.pan.y); });
    for (const name of ['pointerup', 'pointercancel']) host.addEventListener(name, () => { this.pan = null; });
    host.addEventListener('wheel', e => { e.preventDefault(); this.emit('zoom', e.deltaY); }, { passive: false });
    for (const button of document.querySelectorAll('[data-move]')) {
      const dir = button.dataset.move;
      button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); this.keys.add(dir); this.emit('move'); });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => this.keys.delete(dir));
    }
  }
  on(name, fn) { (this.handlers[name] ??= []).push(fn); }
  emit(name, ...args) { for (const fn of this.handlers[name] ?? []) fn(...args); }
  direction(forward, right, out) {
    out.set(0, 0, 0);
    if (this.keys.has('up')) out.add(forward);
    if (this.keys.has('down')) out.sub(forward);
    if (this.keys.has('right')) out.add(right);
    if (this.keys.has('left')) out.sub(right);
    return out.lengthSq() ? out.normalize() : out;
  }
}
