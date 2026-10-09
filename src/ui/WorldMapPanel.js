import { MAP_FILTERS, CATEGORY_ICONS, filterPlaces, worldOrder, nextPortal } from './mapDirectory.js';

export class WorldMapPanel {
  constructor(panel, { minimap, player, npcs, walk, changed }) {
    Object.assign(this, { panel, minimap, player, npcs, walk, changed });
    this.category = 'all'; this.query = ''; this.tab = 'places';
    this.list = panel.querySelector('#map-places');
    const filters = panel.querySelector('#map-filters');
    for (const [id, text] of MAP_FILTERS) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.filter = id;
      b.addEventListener('click', () => { this.category = id; this.selected = null; this.clusterIds = null; this.refresh(); }); filters.append(b);
    }
    panel.querySelector('#map-search').addEventListener('input', e => { this.query = e.target.value; this.selected = null; this.clusterIds = null; this.refresh(); });
    panel.querySelectorAll('[data-map-tab]').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.mapTab; this.refresh(); }));
    panel.querySelector('[data-map-view="zoom-in"]').addEventListener('click', () => this.minimap().zoomFull(1.3));
    panel.querySelector('[data-map-view="zoom-out"]').addEventListener('click', () => this.minimap().zoomFull(1 / 1.3));
    panel.querySelector('[data-map-view="fit"]').addEventListener('click', () => this.minimap().resetFull(true));
    panel.querySelector('[data-map-view="city"]').addEventListener('click', () => this.minimap().resetFull());
    panel.querySelector('[data-map-view="player"]').addEventListener('click', () => this.minimap().focusFull(this.player()));
    panel.querySelector('#map-walk').addEventListener('click', () => {
      const e = this.selected; if (e) this.walk(e.goal.x, e.goal.z);
    });
    panel.querySelector('#map-clear').addEventListener('click', () => { this.selected = null; this.refresh(); });
  }
  setMap(map) {
    this.map = map; this.selected = null; this.clusterIds = null; this.category = 'all'; this.query = '';
    this.panel.querySelector('#map-search').value = '';
    this.panel.querySelector('#map-title').textContent = map.name;
    this.panel.querySelector('#map-subtitle').textContent = map.safe ? 'เมืองปลอดภัย · ร้านค้าและสำนักครู' : `${map.sub ?? 'พื้นที่ผจญภัย'} · Lv ${map.levels?.join('–') ?? ''}`;
    this.panel.querySelector('[data-map-view="city"]').textContent = map.id === 'city' ? 'ใจกลางเมือง' : 'ภาพรวม';
    this.refresh();
  }
  select(entry, focus = true) {
    this.selected = entry; this.clusterIds = null; this.tab = 'places';
    if (focus) this.minimap().focusFull(entry);
    this.refresh();
  }
  selectCluster(entries) {
    this.category = 'all'; this.query = ''; this.selected = null; this.tab = 'places';
    this.clusterIds = new Set(entries.map(e => e.id)); this.panel.querySelector('#map-search').value = ''; this.refresh();
    this.list.scrollTop = 0;
  }
  refresh() {
    const mm = this.minimap(), p = this.player();
    mm.filter = this.category; mm.search = this.query; mm.selectedId = this.selected?.id;
    this.panel.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === this.category)));
    this.panel.querySelectorAll('[data-map-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mapTab === this.tab)));
    this.list.hidden = this.tab !== 'places';
    const world = this.panel.querySelector('#fullmap-route'); world.hidden = this.tab !== 'world';
    this.panel.querySelector('.atlas-search').hidden = this.tab !== 'places';
    this.list.replaceChildren();
    const rows = filterPlaces(mm.directory, this.category, this.query, p).filter(e => !this.clusterIds || this.clusterIds.has(e.id));
    this.panel.querySelector('#map-count').textContent = `${rows.length} จุดบนแผนที่`;
    for (const e of rows) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'atlas-place'; b.dataset.place = e.id;
      b.setAttribute('aria-pressed', String(e.id === this.selected?.id));
      const icon = document.createElement('i'); icon.textContent = CATEGORY_ICONS[e.category];
      const span = document.createElement('span'), name = document.createElement('b'), tag = document.createElement('small');
      name.textContent = e.name; tag.textContent = e.tag ?? ''; span.append(name, tag);
      const distance = document.createElement('em'); distance.textContent = `${Math.round(Math.hypot(e.x - p.x, e.z - p.z))} วา`;
      b.append(icon, span, distance); b.addEventListener('click', () => this.select(e)); this.list.append(b);
    }
    if (!rows.length) { const empty = document.createElement('p'); empty.className = 'atlas-empty'; empty.textContent = 'ไม่พบสถานที่ · ลองคำค้นหรือหมวดอื่น'; this.list.append(empty); }
    world.replaceChildren();
    for (const m of worldOrder()) {
      const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.dataset.destination = m.id;
      b.className = `atlas-world${m.id === this.map.id ? ' here' : ''}`;
      if (m.id === this.map.id) { b.disabled = true; b.setAttribute('aria-current', 'location'); }
      const name = document.createElement('b'), level = document.createElement('small');
      name.textContent = m.name; level.textContent = m.id === this.map.id ? 'คุณอยู่ที่นี่' : m.safe ? 'ปลอดภัย' : `Lv ${m.levels.join('–')}`;
      b.append(name, level);
      b.addEventListener('click', () => {
        const w = nextPortal(this.map.id, m.id);
        const entry = w && mm.directory.find(e => e.portal?.id === w.id);
        if (entry) this.select(entry);
      });
      li.append(b); world.append(li);
    }
    const card = this.panel.querySelector('#map-selection'); card.hidden = !this.selected || this.tab !== 'places';
    this.panel.dataset.selected = String(!!this.selected && this.tab === 'places');
    if (this.selected) {
      card.querySelector('b').textContent = this.selected.name;
      const npc = this.selected.npcId && this.npcs().find(n => n.id === this.selected.npcId);
      const unavailable = this.selected.npcId && (!npc || npc.indoors || Math.hypot(npc.x - this.selected.goal.x, npc.z - this.selected.goal.z) > 12);
      card.querySelector('p').textContent = `${this.selected.detail ?? this.selected.tag}${unavailable ? ' · ผู้ขายไม่อยู่ที่เคาน์เตอร์ตอนนี้' : ''}`;
      card.querySelector('small').textContent = `ระยะตรง ${Math.round(Math.hypot(this.selected.x - p.x, this.selected.z - p.z))} วา · เดินตามทางที่ผ่านได้`;
    }
    this.changed();
  }
}
