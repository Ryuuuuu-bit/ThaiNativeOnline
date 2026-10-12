import { NetFair, FAIR_GAMES, FAIR_STAKES, FAIR_STAKE_MIN, FAIR_STAKE_MAX, isFairStake, fairIsOpen } from './NetFair.js';
import './fair.css';
import { DICE_SYMBOLS, DICE_SYMBOL_NAMES, DICE_ODDS, SKILL_REFUND_PERCENT, FAIR_LIMITS, skillFee } from './fairRules.js';
import { FAIR_SITES, FAIR_RANGE } from './fairSites.js';

const games = { balloons: 'ปาเป้าลูกโป่ง', dolls: 'ยิงตุ๊กตา', dice: 'น้ำเต้า ปู ปลา' };
const symbols = DICE_SYMBOLS.map(id => DICE_SYMBOL_NAMES[id]);
const colors = ['#c95562', '#58aa92', '#e1b459', '#bb7daf', '#64a4ba', '#df8852'];
const reasons = { closed: 'งานเปิด 16:30–05:00', range: 'กรุณากลับไปที่ร้าน', auth: 'กรุณาเข้าสู่ระบบ',
  gold: 'ตำลึงไม่พอ', busy: 'ร้านกำลังยืนยันรายการ กรุณาตรวจสอบสถานะ', round_active: 'มีรอบที่ยังไม่จบ กรุณาตรวจสอบสถานะ',
  round_missing: 'รอบสิ้นสุดแล้ว กรุณาตรวจสอบสถานะ', shot_rate: 'เว้นระยะอย่างน้อยครึ่งวินาทีก่อนยิง',
  cooldown: 'พัก 3 วินาทีก่อนเริ่มรอบใหม่', blocked: 'กรุณาเดินไปด้านหน้าร้าน', bad_aim: 'ตำแหน่งยิงอยู่นอกกระดาน',
  request_limit: 'กรุณาเชื่อมต่อใหม่เพื่อตรวจสอบรายการ', rate_limit: 'ส่งคำขอเร็วเกินไป กรุณารอสักครู่',
  request_reused: 'เลขคำขอไม่ตรงกับรายการ กรุณาตรวจสอบสถานะ', auth: 'กรุณาเข้าสู่ระบบ',
  round: 'รอบนี้ไม่พร้อม กรุณาตรวจสอบสถานะ' };
const fmt = n => Number.isFinite(n) ? Math.floor(n).toLocaleString('en-US') : '—';
const short = n => n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : String(n);
// A stake this large asks for a second press before it is sent.
const BIG_STAKE = 100_000, ARM_MS = 4000;
const svg = (body, cls = '') => `<svg class="${cls}" viewBox="0 0 100 120" aria-hidden="true" focusable="false">${body}</svg>`;
function symbolArt(id) {
  const art = {
    gourd:'<path d="M50 30q-8-12 5-15" fill="none" stroke="#457954" stroke-width="4"/><ellipse cx="50" cy="46" rx="13" ry="17" fill="#d39c44"/><ellipse cx="50" cy="70" rx="21" ry="22" fill="#e7ba60"/><path d="M43 58v22" stroke="#fff2c6" stroke-width="4" opacity=".55"/>',
    crab:'<path d="m33 62-14-17 3-14 9 9M67 62l14-17-3-14-9 9M31 71l-13 9M32 78l-9 14M69 71l13 9M68 78l9 14" fill="none" stroke="#b84547" stroke-width="5"/><ellipse cx="50" cy="67" rx="24" ry="18" fill="#d86157"/><circle cx="41" cy="51" r="4" fill="#493631"/><circle cx="59" cy="51" r="4" fill="#493631"/>',
    fish:'<path d="m63 60 22-21v42z" fill="#4a9296"/><ellipse cx="44" cy="60" rx="27" ry="18" fill="#68b1ad"/><path d="m38 43 13-14 5 18M40 78l12 12 4-14" fill="#d5a350"/><circle cx="29" cy="56" r="4" fill="#263e3b"/><path d="M43 46q-13 14 0 29" fill="none" stroke="#e3eed0" stroke-width="3"/>',
    rooster:'<path d="M58 33q-11-20-18-1-12-7-12 8" fill="#c34347"/><path d="M58 63q20-39 27-22l-7 24 11 5-24 17" fill="#418676"/><ellipse cx="47" cy="67" rx="23" ry="20" fill="#db9c48"/><circle cx="43" cy="43" r="15" fill="#ecc46b"/><path d="m29 40-12 7 12 4M39 86v13M52 86v13" stroke="#b96b35" stroke-width="4" fill="#c97739"/><circle cx="37" cy="40" r="3" fill="#3d3030"/>',
    shrimp:'<path d="M31 40q42-12 41 30-1 32-38 16l-12 9 5-20q24 19 26-1 4-17-22-16z" fill="#dc865f"/><path d="M40 43q-4-27-22-20M34 46Q17 31 12 44M53 49l-4 13M63 60l-12 8M65 76l-13-3M53 84l-4-12" fill="none" stroke="#a85048" stroke-width="3"/><circle cx="31" cy="46" r="3" fill="#493430"/>',
    tiger:'<circle cx="27" cy="35" r="10" fill="#cf9142"/><circle cx="73" cy="35" r="10" fill="#cf9142"/><circle cx="50" cy="60" r="32" fill="#e6ad55"/><path d="m50 29-5 16h10zM20 54l17 5-15 5M80 54l-17 5 15 5M27 78l15-3-9 12M73 78l-15-3 9 12" fill="#573d32"/><ellipse cx="50" cy="74" rx="15" ry="11" fill="#fae5b5"/><circle cx="38" cy="58" r="3" fill="#493530"/><circle cx="62" cy="58" r="3" fill="#493530"/><path d="m45 69 5 6 5-6" fill="#93474b"/>',
  };
  return art[id] ?? '';
}
function emblem(game, i = 0) {
  const color = colors[i % colors.length];
  if (game === 'balloons') return svg(`<path d="M50 87q-14 10 0 26" fill="none" stroke="#eacb92" stroke-width="2"/><ellipse cx="50" cy="46" rx="32" ry="39" fill="${color}" stroke="#f8dfaa" stroke-width="2"/><path d="m50 83-5 7h10z" fill="${color}"/><ellipse cx="36" cy="27" rx="8" ry="13" fill="#fff" opacity=".35"/>`);
  if (game === 'dolls') return svg(`<path d="M28 58 17 92l18 3 4 16h22l4-16 18-3-11-34" fill="${color}" stroke="#f5d5a1" stroke-width="2"/><circle cx="50" cy="36" r="24" fill="#eec19b"/><path d="M26 35q0-38 48 0L64 22 50 31 36 22z" fill="#493831"/><circle cx="42" cy="37" r="2.5" fill="#493831"/><circle cx="58" cy="37" r="2.5" fill="#493831"/><path d="M43 47q7 7 14 0" fill="none" stroke="#a8464e" stroke-width="2"/><path d="m38 66 12 13 12-13M50 79v26" fill="none" stroke="#ffe1a2" stroke-width="3"/>`);
  return svg(`<rect x="8" y="14" width="84" height="88" rx="16" fill="#f9e9c9" stroke="#dbad59" stroke-width="3"/>${symbolArt(DICE_SYMBOLS[i%6])}`);
}
function el(tag, cls, text) {
  const node = document.createElement(tag); if (cls) node.className = cls;
  if (text != null) node.textContent = text; return node;
}
function button(label, click, cls = '') {
  const node = el('button', cls, label); node.type = 'button'; node.addEventListener('click', click); return node;
}

// Main gates world controls while open and forwards server events via connect.
// Rule copy/target prediction use shared helpers. Only server results settle gold.
export class TempleFairPanel {
  constructor({ character, context, prepare = async () => ({}), send }) {
    Object.assign(this, { character, context, prepare });
    this.game = 'balloons'; this.stake = 20; this.symbol = 0;
    this.ready = false; this.preparing = false; this.meta = {}; this.generation = 0;
    this.net = new NetFair({ send: send ?? (message => {
      if (!this.transport?.online) return false;
      this.transport.send(message); return true;
    }), context, changed: () => this.render() });
    this.root = el('div', 'temple-fair'); this.root.hidden = true;
    this.dialog = el('section', 'fair-dialog'); this.dialog.tabIndex = -1;
    this.dialog.setAttribute('role', 'dialog'); this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-label', 'งานวัดยามเย็น');
    const head = el('header', 'fair-head'), title = el('div');
    title.append(el('small', '', 'แสงโคม • งานวัด'), el('h2', '', 'เล่นสนุกใต้แสงโคม'));
    this.closeButton = button('ปิด', () => this.close(), 'fair-close');
    head.append(title, this.closeButton);
    this.tabs = el('nav', 'fair-tabs'); this.tabs.setAttribute('aria-label', 'เลือกเกม');
    this.tabButtons = FAIR_GAMES.map(game => {
      const b = button(games[game], () => {});
      b.dataset.game = game; this.tabs.append(b); return b;
    });
    this.info = el('p', 'fair-info'); this.board = el('div', 'fair-board');
    this.board.setAttribute('aria-label', 'เป้ายิง — ใช้ Tab เลือกเป้า แล้วกด Enter หรือ Space');
    this.rules = el('div', 'fair-rules'); this.ruleSummary = el('p');
    const details = el('details'), summary = el('summary','','กติกาและโอกาสได้รับเงินคืน');
    this.ruleDetails = el('p'); details.append(summary,this.ruleDetails); this.rules.append(this.ruleSummary,details);
    this.selection = el('fieldset', 'fair-selection');
    this.selection.append(el('legend', '', `วงเงินรอบนี้ (${fmt(FAIR_STAKE_MIN)}–${fmt(FAIR_STAKE_MAX)} ตำลึง)`));
    // Any whole amount: a number field plus quick picks, half and all-in (capped at the maximum).
    const entry = el('label', 'fair-stake-entry');
    this.stakeInput = el('input', 'fair-stake-input');
    Object.assign(this.stakeInput, { type: 'text', inputMode: 'numeric', autocomplete: 'off', value: fmt(this.stake) });
    this.stakeInput.setAttribute('aria-label', 'จำนวนตำลึงที่วาง');
    this.stakeInput.addEventListener('input', () => {
      const digits = this.stakeInput.value.replace(/[^0-9]/g, '').slice(0, 9);
      this.setStake(digits ? Number(digits) : 0, false);
    });
    this.stakeInput.addEventListener('blur', () => { this.setStake(this.stake); });
    this.stakeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.setStake(this.stake); } });
    entry.append(this.stakeInput, el('span', '', 'ตำลึง'));
    this.stakeRow = el('div', 'fair-stake-picks');
    this.stakes = FAIR_STAKES.map(stake => {
      const b = button(short(stake), () => this.setStake(stake)); b.dataset.stake = String(stake);
      this.stakeRow.append(b); return b;
    });
    this.halfButton = button('ครึ่งหนึ่ง', () => this.setStake(Math.floor((this.character()?.gold ?? 0) / 2)));
    this.allButton = button('หมดหน้าตัก', () => this.setStake(Math.min(FAIR_STAKE_MAX, this.character()?.gold ?? 0)));
    this.stakeRow.append(this.halfButton, this.allButton);
    this.selection.append(entry, this.stakeRow);
    this.symbols = el('fieldset', 'fair-symbols'); this.symbols.append(el('legend', '', 'เลือกสัญลักษณ์หนึ่งอย่าง'));
    this.symbolButtons = symbols.map((symbol, i) => {
      const b = button('', () => { this.symbol = i; this.render(); });
      const icon=el('span','fair-symbol-icon'); icon.innerHTML=svg(symbolArt(DICE_SYMBOLS[i]));
      b.append(icon,el('span','',symbol)); this.symbols.append(b); return b;
    });
    this.status = el('p', 'fair-status'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.result = el('p', 'fair-result');
    this.confirm = button('', () => this.confirmStart(), 'fair-confirm');
    this.cancel = button('ยกเลิกรอบ • ไม่เสียตำลึง', () => this.net.cancel(), 'fair-secondary');
    this.check = button('ตรวจสอบสถานะ', () => this.net.status(this.siteId), 'fair-secondary');
    const footer = el('footer', 'fair-actions'); footer.append(this.confirm, this.cancel, this.check);
    this.dialog.append(head, this.tabs, this.info, this.board, this.rules, this.symbols, this.selection, this.result, this.status, footer);
    this.root.append(this.dialog); (document.getElementById('app') ?? document.body).append(this.root);
    this.root.addEventListener('keydown', e => this.keydown(e));
    // Menu pointer/keyboard input must not leak into camera or combat handlers.
    for (const type of ['pointerdown','pointerup','click','wheel','keyup']) this.root.addEventListener(type, e => e.stopPropagation());
    this.board.addEventListener('click', e => {
      if (e.target.closest('button') || !this.net.round) return;
      const r = this.board.getBoundingClientRect();
      if (r.width && r.height) this.net.shot((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height);
    });
  }
  get open() { return !this.root.hidden; }
  // commit=false while typing: keep what was typed (it may be below the minimum for a moment)
  setStake(value, commit = true) {
    let stake = Number.isFinite(value) ? Math.floor(value) : FAIR_STAKE_MIN;
    if (commit) stake = Math.min(FAIR_STAKE_MAX, Math.max(FAIR_STAKE_MIN, stake));
    this.stake = stake; this.armedUntil = 0;
    if (commit || document.activeElement !== this.stakeInput) this.stakeInput.value = fmt(stake);
    else { const at = this.stakeInput.value.length - this.stakeInput.selectionEnd; this.stakeInput.value = stake ? fmt(stake) : '';
      const pos = Math.max(0, this.stakeInput.value.length - at); this.stakeInput.setSelectionRange?.(pos, pos); }
    this.render();
  }
  confirmStart() {
    if (!isFairStake(this.stake)) return this.setStake(this.stake);
    const now = this.net.now();
    if (this.stake >= BIG_STAKE && !(now < (this.armedUntil ?? 0))) { this.armedUntil = now + ARM_MS; this.render(); return; }
    this.armedUntil = 0;
    this.net.start(this.siteId, this.game, this.stake, DICE_SYMBOLS[this.symbol]);
  }
  connect(net) {
    if (this.transport === net) return;
    this.transport = net;
    this.offSync?.();
    this.offSync = this.character()?.on?.('server-sync', () => { if (!this.destroyed && this.transport === net) this.net.synced(); });
    const active = () => !this.destroyed && this.transport === net;
    net.on('fair_result', m => { if (active()) this.receive(m); });
    net.on('status', online => { if (active()) {
      if (!online) { this.net.disconnected(); this.close(); }
      else this.render();
    } });
    net.on('welcome', () => { if (active()) this.render(); });
  }
  async show(siteId) {
    if (this.destroyed) return false;
    if (!FAIR_GAMES.includes(siteId)) return false;
    if ((this.net.round && this.net.round.game !== siteId) || (this.net.pending?.game && this.net.pending.game !== siteId)) return false;
    if (!this.open) this.previousFocus = document.activeElement;
    this.siteId = siteId; this.game = siteId; this.root.hidden = false; this.ready = false; this.preparing = true;
    const generation = ++this.generation; this.render(); this.closeButton.focus();
    try {
      const meta = await this.prepare(siteId);
      if (this.destroyed || generation !== this.generation || !this.open) return false;
      this.meta = meta ?? {}; this.ready = true;
    } catch { this.net.message = 'ยังเตรียมร้านไม่ได้ กรุณาปิดแล้วลองใหม่'; }
    if (generation === this.generation) { this.preparing = false; this.render(); }
    return this.ready;
  }
  close() {
    if (!this.open) return;
    this.generation++; this.preparing = false; this.root.hidden = true;
    if (this.net.round || this.net.pending) this.net.cancel();
    this.previousFocus?.focus?.({ preventScroll: true });
  }
  receive(m) { return this.net.receive(m); }
  update(dt) {
    this.net.update(dt);
    const c = this.context(), key = `${c.online}:${c.authenticated}:${c.map}:${fairIsOpen(c.hour)}:${this.nearSite}:${this.character()?.gold}:${this.net.now()<this.net.cooldownUntil}:${this.net.now()<(this.armedUntil??0)}`;
    if (key !== this.contextKey) { this.contextKey = key; this.render(); }
    if (this.open && this.net.round) {
      const target = this.net.target, b = this.board.querySelector('[data-fair-target]');
      if (b && target) { b.style.left = `${target.x*100}%`; b.style.top = `${target.y*100}%`; }
      if (b) b.disabled = !target || !this.net.canShoot || !c.online || !c.authenticated || !this.nearSite;
      if (b && !b.disabled && this.targetFocusPending && document.activeElement === document.body) {
        b.focus({preventScroll:true}); this.targetFocusPending=false;
      }
      if (this.timer) this.timer.textContent = `เหลือ ${this.net.round.shotsRemaining ?? FAIR_LIMITS.shots-this.net.round.shots} นัด · ${Math.max(0,(FAIR_LIMITS.roundMs-this.net.roundElapsedMs)/1000).toFixed(1)} วินาที · โดน ${this.net.round.hits ?? 0} เป้า`;
    }
  }
  get nearSite() {
    const c=this.context(), site=FAIR_SITES.find(s=>s.id===(this.net.round?.game ?? this.game)), p=c.position;
    return c.map==='city' && Number.isFinite(p?.x) && Number.isFinite(p?.z) && !!site
      && Math.hypot(p.x-site.approach.x,p.z-site.approach.z)<=FAIR_RANGE;
  }
  keydown(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key !== 'Tab') return;
    const controls = [...this.root.querySelectorAll('button:not(:disabled), input:not(:disabled), summary')].filter(n => !n.closest('[hidden]'));
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
      e.preventDefault(); last?.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
      e.preventDefault(); first?.focus();
    }
  }
  render() {
    if (this.destroyed) return;
    const c = this.context(), round = this.net.round, busy = this.net.busy;
    const game = round?.game ?? this.game, locked = busy || !!round;
    const gold = this.character()?.gold;
    this.info.textContent = `เปิด 16:30–05:00 · มี ${fmt(gold)} ตำลึง · ${games[game] ?? 'งานวัด'}`;
    for (const b of this.tabButtons) { b.disabled = b.dataset.game !== game; b.setAttribute('aria-pressed', String(b.dataset.game === game)); }
    this.stakes.forEach((b,i) => { b.disabled = locked; b.setAttribute('aria-pressed', String(FAIR_STAKES[i] === this.stake)); });
    this.stakeInput.disabled = this.halfButton.disabled = this.allButton.disabled = locked;
    const valid = isFairStake(this.stake), affordable = Number.isSafeInteger(gold) && gold >= this.stake;
    this.stakeInput.setAttribute('aria-invalid', String(!valid || !affordable));
    this.symbols.hidden = game !== 'dice';
    this.symbolButtons.forEach((b,i) => { b.disabled = locked; b.setAttribute('aria-pressed', String(i === this.symbol)); });
    this.ruleSummary.textContent = game === 'dice'
      ? `ตรง 0/1/2/3 ลูก: จ่ายคืนรวมทุน ${DICE_ODDS.grossMultipliers.join('/')} เท่า${valid ? ` (สูงสุด ${fmt(this.stake * 4)} ตำลึง)` : ''}\nตัดวงเงินและจ่ายคืนทันทีเมื่อร้านยืนยัน • ไม่กดเล่นซ้ำอัตโนมัติ`
      : `โดน 0/1/2/3/4/5 เป้า: ลดค่ารอบ ${SKILL_REFUND_PERCENT.join('/')}%\nเสียสุทธิ ${valid ? SKILL_REFUND_PERCENT.map((_,i)=>fmt(skillFee(this.stake,i))).join('/') : '—'} ตำลึง • คิดหลังยิงครบ 5 นัดเท่านั้น • รอบที่หยุดกลางทางไม่เสียตำลึง`;
    this.ruleDetails.textContent = game === 'dice'
      ? `เต๋าอิสระ 3 ลูก • แต่ละหน้ามีโอกาส 1/6\nตรง 0/1/2/3 ลูก: โอกาส ${DICE_ODDS.matchCounts.join('/')} จาก ${DICE_ODDS.outcomes} ผลลัพธ์\nเสียเฉลี่ย ${((DICE_ODDS.expectedSinkNumerator/DICE_ODDS.outcomes)*100).toFixed(2)}% ของวงเงิน (17/216) • ไม่มีรางวัลไอเทมหรือ EXP`
      : `5 นัด ใน 20 วินาที • เว้นแต่ละนัด 0.5 วินาที • วงเงินสูงสุด ${fmt(this.stake)} ตำลึง\nส่วนลดปัดเศษลง • ไม่ได้รับตำลึงเกินวงเงิน • เป้าเคลื่อนที่ตามแบบเดิม ร้านตรวจตำแหน่งเมื่อได้รับคำขอ`;
    const available = this.ready && c.online && c.authenticated && this.nearSite && fairIsOpen(c.hour);
    this.confirm.disabled = locked || !available || !valid || !affordable || this.net.awaitingSync || this.net.now()<this.net.cooldownUntil;
    const armed = this.net.now() < (this.armedUntil ?? 0);
    this.confirm.dataset.armed = armed ? 'true' : 'false';
    this.confirm.textContent = armed ? `กดอีกครั้งเพื่อยืนยันวาง ${fmt(this.stake)} ตำลึง`
      : game === 'dice' ? `ยืนยันทาย ${symbols[this.symbol]} • จ่าย ${fmt(this.stake)} ตำลึง` : `ยืนยันเล่น 5 นัด • สูงสุด ${fmt(this.stake)} ตำลึง`;
    this.cancel.hidden = !round; this.cancel.disabled = busy || !c.online || !c.authenticated;
    this.check.disabled = !!this.net.probe || this.net.awaitingSync || !c.online || !c.authenticated;
    const connection = this.net.awaitingSync ? this.net.message : !c.online ? 'ยังไม่เชื่อมต่อเซิร์ฟเวอร์'
      : !c.authenticated ? 'เข้าสู่ระบบเพื่อเล่นงานวัด' : c.map !== 'city' ? 'กลับไปที่ร้านในเมืองเพื่อเล่น'
      : !this.nearSite ? 'เดินกลับไปด้านหน้าร้านนี้เพื่อเล่น' : !fairIsOpen(c.hour) && !round ? 'ร้านปิด • เปิดอีกครั้ง 16:30' : null;
    const stakeNote = !valid ? `วางได้ ${fmt(FAIR_STAKE_MIN)}–${fmt(FAIR_STAKE_MAX)} ตำลึง` : !affordable && !round ? 'ตำลึงไม่พอสำหรับวงเงินนี้' : null;
    this.status.textContent = connection ?? stakeNote ?? (this.preparing ? 'กำลังเตรียมร้าน…' : reasons[this.net.message] ?? this.net.message);
    this.result.hidden = !this.net.result;
    const result = this.net.result;
    if (result) {
      const parts = ['ผลยืนยันจากร้าน'];
      for (const [key,label] of [['hits','โดนเป้า'],['stake','วงเงิน'],['gross',game==='dice'?'จ่ายคืนรวมทุน':'ส่วนลดค่ารอบ'],['net','ตำลึงเปลี่ยนแปลง']]) {
        if (Number.isFinite(result[key])) parts.push(`${label} ${key === 'net' && result[key] > 0 ? '+' : ''}${key === 'hits' ? result[key] : fmt(result[key])}`);
      }
      if (Array.isArray(result.faces)) parts.push(`ลูกเต๋า ${result.faces.map(id=>DICE_SYMBOL_NAMES[id]??'—').join(' · ')}`);
      this.result.textContent = parts.join(' • ');
    }
    this.renderBoard(game, round, busy || !c.online || !c.authenticated || !this.nearSite || !this.net.canShoot);
  }
  renderBoard(game, round, disabled) {
    const focus = document.activeElement?.dataset?.fairTarget;
    if (focus != null) this.targetFocusPending=true;
    this.board.replaceChildren(); this.board.dataset.game = game;
    const banner = el('span', 'fair-board-caption', round ? `เหลือ ${round.shotsRemaining ?? FAIR_LIMITS.shots-round.shots} นัด • ร้านเป็นผู้ตัดสินผล` : 'เลือกวงเงิน แล้วกดยืนยันเพื่อเริ่ม');
    this.timer = banner; this.board.append(banner);
    if (game === 'dice') {
      const art = el('div', 'fair-dice-art');
      const faces=this.net.result?.faces;
      art.innerHTML = (faces ?? DICE_SYMBOLS.slice(0,3)).map(id=>emblem(game,DICE_SYMBOLS.indexOf(id))).join('');
      this.board.append(art); return;
    }
    const target = this.net.target;
    const targets = round ? (target ? [target] : []) : Array.from({length:6}, (_,i)=>({x:.18+(i%3)*.32,y:.34+Math.floor(i/3)*.38}));
    targets.forEach((target,i) => {
      if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || target.x<0 || target.x>1 || target.y<0 || target.y>1) return;
      const b = button('', e => {
        const current = this.net.target;
        if (!current) return;
        // Keyboard activates the current target; pointer aim retains exact position.
        const r = this.board.getBoundingClientRect();
        this.net.shot(e.detail===0 ? current.x : (e.clientX-r.left)/r.width, e.detail===0 ? current.y : (e.clientY-r.top)/r.height);
      }, 'fair-target');
      b.innerHTML = emblem(game,i); b.dataset.fairTarget = String(i);
      b.setAttribute('aria-label', `${games[game]} เป้าที่ ${i+1}${target.hit ? ' โดนแล้ว' : ''}`);
      b.style.left = `${target.x*100}%`; b.style.top = `${target.y*100}%`;
      b.disabled = disabled || !round || !!target.hit;
      if (target.radius) { b.style.width = `${target.radius*200}%`; b.style.height = `${target.radius*200}%`; b.classList.add('fair-live-target'); }
      if (target.hit) b.classList.add('is-hit');
      this.board.append(b);
    });
    if (focus != null && this.open) this.board.querySelector(`[data-fair-target="${focus}"]:not(:disabled)`)?.focus({preventScroll:true});
  }
  destroy() { this.close(); this.destroyed = true; this.generation++; this.offSync?.(); this.transport=null; this.root.remove(); }
}
