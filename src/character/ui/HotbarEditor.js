import { ITEMS } from '../data/items.js';
import { iconHtml } from '../../ui/icons.js';
import { el, esc } from './dom.js';

export const HOTBAR_DRAG = 'application/x-thainative-hotbar';
export function dragBinding(event, binding) {
  event.dataTransfer.setData(HOTBAR_DRAG, JSON.stringify(binding));
  event.dataTransfer.effectAllowed = 'copyMove';
}

export class HotbarEditor {
  constructor(host, bar) {
    this.bar = bar;
    this.root = el('section', 'hotbar-editor ro-window panel'); this.root.hidden = true;
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', 'จัดช่องลัด');
    host.append(this.root);
    this.root.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') this.close(); });
    this.root.addEventListener('click', e => {
      const button = e.target.closest('button'); if (!button) return;
      if (button.dataset.close !== undefined) return this.close();
      if (button.dataset.slot !== undefined) { this.slot = +button.dataset.slot; this.render(); return; }
      if (button.dataset.kind) { this.bar.character.setHotbarBinding(this.slot, {kind:button.dataset.kind,id:button.dataset.id}); this.close(); }
      if (button.dataset.clear !== undefined) { this.bar.character.setHotbarBinding(this.slot, null); this.close(); }
    });
    window.addEventListener('hotbar-assign', e => { this.pending = e.detail; this.open(0); });
  }
  open(slot) { this.slot = slot; this.returnFocus = document.activeElement; this.root.hidden = false; this.render(); this.root.querySelector('button').focus(); }
  close() { this.root.hidden = true; this.pending = null; this.returnFocus?.focus?.(); }
  render() {
    const c = this.bar.character; if (!c) return;
    this.root.innerHTML = `<header>จัดช่องลัด <button type="button" data-close aria-label="ปิด">×</button></header><p>เลือกช่องแล้วเลือกสกิลหรือไอเทม · ลากจากกระเป๋าหรือหน้าวิชามาใส่ได้</p><div class="hotbar-editor-keys">${c.hotbarBindings.map((b,i)=>`<button type="button" data-slot="${i}" aria-pressed="${i===this.slot}">${(i+1)%10}</button>`).join('')}</div><div class="hotbar-editor-options"></div><button type="button" data-clear>เว้นช่อง ${(this.slot+1)%10} ว่าง</button>`;
    const choices = this.pending ? [this.pending] : [
      ...this.bar.baseController.slots.filter((s,i)=>this.bar.baseController.level?.(i)!==0).map(s=>({kind:'skill',id:s.id})),
      ...[...new Set(c.inventory.filter(s=>ITEMS[s?.id]?.type==='use').map(s=>s.id))].map(id=>({kind:'item',id})),
    ];
    for (const b of choices) {
      const s = b.kind === 'skill' ? this.bar.baseController.slots.find(s=>s.id===b.id) : ITEMS[b.id]; if (!s) continue;
      const button = el('button', '', `${b.kind==='item' ? iconHtml(s) : s.icon ? `<img src="${esc(s.icon)}" alt="">` : '✦'}<span>${esc(s.name)}<small>${b.kind==='item' ? `ไอเทม · ${c.count(b.id)} ชิ้น` : 'สกิล'}</small></span>`);
      button.type='button'; button.dataset.kind=b.kind; button.dataset.id=b.id; this.root.querySelector('.hotbar-editor-options').append(button);
    }
  }
}
