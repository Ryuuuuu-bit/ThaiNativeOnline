import * as THREE from 'three';
import { makeModelCharacter } from '../classes/model.js';
import { avatarFor } from '../data/training.js';
import { CLASSES } from '../character/data/classes.js';
import { titleHtml } from '../ui/titleTag.js';

// Other players on this map: their class model walking where the server says they
// are, playing the moves they play, with a name plate. Positions arrive 10× a second
// and are eased toward, so they glide instead of stepping.
//   const rp = new RemotePlayers(scene, plateLayer, heightAt)
//   rp.set(info) · rp.move(id, x, z, f, m) · rp.anim(id, clip, sp) · rp.level(id, lv) · rp.remove(id) · rp.clear()
//   rp.update(dt, time, camera, host)
const EASE = 10;                       // 1/s toward the latest spot
const v = new THREE.Vector3();

export class RemotePlayers {
  constructor(scene, plateLayer, heightAt) {
    this.scene = scene; this.layer = plateLayer; this.heightAt = heightAt; this.list = new Map();
  }
  get count() { return this.list.size; }
  set(p) {
    if (this.list.has(p.id)) this.remove(p.id);
    const avatar = avatarFor(p.cls), model = makeModelCharacter(this.scene, null, { url: `${import.meta.env.BASE_URL}${avatar.url}`, height: avatar.height });
    model.group.visible = false;
    model.ready.then(() => { if (this.list.get(p.id)?.model === model) model.group.visible = true; }).catch(() => {});
    const plate = document.createElement('div'); plate.className = 'plate is-player'; this.layer.append(plate);
    // a click on the name: what to do with that player (src/net/Social.js)
    plate.addEventListener('click', e => { e.stopPropagation(); const r = this.list.get(p.id); if (r) this.onPick?.(r, e.clientX, e.clientY); });
    const r = { id: p.id, model, plate, name: p.name, cls: p.cls, lv: p.lv, title: p.title ?? null, x: p.x, z: p.z, f: p.f, m: p.m ?? 0, tx: p.x, tz: p.z, tf: p.f, time: 0 };
    model.group.position.set(p.x, this.heightAt(p.x, p.z), p.z);
    this.list.set(p.id, r); this.label(r);
  }
  label(r) { r.plate.innerHTML = `${titleHtml(r.title)}${esc(r.name)}<small>${CLASSES[r.cls]?.name ?? ''} · Lv.${r.lv}</small>`; }
  move(id, x, z, f, m) { const r = this.list.get(id); if (!r) return; r.tx = x; r.tz = z; r.tf = f; r.m = m; }
  // a move clip (basic attacks, potions …); a class skill plays through src/net/RemoteSkills.js instead
  anim(id, clip, sp) { const r = this.list.get(id); if (!r || (r.skillUntil ?? 0) > performance.now() / 1000) return; if (r.model.has(clip)) r.model.attack(clip, sp); }
  level(id, lv) { const r = this.list.get(id); if (r) { r.lv = lv; this.label(r); } }
  setTitle(id, title) { const r = this.list.get(id); if (r) { r.title = title ?? null; this.label(r); } }
  remove(id) {
    const r = this.list.get(id); if (!r) return;
    this.scene.remove(r.model.group); r.plate.remove();
    r.model.group.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); } });
    this.list.delete(id);
  }
  clear() { for (const id of [...this.list.keys()]) this.remove(id); }

  update(dt, camera, host) {
    const w = host.clientWidth, h = host.clientHeight, k = 1 - Math.exp(-EASE * dt);
    for (const r of this.list.values()) {
      r.time += dt;
      // a long jump (a respawn) snaps instead of sliding across the map
      if (Math.hypot(r.tx - r.x, r.tz - r.z) > 12) { r.x = r.tx; r.z = r.tz; }
      r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k;
      const g = r.model.group; g.position.set(r.x, this.heightAt(r.x, r.z), r.z);
      // while a skill plays its runner turns them (and a dash is not a walk)
      const casting = (r.skillUntil ?? 0) > performance.now() / 1000;
      r.model.update(dt, r.time, r.m > 0 && !casting, r.skillFacing ?? r.tf);
      // name plate above the head
      v.set(r.x, g.position.y + 2.15, r.z).project(camera);
      const off = v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1 || !g.visible;
      r.plate.hidden = off;
      if (!off) r.plate.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, -100%)`;
    }
  }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
