// Transport/state only. The server owns hits, remaining shots and settlement.
import { isFairOpen, isFairStake, FAIR_GAME_IDS, FAIR_STAKES, FAIR_STAKE_MIN, FAIR_STAKE_MAX, DICE_SYMBOLS, FAIR_LIMITS, targetAt } from './fairRules.js';
export { FAIR_STAKES, FAIR_STAKE_MIN, FAIR_STAKE_MAX, isFairStake };
export const fairIsOpen = isFairOpen;
export const FAIR_GAMES = FAIR_GAME_IDS;

export class NetFair {
  constructor({ send, context, changed = () => {}, uuid = () => globalThis.crypto.randomUUID(), now = () => performance.now() }) {
    Object.assign(this, { send, context, changed, uuid, now });
    this.pending = null; this.probe = null; this.round = null; this.result = null;
    this.message = ''; this.elapsed = 0; this.cancelWhenReady = false;
    this.seen = new Set();
    this.lastShotAt = -Infinity; this.roundReceivedAt = this.now();
    this.cooldownUntil = 0;
    this.awaitingSync = false;
  }
  get busy() { return !!(this.pending || this.probe); }
  request(action, fields = {}) {
    const c = this.context();
    if (!c.online || !c.authenticated || this.awaitingSync || (this.busy && action !== 'status')) return false;
    if (action === 'status' && this.probe) return false;
    const message = { t: 'fair', action, request: this.uuid(), ...fields };
    if (action === 'status') this.probe = message; else this.pending = message;
    this.elapsed = 0; this.message = 'กำลังรอคำตอบจากร้าน…'; this.changed();
    try {
      if (this.send(message) === false) throw new Error('disconnected');
    } catch {
      // A send failure can be ambiguous: never replay a paid action.
      this.message = 'ยังยืนยันคำขอไม่ได้ เชื่อมต่อแล้วตรวจสอบสถานะ'; this.changed();
    }
    return true;
  }
  start(site, game, stake, symbol) {
    if (this.round || this.busy || this.now() < this.cooldownUntil || !FAIR_GAMES.includes(game) || !isFairStake(stake)
      || !fairIsOpen(this.context().hour) || this.context().map !== 'city'
      || (game === 'dice' && !DICE_SYMBOLS.includes(symbol))) return false;
    const c = this.context(); if (!c.online || !c.authenticated || this.awaitingSync) return false;
    this.result = null; this.cancelWhenReady = false;
    return this.request('start', { game, stake, ...(game === 'dice' ? { symbol } : {}) });
  }
  shot(x, y) {
    if (!this.round || this.round.game === 'dice' || !Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || x > 1 || y < 0 || y > 1 || !this.canShoot) return false;
    const sent = this.request('shot', { round: this.round.id, x, y });
    if (sent) this.lastShotAt = this.now();
    return sent;
  }
  get roundElapsedMs() { return (this.round?.elapsedMs ?? 0) + Math.max(0, this.now()-this.roundReceivedAt); }
  get canShoot() { return !!this.round && !this.busy && this.roundElapsedMs < FAIR_LIMITS.roundMs
    && this.now()-this.lastShotAt >= FAIR_LIMITS.shotIntervalMs; }
  get target() {
    const r = this.round;
    if (!r || r.game === 'dice') return null;
    try { return targetAt(r.game, r.seed, r.shotIndex ?? r.shots, this.roundElapsedMs); } catch { return null; }
  }
  cancel() {
    this.cancelWhenReady = true;
    if (this.round && !this.busy) {
      this.cancelWhenReady = false;
      return this.request('cancel', { round: this.round.id });
    }
    return false;
  }
  status() { return this.request('status'); }
  disconnected() {
    this.pending = null; this.probe = null; this.round = null; this.result = null;
    this.cancelWhenReady = false; this.awaitingSync = true;
    this.message = 'ตรวจสอบยอดจากเซิร์ฟเวอร์ก่อนเล่นอีกครั้ง • ผลรอบก่อนอาจบันทึกแล้ว';
    this.changed();
  }
  synced() {
    if (!this.awaitingSync) return;
    this.awaitingSync = false;
    this.message = 'ยอดจากเซิร์ฟเวอร์อัปเดตแล้ว • ผลรอบก่อนอาจบันทึกแล้ว เริ่มใหม่ได้เมื่อกดยืนยัน';
    this.changed();
  }
  receive(m) {
    if (m?.t !== 'fair_result' || this.seen.has(m.request)) return false;
    const pending = this.pending?.request === m.request, probe = this.probe?.request === m.request;
    if (!pending && !probe) return false;
    this.seen.add(m.request); if (this.seen.size > 128) this.seen.delete(this.seen.values().next().value);
    if (pending) this.pending = null;
    if (probe) this.probe = null;
    if (m.ok) {
      // Status is authoritative reconciliation, including a completed or absent round.
      if (probe) this.pending = null;
      const next = m.round ?? null;
      // A status sent before a shot reply must not rewind its target index.
      if (!next || !this.round || next.id !== this.round.id || (next.shots ?? next.shotIndex ?? 0) >= (this.round.shots ?? this.round.shotIndex ?? 0)) {
        this.round = next; this.roundReceivedAt = this.now();
      }
      if (!this.round) this.result = m.result ?? null;
      if (!this.round && this.result) this.cooldownUntil = this.now()+FAIR_LIMITS.roundCooldownMs;
      this.message = this.round ? (m.result?.hit === true ? 'โดนเป้า! เลือกยิงนัดต่อไป' : m.result?.hit === false ? 'พลาดเป้า เลือกยิงนัดต่อไป' : 'เลือกเป้าเพื่อยิงทีละนัด')
        : this.result ? 'ร้านยืนยันผลแล้ว' : 'พร้อมเริ่มรอบใหม่';
    } else {
      if (Object.hasOwn(m,'round') && m.round === null || m.why === 'round_missing') this.round = null;
      this.message = m.why ?? 'ร้านยังไม่รับคำขอนี้';
    }
    this.elapsed = 0; this.changed();
    if (this.cancelWhenReady && this.round && !this.busy) this.cancel();
    return true;
  }
  update(dt) {
    if (!this.busy) return;
    this.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (this.elapsed >= 8 && this.message === 'กำลังรอคำตอบจากร้าน…') {
      this.message = 'คำตอบล่าช้า ยังไม่ทราบผล ห้ามส่งรอบซ้ำ — ตรวจสอบสถานะ'; this.changed();
    }
  }
}
