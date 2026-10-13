import * as THREE from 'three';

// Chat lines as speech bubbles over the speaker's head: area and world lines from players in this
// room, party lines from party members here, and your own. One bubble per speaker (a new line
// replaces it); it stays a few seconds, longer for longer text, then fades.
//   const b = new SpeechBubbles(layer, anchorOf)   anchorOf(id) → THREE.Vector3 (head) | null
//   b.say(id, text, kind) · b.update(dt, camera, host) · b.clear()
const MAX_CHARS = 70, HOLD = 4, PER_CHAR = .06, FADE = .4;
const v = new THREE.Vector3();

export class SpeechBubbles {
  constructor(layer, anchorOf) {
    this.layer = layer; this.anchorOf = anchorOf; this.list = new Map();
    this.enabled = true;
  }
  say(id, text, kind = '') {
    if (!this.enabled || id == null || !this.layer || !this.anchorOf(id)) return;
    const shown = String(text ?? '').trim(); if (!shown) return;
    let b = this.list.get(id);
    if (!b) { const el = document.createElement('div'); el.className = 'speech-bubble'; this.layer.append(el); b = { el }; this.list.set(id, b); }
    b.el.textContent = shown.length > MAX_CHARS ? `${shown.slice(0, MAX_CHARS - 1)}…` : shown;
    b.el.dataset.kind = kind || 'area';
    b.life = HOLD + Math.min(6, shown.length * PER_CHAR); b.age = 0;
    b.el.style.opacity = '1';
  }
  update(dt, camera, host) {
    if (!this.list.size) return;
    const w = host.clientWidth, h = host.clientHeight;
    for (const [id, b] of this.list) {
      b.age += dt;
      const head = this.anchorOf(id);
      if (!head || b.age >= b.life) { b.el.remove(); this.list.delete(id); continue; }
      v.copy(head).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
      b.el.hidden = off;
      if (off) continue;
      b.el.style.opacity = String(Math.min(1, (b.life - b.age) / FADE));
      b.el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, -100%)`;
    }
  }
  clear() { for (const b of this.list.values()) b.el.remove(); this.list.clear(); }
}
