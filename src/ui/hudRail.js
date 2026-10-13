// The right-hand HUD column. Widgets that sit down the right edge are stacked one under another:
// first the minimap, then the tracked quest (placed by QuestUI), then RAIL in order. Each goes
// just below the one above, right-aligned with the minimap, and must end above the controls at
// the bottom (FLOOR). One that does not fit gets its compact form (`rail-tight`: the world boss
// banner's one-line summary), then a scrolling height, and when even 44 px is not left it waits
// (`data-rail="wait"`) until there is room. Nothing here changes what a widget says or does.
//
//   startHudRail()   once; re-lays the column on resize and four times a second (cheap: a few rects)
//   railLayout({ width, height, start, right, floors, items }) → [{ top, right, tight, max, wait }]
//     the pure geometry, in screen pixels (tests/hud-rail.test.js)
export const RAIL_GAP = 8, RAIL_MIN = 44;
// widgets stacked below the tracked quest, in order (left out when hidden)
const RAIL = ['.online-actions', '.exploration', '.wb-banner'];
// controls the column must end above, when they share its horizontal span
const FLOOR = ['#menu-btn', '.hotbar.action-bar', '.touch-combat-dock', '.touch-side', '.touch-pad', '.touch-utilities:not([hidden])', '.net-chat'];
// on a phone the boss banner starts in its one-line form: the full text covers half the playfield
const TOUCH_TIGHT_WIDTH = 700;

const overlapsX = (a, b) => a.left < b.right && a.right > b.left;

// items: [{ width, height, tightHeight, canTighten }] in screen px; floors: rects of FLOOR controls.
export function railLayout({ width, height, start, right, floors = [], items = [], preferTight = false }) {
  let y = start;
  return items.map(item => {
    const span = { left: width - right - item.width, right: width - right };
    const below = floors.filter(r => r && overlapsX(span, r) && r.bottom > y && r.top > y - 1);
    const limit = Math.min(height - 12, ...below.map(r => r.top - RAIL_GAP));
    const room = limit - y;
    let tight = !!(item.canTighten && preferTight), h = tight ? item.tightHeight : item.height;
    if (h > room && item.canTighten && !tight) { tight = true; h = item.tightHeight; }
    if (room < RAIL_MIN) return { top: y, right, tight, max: null, wait: true };
    const max = h > room ? room : null;
    const placed = { top: y, right, tight, max, wait: false };
    y += Math.min(h, room) + RAIL_GAP;
    return placed;
  });
}

const visible = el => el && !el.hidden && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
// CSS zoom (the HUD scale) multiplies lengths set on the element: divide screen px by it
const scaleOf = el => { const r = el.getBoundingClientRect(); return el.offsetWidth ? r.width / el.offsetWidth || 1 : 1; };

export function startHudRail({ every = 250 } = {}) {
  const run = () => {
    const mini = document.querySelector('.minimap');
    if (!visible(mini)) return;
    const m = mini.getBoundingClientRect(), quest = document.getElementById('quest-objective-hud');
    const start = Math.max(m.bottom, visible(quest) ? quest.getBoundingClientRect().bottom : 0) + RAIL_GAP;
    const right = Math.max(8, innerWidth - m.right);
    // (on a phone the party tools live inside the main menu: not part of the column then)
    const els = RAIL.map(s => document.querySelector(s)).filter(el => visible(el) && !el.closest('.touch-utilities,#menu-grid'));
    // measure each in its natural and compact form, free of an earlier max-height
    const items = els.map(el => {
      el.style.maxHeight = ''; el.classList.remove('rail-tight'); delete el.dataset.rail;
      const full = el.getBoundingClientRect();
      const canTighten = el.classList.contains('wb-banner');
      let tightHeight = full.height;
      if (canTighten) { el.classList.add('rail-tight'); tightHeight = el.getBoundingClientRect().height; el.classList.remove('rail-tight'); }
      return { width: full.width, height: full.height, tightHeight, canTighten };
    });
    const floors = FLOOR.flatMap(s => [...document.querySelectorAll(s)]).filter(visible).map(el => el.getBoundingClientRect());
    const touch = document.body.classList.contains('ui-touch');
    const plan = railLayout({ width: innerWidth, height: innerHeight, start, right, floors, items, preferTight: touch && innerWidth < TOUCH_TIGHT_WIDTH });
    plan.forEach((p, i) => {
      const el = els[i], s = scaleOf(el);
      el.style.top = `${p.top / s}px`; el.style.right = `${p.right / s}px`; el.style.left = 'auto'; el.style.bottom = 'auto';
      el.classList.toggle('rail-tight', p.tight);
      if (p.max != null) { el.style.maxHeight = `${p.max / s}px`; el.style.overflowY = 'auto'; }
      if (p.wait) el.dataset.rail = 'wait';
    });
  };
  addEventListener('resize', run);
  const timer = setInterval(run, every);
  run();
  return { run, stop: () => { clearInterval(timer); removeEventListener('resize', run); } };
}
