import { Sound } from '../audio/Sound.js';

// (styles: forge-fx.css, pulled in by shop.css)
// The ตีบวก moment at หมื่นเพชรศาสตรา's forge (ShopPanel's refine tab): a hammer strikes the item
// on the anvil, the forge holds its breath, then the result lands. Only presentation: the
// result itself comes from Character.refineGear (online, the server) and is shown when the
// strikes are done, never before.
//
//   const fx = new ForgeFx(host)        host: the shop window (the overlay covers it)
//   fx.start({ icon, from, to, risky, rate, blessed })   rate in %; risky tries strike three times
//     → { readyAt }  (performance.now() ms when a result may be revealed)
//   fx.finish('up' | 'broke', { great }) → Promise  resolves when the overlay has faded
//   fx.cancel()                          drops the overlay (refused try, closed window)
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const FORGE_TIMING = Object.freeze({ strike: 520, safeStrikes: 1, riskyStrikes: 3, hold: 750, success: 1500, broke: 1700 });
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export class ForgeFx {
  constructor(host) {
    this.host = host; this.timers = []; this.root = null;
  }
  get active() { return !!this.root; }
  later(ms, f) { this.timers.push(setTimeout(f, ms)); }
  clear() { for (const t of this.timers) clearTimeout(t); this.timers = []; }

  start({ icon = '', from = 0, to = 1, risky = false, rate = 100, blessed = 0 } = {}) {
    this.cancel();
    const T = FORGE_TIMING, strikes = risky ? T.riskyStrikes : T.safeStrikes;
    const root = this.root = el('div', `forge-fx${risky ? ' risky' : ''}`);
    root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'assertive');
    root.innerHTML = `<div class="forge-fx-stage">
        <i class="forge-fx-glow"></i><i class="forge-fx-rays"></i>
        <div class="forge-fx-item"><span class="forge-fx-half l">${icon}</span><span class="forge-fx-half r">${icon}</span></div>
        <i class="forge-fx-anvil"></i>
        <i class="forge-fx-hammer"><i></i></i>
        <i class="forge-fx-sparks"></i><i class="forge-fx-flash"></i>
      </div>
      <div class="forge-fx-label"><b>+${from} → +${to}</b><small>${risky ? `โอกาสสำเร็จ ${rate}%${blessed ? ` · ☸ พรเซียมซี +${+(blessed * 100).toFixed(1)}%` : ''}` : 'ปลอดภัย'}</small></div>`;
    this.host.append(root);
    this.sparks = root.querySelector('.forge-fx-sparks');
    for (let i = 0; i < strikes; i++) this.later(80 + i * T.strike, () => this.strike(i, strikes));
    const holdAt = 80 + strikes * T.strike;
    if (risky) this.later(holdAt - 200, () => { root.classList.add('holding'); Sound.sfx('forge_charge'); });
    return { readyAt: performance.now() + holdAt + (risky ? T.hold : 80) };
  }
  strike(i, n) {
    const root = this.root; if (!root) return;
    root.classList.remove('hit'); void root.offsetWidth; root.classList.add('hit');
    Sound.sfx('forge_hit', { pitch: 1 + i * .08 });
    this.burst(8 + i * 4, 'spark');
    if (i === n - 1) root.classList.add('heated');
  }
  burst(n, kind) {
    if (!this.sparks || reduced()) return;
    for (let k = 0; k < n; k++) {
      const s = el('i', `forge-fx-p ${kind}`);
      const a = (kind === 'spark' ? -Math.PI / 2 : 0) + (Math.random() - .5) * (kind === 'spark' ? 2.4 : Math.PI * 2);
      const d = (kind === 'spark' ? 40 : 70) + Math.random() * (kind === 'spark' ? 50 : 70);
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      s.style.animationDelay = `${Math.random() * 60}ms`;
      this.sparks.append(s);
      setTimeout(() => s.remove(), 1100);
    }
  }
  finish(outcome, { great = false } = {}) {
    const root = this.root; if (!root) return Promise.resolve();
    const T = FORGE_TIMING;
    root.classList.remove('holding', 'hit');
    root.classList.add(outcome === 'up' ? 'success' : 'broke');
    if (great && outcome === 'up') root.classList.add('great');
    const label = root.querySelector('.forge-fx-label b'), to = label.textContent.split('+').pop();
    if (outcome === 'up') {
      label.textContent = great ? `ยอดเยี่ยม! +${to}` : `สำเร็จ! +${to}`;
      Sound.sfx(great ? 'forge_great' : 'forge_success');
      this.burst(great ? 40 : 24, 'gold');
    } else {
      label.textContent = 'แตกสลาย…';
      Sound.sfx('forge_break');
      this.burst(18, 'shard');
    }
    return new Promise(done => {
      this.later(outcome === 'up' ? T.success : T.broke, () => root.classList.add('leaving'));
      this.later((outcome === 'up' ? T.success : T.broke) + 320, () => { this.cancel(); done(); });
    });
  }
  cancel() { this.clear(); this.root?.remove(); this.root = null; this.sparks = null; }
}
