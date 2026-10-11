import { ITEMS } from '../data/items.js';
import { previewEquipment, formatEquipmentValue, formatEquipmentDelta } from '../equipmentComparison.js';
import { esc } from './dom.js';

export function equipmentComparisonHtml(c, item, labels) {
  const comparison = previewEquipment(c, item);
  if (!comparison) return '';
  const { slot, current, why, rows } = comparison;
  const heading = `<b>ช่องที่จะสวม: ${esc(labels[slot] ?? slot)}</b><small>${current ? `แทน ${esc(ITEMS[current.id].name)}` : 'ช่องนี้ว่าง'}</small>`;
  if (why) return `<section class="iw-stat-comparison">${heading}<p class="iw-warning">${esc(why)}</p></section>`;
  const changed = rows.filter(r => r.delta !== 0);
  const shown = changed.length ? changed : rows.slice(0, 5);
  const table = `<table><caption>ค่าสถานะปัจจุบัน → หลังสวม</caption><thead><tr><th scope="col">ค่า</th><th scope="col">ปัจจุบัน</th><th scope="col">หลังสวม</th><th scope="col">ต่าง</th></tr></thead><tbody>${shown.map(r => `<tr><th scope="row">${esc(r.label)}</th><td>${formatEquipmentValue(r.before, r.percent)}</td><td>${formatEquipmentValue(r.after, r.percent)}</td><td class="${r.direction > 0 ? 'up' : r.direction < 0 ? 'down' : 'iw-unchanged'}">${formatEquipmentDelta(r.delta, r.percent)}</td></tr>`).join('')}</tbody></table>`;
  const cards = (ids, empty) => ids.length ? ids.map(id => {
    const d = ITEMS[id];
    return `${d.name}${d.special ? ` · ${d.special.name}: ${d.special.description}` : ' · โบนัสตามเผ่า/ธาตุ ดูรายละเอียดการ์ด'}`;
  }).map(esc).join('<br>') : empty;
  const conditional = comparison.conditionalBefore.length || comparison.conditionalAfter.length
    ? `<details class="iw-conditional"><summary>การ์ดตามเงื่อนไข · ไม่รวมเป็นดาเมจคงที่</summary><small>ปัจจุบัน: ${cards(comparison.conditionalBefore, 'ไม่มี')}</small><small>หลังสวม: ${cards(comparison.conditionalAfter, 'ไม่มี')}</small></details>` : '';
  return `<section class="iw-stat-comparison">${heading}${table}${conditional}<small class="iw-projection-note">${changed.length ? 'แสดงค่าที่เปลี่ยน' : 'ค่าสถานะคงที่เท่าเดิม'} · รวมตีบวก ออฟ การ์ด และบัฟปัจจุบัน<br>เขียว = เพิ่มประโยชน์ · ส้ม = ลดประโยชน์ · จุด% = ผลต่างเปอร์เซ็นต์</small></section>`;
}
