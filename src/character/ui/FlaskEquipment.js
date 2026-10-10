import { ITEMS } from '../data/items.js';
import { el, esc } from './dom.js';
import { iconHtml } from '../../ui/icons.js';

export class FlaskEquipment {
  constructor(ui) {
    this.ui = ui;
    this.root = el('section', 'hotbar-editor flask-editor ro-window panel'); this.root.hidden = true;
    this.root.setAttribute('role','dialog'); this.root.setAttribute('aria-label','เลือกขวดน้ำยา'); ui.layer.append(this.root);
    this.root.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') this.close(); });
    this.root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.close !== undefined) this.close();
      else if (b.dataset.flaskIndex !== undefined) { if (!ui.c.equipFlask(+b.dataset.flaskIndex)) ui.feed.log('เลเวลยังไม่ถึง หรือเปลี่ยนขวดไม่ได้ในขณะนี้','bad'); this.render(); }
      else if (b.dataset.remove !== undefined) { if (!ui.c.unequipFlask(this.kind)) ui.feed.log('ต้องมีช่องว่างในกระเป๋าสำหรับถอดขวด','bad'); this.render(); }
    });
    ui.c.on('inventory', () => { if (!this.root.hidden) this.render(); });
  }
  open(kind) { this.kind = kind; this.root.hidden = false; this.render(); this.root.querySelector('button').focus(); }
  close() { this.root.hidden = true; }
  render() {
    const c = this.ui.c, info = c.flaskInfo(this.kind), key = this.kind === 'hp' ? 'Q' : 'E';
    this.root.innerHTML = `<header>ขวด ${this.kind.toUpperCase()} · ${key}<button type="button" data-close aria-label="ปิด">×</button></header><p>ขวดใช้ซ้ำ · ฟื้น ${this.kind.toUpperCase()} ทันที · เติมประจุจากการล่าหรือบริการในเมือง</p>${info ? `<p><b>${esc(info.definition.name)}</b><br>ขั้น ${info.definition.flask.tier} · ฟื้น ${info.recovery} · ประจุ ${info.charges}/${info.maxCharges} · ใช้ ${info.cost} ต่อครั้ง</p><button type="button" data-remove ${!c.inventory.includes(null) ? 'disabled' : ''}>ถอดลงกระเป๋า</button>` : '<p>ยังไม่ได้ใส่ขวด</p>'}<div class="hotbar-editor-options"></div>`;
    c.inventory.forEach((item,i)=>{
      const d=ITEMS[item?.id]; if (d?.flask?.kind!==this.kind) return;
      const b=el('button','',`${iconHtml(d)}<span>${esc(d.name)}<small>Lv.${d.minLevel} · ฟื้น ${d.flask.recovery} · ประจุ ${item.flask.charges}/${d.flask.maxCharges}</small></span>`);
      b.type='button'; b.dataset.flaskIndex=i; b.disabled=c.level<d.minLevel; this.root.querySelector('.hotbar-editor-options').append(b);
    });
  }
}
