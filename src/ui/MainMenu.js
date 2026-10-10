// Main menu (bottom-right): one button opens a grid of the game's windows, each tile
// showing its key. It replaces the old top-right icons and the C / I buttons on the
// action bar; the keys themselves are unchanged (handled where they always were).
//
//   const menu = new MainMenu({ sheet, skills, social, bag, map, auto, photo, settings })   actions by tile
//   menu.open / menu.toggle(on?)      Esc closes it first (src/core/Game.js)
//   menu.setAlert(on)                 gold dot when there are stat points to spend
//   bindSettingsTabs(panel)           the tab strip inside the settings window
import './menu-groups.css';

const $ = id => document.getElementById(id);
const GROUPS = [
  ['character', 'ตัวละคร', ['sheet', 'skills', 'bag', 'loadouts', 'titles']],
  ['adventure', 'ผจญภัย', ['quests', 'map', 'bestiary', 'shops', 'teachers', 'travel']],
  ['social', 'สังคม', ['social', 'recruit', 'friends', 'rank']],
  ['settings', 'ระบบ', ['auto', 'photo', 'settings']],
];

export class MainMenu {
  constructor(actions) {
    this.btn = $('menu-btn'); this.grid = $('menu-grid');
    this.grid.classList.add('mm-grouped');
    // Move the real tiles: their attributes, alerts and event handlers remain intact.
    for (const [id, label, keys] of GROUPS) {
      const tiles = keys.map(key => this.grid.querySelector(`[data-act="${key}"]`)).filter(Boolean);
      if (!tiles.length) continue;
      const group = document.createElement('details');
      group.className = 'mm-group'; group.dataset.group = id;
      group.open = id === 'character' || (!document.body.classList.contains('ui-touch') && matchMedia('(min-width: 901px)').matches);
      const heading = document.createElement('summary'); heading.textContent = label;
      const contents = document.createElement('div'); contents.className = 'mm-group-tiles';
      contents.append(...tiles); group.append(heading, contents); this.grid.append(group);
    }
    this.btn.addEventListener('click', () => this.toggle());
    const containKeys = e => {
      if (e.code === 'Escape') { this.toggle(false); this.btn.focus(); }
      e.stopPropagation();
    };
    this.grid.addEventListener('keydown', containKeys);
    this.grid.addEventListener('click', e => {
      const tile = e.target.closest('[data-act]');
      if (!tile || !this.grid.contains(tile)) return;
      this.toggle(false);
      actions[tile.dataset.act]?.();
    });
  }
  get open() { return !this.grid.hidden; }
  toggle(on = !this.open) {
    this.grid.hidden = !on;
    this.btn.setAttribute('aria-expanded', String(on));
    this.btn.classList.toggle('on', on);
    if (on) this.grid.querySelector('[data-act]')?.focus({ preventScroll: true });
  }
  setAlert(on) {
    if (on === this.alert) return;
    this.alert = on;
    for (const dot of document.querySelectorAll('#menu-btn .mm-dot, #menu-grid [data-act="sheet"] .mm-dot')) dot.hidden = !on;
  }
}

export function bindSettingsTabs(panel) {
  const tabs = panel.querySelectorAll('.set-tabs [data-pane]');
  panel.querySelector('.set-tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-pane]');
    if (!tab) return;
    for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
    for (const pane of panel.querySelectorAll('.set-pane')) pane.hidden = pane.dataset.pane !== tab.dataset.pane;
  });
}
