// Transient navigation state; Game owns collision/path planning and locomotion.
export class QuestNavigator {
  constructor({ resolve, walk, stop, changed = () => {} }) { Object.assign(this, { resolve, walk, stop, changed }); this.pinnedId = null; this.active = null; this.message = ''; }
  current() { return this.resolve(this.pinnedId); }
  pin(id) { if (id !== this.pinnedId) this.cancel(); this.pinnedId = id; this.hidden = false; this.message = ''; this.changed(); }
  untrack() { this.cancel(); this.pinnedId = null; this.hidden = true; this.changed(); }
  start() {
    const target = this.current(); this.cancel();
    if (!target?.step || target.reason) { this.message = target?.reason ?? 'เลือกเควสในสมุดก่อน'; this.changed(); return false; }
    if (!this.walk(target.step)) { this.message = 'เส้นทางถูกกีดขวาง · เปิดแผนที่หรือเดินอ้อมด้วยตนเอง'; this.changed(); return false; }
    this.active = { key: target.key, map: target.step.map, step: target.step };
    this.message = target.crossMap ? 'กำลังเดินไปประตู · ข้ามแผนที่แล้วกดเดินต่อ' : 'กำลังเดินตามเส้นทาง'; this.changed(); return true;
  }
  cancel(reason = '') { if (this.active) this.stop(); this.active = null; this.message = reason; this.changed(); }
  update({ map, alive, blocked, connected = true, walking, position }) {
    if (!this.active) return;
    const objective = this.current(), state = this.active;
    if (!alive || blocked || !connected || map !== state.map || objective?.key !== state.key) return this.cancel();
    if (objective.reason || !objective.step || objective.step.map !== state.step.map
      || objective.step.portalId !== state.step.portalId || Math.hypot(objective.step.x - state.step.x, objective.step.z - state.step.z) > 12) return this.cancel('เป้าหมายเปลี่ยนหรือไม่พร้อม · กดเดินใหม่เมื่อพร้อม');
    if (!walking) this.cancel(position && Math.hypot(position.x - state.step.x, position.z - state.step.z) < 12 ? 'ถึงจุดหมายแล้ว · คุยหรือทำเป้าหมายด้วยตนเอง' : 'หยุดเดินแล้ว');
  }
}
