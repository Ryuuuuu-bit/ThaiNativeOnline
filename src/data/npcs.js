import { EXPEDITIONS } from '../world/expeditions.js';
// NPC roster for นครอโยธยา and the zone maps outside the wall. Each entry is pure data:
//   id, name, occupation, gender, home, interactionRadius, dialogue, shopType / trainer,
//   map (optional: which map of src/world/maps.js the NPC lives on; otherwise
//   inferred from `home.near` or the first road junction in the schedule),
//   schedule: { morning, day, evening, night } (missing phases fall back to `day`).
// Activities: stay at a spot in a state (idle/work/sit/talk), follow a route of
// stops, or go home (hidden indoors). Spots are named anchors registered by the
// districts; `P(x, z, face, link)` declares an ad-hoc spot linked to a road node.
// Positions and routes run on the road graph, so a navmesh can replace it later.

const S = (at, state, anim, extra = {}) => ({ do: 'stay', at, state, anim, ...extra });
const work = (at, anim = 'work') => S(at, 'work', anim);
const sit = (at, anim = 'rest') => S(at, 'sit', anim);
const idle = (at, anim = 'look') => S(at, 'idle', anim);
const talk = at => S(at, 'talk', 'talk');
const guard = at => S(at, 'idle', 'guard');
const stop = (at, state = 'idle', anim = 'look', time = [3, 6]) => ({ at, state, anim, time });
const route = (...stops) => ({ do: 'route', stops });
const carry = (...stops) => ({ do: 'route', stops, carry: true });
const HOME = { do: 'home' };
const P = (x, z, face = 0, link) => ({ x, z, face, link });

const allDay = activity => ({ morning: activity, day: activity, evening: activity, night: HOME });
const shopHours = activity => ({ morning: activity, day: activity, evening: activity, night: HOME });

export const NPCS = [
  // ---------- Port ----------
  { id: 'fisher_pier', name: 'ตาเพิ่ม', occupation: 'fisher', home: { near: 'fv_m' }, props: ['rod'],
    dialogue: ['ปลาช่อนแถวท่าน้ำนี่ตัวโตนัก ถ้าใจเย็นพอ', 'วันหน้าข้าจะสอนเอ็งตกปลาเอง'],
    schedule: { morning: work('fishdock_end', 'fish'), day: work('fishdock_end', 'fish'), evening: route(stop('fishW_b0', 'talk', 'talk', [8, 12]), 'port_w', stop('bank_seat', 'sit', 'rest', [20, 30])), night: HOME } },
  { id: 'fisher_dock', name: 'ลุงเจิม', occupation: 'fisher', home: { near: 'port_e2' }, props: ['rod'],
    dialogue: ['เรือสินค้าแล่นผ่านทีไร ปลาหนีหมดทุกที', 'ปลาที่ได้วันนี้จะเอาไปขายที่ตลาดปลา'],
    schedule: { morning: work('dockB_end2', 'fish'), day: work('dockB_end2', 'fish'), evening: carry(stop('fishE_b2', 'talk', 'talk', [10, 14]), 'port_c'), night: HOME } },
  { id: 'dock_worker_a', name: 'ทิด', occupation: 'dockworker', home: { near: 'sw_a' },
    dialogue: ['ข้าวจากหัวเมืองเหนือมาลงท่าวันละหลายสิบกระสอบ', 'หลบหน่อย ของหนัก!'],
    schedule: { morning: carry(stop('dockA_end', 'work', 'lift', [2, 3]), stop('warehouseA', 'work', 'lift', [2, 3])), day: carry(stop('dockA_end', 'work', 'lift', [2, 3]), stop('warehouseA', 'work', 'lift', [2, 3])), evening: sit('sala_seat'), night: HOME } },
  { id: 'dock_worker_b', name: 'มั่น', occupation: 'dockworker', home: { near: 'se_a' },
    dialogue: ['เรือกระแชงลำนี้บรรทุกข้าวเต็มลำ', 'ทำงานท่าเรือเหนื่อย แต่ได้เห็นเรือจากทุกทิศ'],
    schedule: { morning: carry(stop('dockB_end', 'work', 'lift', [2, 3]), stop('warehouseB', 'work', 'lift', [2, 3])), day: carry(stop('dockB_end', 'work', 'lift', [2, 3]), stop('warehouseB', 'work', 'lift', [2, 3])), evening: route(stop('fishmkt', 'idle', 'look', [6, 9]), stop('bank_seat', 'sit', 'rest', [20, 30])), night: HOME } },
  { id: 'cargo_merchant', name: 'นายห้างสำเภา', occupation: 'merchant', gender: 'm', home: { near: 'port_w' }, shopType: 'general',
    dialogue: ['สำเภาลำนี้มาจากเมืองท่าทางใต้ บรรทุกเครื่องเทศและผ้าไหม', 'นับกระสอบให้ครบนะ อย่าให้ขาดแม้แต่ใบเดียว'],
    schedule: shopHours(work('dockA_land', 'point')) },
  { id: 'boatman', name: 'ตาแจว', occupation: 'boatman', home: { near: 'port_c' }, interactionRadius: 3.2,
    dialogue: ['จะข้ามฟากไหมพ่อหนุ่ม? เรือออกทุกครั้งที่น้ำนิ่ง', 'วันหน้าเรือข้าจะพาไปถึงเมืองอื่นได้'],
    schedule: { morning: sit('pdock_end'), day: sit('pdock_end'), evening: sit('pdock_end'), night: HOME } },
  { id: 'kid_port', name: 'เด็กชายแก้ว', occupation: 'child', home: { near: 'port_c' },
    dialogue: ['ดูสิ! สำเภาลำใหญ่ใบเรือสีแดง!', 'โตขึ้นข้าจะเป็นนายเรือ'],
    schedule: { morning: route('port_c', 'port_w', stop('dockA_land', 'idle', 'look', [3, 5]), 'port_c', stop('kid_watch', 'idle', 'look', [8, 12])), day: idle('kid_watch'), evening: route('port_c', 'pdock_land', stop('kid_watch', 'idle', 'look', [6, 9])), night: HOME } },
  { id: 'trader_a', name: 'อาซ้อเง็ก', occupation: 'merchant', gender: 'f', home: { near: 'port_w' },
    dialogue: ['ผ้าไหมล็อตนี้ราคาขึ้นอีกแล้ว', 'ถ้าเจ้าหาผ้าดี ๆ ไปที่ตลาดกลางเมืองสิ'],
    schedule: shopHours(talk('trader_a')) },
  { id: 'trader_b', name: 'นายจุ้ย', occupation: 'merchant', home: { near: 'port_c' },
    dialogue: ['ลดให้อีกนิดไม่ได้หรืออาซ้อ', 'การค้าริมน้ำไม่เคยหลับ'],
    schedule: shopHours(talk('trader_b')) },
  { id: 'river_sitter', name: 'ยายแม้น', occupation: 'villager', gender: 'f', home: { near: 'port_e' },
    dialogue: ['แม่น้ำสายนี้เลี้ยงคนทั้งเมืองมาตั้งแต่ยายยังเด็ก', 'ลมเย็นจากน้ำช่วยให้หายเหนื่อย'],
    schedule: { morning: sit('bank_seat'), day: carry(stop('fishE_b0', 'talk', 'talk', [8, 12]), 'fishmkt', 'port_c', stop('bank_seat', 'sit', 'rest', [30, 50])), evening: sit('bank_seat'), night: HOME } },
  { id: 'guard_port', name: 'หมื่นท่า', occupation: 'guard', home: { near: 'port_w2' }, faction: 'city_guard',
    dialogue: ['ท่าเรือหลวงอยู่ในความดูแลของทหารอโยธยา', 'อย่าก่อเรื่องในเขตท่าเรือเชียว'],
    schedule: { morning: route(stop('port_w2', 'idle', 'guard', [6, 10]), 'port_w', 'port_c', stop('port_e', 'idle', 'guard', [4, 8]), 'port_e2', 'port_e', 'port_c', 'port_w'), day: route(stop('port_w2', 'idle', 'guard', [6, 10]), 'port_w', 'port_c', stop('port_e', 'idle', 'guard', [4, 8]), 'port_e2', 'port_e', 'port_c', 'port_w'), evening: guard(P(-2, 146, Math.PI, 'port_c')), night: route(stop('port_w2', 'idle', 'guard', [8, 12]), 'port_w', 'port_c', 'port_e', 'port_e2', 'port_e', 'port_c', 'port_w') } },
  { id: 'fish_vendor_w', name: 'แม่ค้าปลาบุญมา', occupation: 'merchant', gender: 'f', home: { near: 'sw_b' }, shopType: 'fish',
    dialogue: ['ปลาสดจากแม่น้ำเช้านี้! ปลาช่อนตัวโต ๆ', 'ถ้าตกปลาได้เยอะ เอามาขายป้าได้นะ'],
    schedule: { morning: work('fishW_v1', 'sell'), day: work('fishW_v1', 'sell'), evening: HOME, night: HOME } },
  { id: 'fish_vendor_e', name: 'ป้าสาย', occupation: 'merchant', gender: 'f', home: { near: 'se_b' }, shopType: 'fish',
    dialogue: ['กุ้งแม่น้ำตัวใหญ่ต้องเผาไฟอ่อน ๆ', 'ปลาเค็มตากแดดสามวันเต็ม'],
    schedule: { morning: work('fishE_v0', 'sell'), day: work('fishE_v0', 'sell'), evening: HOME, night: HOME } },

  // ---------- Market ----------
  { id: 'vendor_weapons', name: 'นายเหน่ง', occupation: 'merchant', home: { near: 'w1' }, shopType: 'weapons',
    dialogue: ['ดาบเล่มนี้ตีจากเหล็กน้ำพี้แท้', 'อยากได้ของดีกว่านี้ ไปหาช่างตีเหล็กที่ย่านช่างสิ'],
    schedule: shopHours(work('stall_weapons_v', 'sell')) },
  { id: 'vendor_armor', name: 'นายเกราะ', occupation: 'merchant', home: { near: 'w2' }, shopType: 'armor',
    dialogue: ['เสื้อเกราะหนังควาย กันคมมีดได้ดีนัก', 'ทหารในเมืองซื้อเกราะจากข้าทั้งนั้น'],
    schedule: shopHours(work('stall_armor_v', 'sell')) },
  { id: 'vendor_charms', name: 'ยายเครื่องราง', occupation: 'villager', gender: 'f', home: { near: 'rw1' }, shopType: 'charms',
    dialogue: ['สายสิญจน์เส้นนี้ปลุกเสกที่วัดมาแล้ว', 'ของแรงกว่านี้ต้องไปหาหมออาคม'],
    schedule: shopHours(work('stall_charms_v', 'sell')) },
  { id: 'vendor_fruit', name: 'แม่ค้าผลไม้จำปา', occupation: 'merchant', gender: 'f', home: { near: 'e1' }, shopType: 'fruit',
    dialogue: ['มะม่วงสุกจากสวนริมคลอง หวานฉ่ำ', 'มาเร็ว ๆ ก่อนของหมด!'],
    schedule: shopHours(work('stall_fruit_v', 'sell')) },
  { id: 'vendor_rice', name: 'นางข้าวหอม', occupation: 'merchant', gender: 'f', home: { near: 'e2' }, shopType: 'rice',
    dialogue: ['ข้าวใหม่จากทุ่งนาหลวง หอมทั้งตลาด', 'ปีนี้น้ำดี ข้าวงาม'],
    schedule: shopHours(work('stall_rice_v', 'sell')) },
  { id: 'vendor_lanterns', name: 'ลุงโคม', occupation: 'merchant', home: { near: 'mkt_s' }, shopType: 'lanterns',
    dialogue: ['พอตะวันตกดิน โคมของข้าจะส่องทั้งตลาด', 'เดินตรอกตอนกลางคืน อย่าลืมพกตะเกียง'],
    schedule: shopHours(work('stall_lanterns_v', 'sell')) },
  { id: 'vendor_pottery', name: 'ช่างปั้นมี', occupation: 'merchant', gender: 'f', home: { near: 'w1' }, shopType: 'pottery',
    dialogue: ['โอ่งมังกรใบนี้เผาด้วยฟืนสามวันสามคืน', 'หม้อดินหุงข้าวอร่อยกว่าหม้ออื่น'],
    schedule: shopHours(work('stall_pottery_v', 'sell')) },
  { id: 'shopper_a', name: 'นางบัว', occupation: 'villager', gender: 'f', home: { near: 'rw2' }, props: ['basket'],
    dialogue: ['วันนี้จะทำแกงส้ม ต้องหาปลาสด ๆ', 'ตลาดคนแน่นทุกเช้า'],
    schedule: { morning: carry(stop('stall_fruit_c', 'talk', 'talk', [5, 8]), stop('stall_rice_c', 'talk', 'talk', [5, 8]), 'mkt_s', 'shops_m', 'shops_s', 'south_rd', stop('fishE_b1', 'talk', 'talk', [6, 9]), 'fishmkt', 'south_rd', 'shops_s', 'shops_m', 'mkt_s', stop('stall_pottery_c', 'idle', 'look', [4, 6])), day: carry(stop('stall_veg_c', 'talk', 'talk', [5, 8]), stop('stall_cloth_c', 'idle', 'look', [5, 8]), stop('stall_lanterns_c', 'idle', 'look', [4, 6])), evening: HOME, night: HOME } },
  { id: 'shopper_b', name: 'นายทองอิน', occupation: 'villager', home: { near: 'e3' },
    dialogue: ['ดาบใหม่ของนายเหน่งสวยดี แต่แพงเหลือเกิน', 'ข้ากำลังเก็บเงินซื้อเกราะ'],
    schedule: { morning: route(stop('stall_weapons_c', 'talk', 'talk', [6, 9]), stop('stall_armor_c', 'idle', 'look', [5, 8]), 'mkt_n', stop('pillar_pray2', 'idle', 'pray', [8, 12]), 'center', 'br_n', 'br_s', 'mkt_n'), day: route(stop('stall_weapons_c', 'talk', 'talk', [6, 9]), stop('stall_armor_c', 'idle', 'look', [5, 8]), stop('stall_charms_c', 'idle', 'look', [4, 7])), evening: route(stop('center_bench', 'sit', 'rest', [30, 50])), night: HOME } },
  { id: 'shopper_c', name: 'นางสาวกุหลาบ', occupation: 'villager', gender: 'f', home: { near: 'rn1' },
    dialogue: ['ผ้าทอลายนี้สวยที่สุดในตลาด', 'แม่ให้มาซื้อโคมไปแขวนหน้าบ้าน'],
    schedule: { morning: route(stop('stall_cloth_c', 'talk', 'talk', [6, 9]), stop('stall_herbs_c', 'idle', 'look', [4, 6]), stop('stall_o2_c', 'idle', 'look', [4, 6]), stop('stall_o3_c', 'idle', 'look', [4, 6])), day: route(stop('stall_lanterns_c', 'talk', 'talk', [6, 9]), stop('stall_o1_c', 'idle', 'look', [4, 6]), stop('stall_fruit_c', 'idle', 'look', [4, 6])), evening: HOME, night: HOME } },
  { id: 'porter', name: 'นายคานหาบ', occupation: 'villager', home: { near: 'w2' }, props: ['pole'],
    dialogue: ['ข้าวสารสองกระบุงนี้ต้องส่งให้ทันก่อนเที่ยง', 'หาบของมาสิบปี บ่าด้านเป็นหนัง'],
    schedule: { morning: carry('w2', 'w1', 'mkt_w', stop('stall_rice_c', 'work', 'lift', [4, 6]), 'mkt_s', 'shops_m', stop('general_customer', 'work', 'lift', [4, 6]), 'shops_m', 'bl1', 'bl2', 'bl3', 'bl4', 'w2'), day: carry('w2', 'w1', 'mkt_w', stop('stall_veg_c', 'work', 'lift', [4, 6]), 'mkt_s', 'shops_m', 'shops_s', 'south_rd', stop('fishW_b1', 'work', 'lift', [4, 6]), 'south_rd', 'sw_b', 'sw_a', 'port_w2', stop('warehouseA', 'work', 'lift', [4, 6]), 'port_w', 'port_w2', 'sw_a', 'sw_b', 'south_rd', 'shops_s', 'shops_m', 'mkt_s', 'pl_sw', 'mkt_w', 'w1'), evening: HOME, night: HOME } },
  { id: 'guard_market', name: 'ขุนตลาด', occupation: 'guard', home: { near: 'mkt_e' }, faction: 'city_guard',
    dialogue: ['ตลาดนี้ห้ามวิวาท ใครฝ่าฝืนโดนจับ', 'ข้าจำหน้าคนที่มีกรรมหนักได้ทุกคน'],
    schedule: { morning: route(stop('mkt_n', 'idle', 'guard', [6, 10]), 'pl_ne', stop('mkt_e', 'idle', 'guard', [6, 10]), 'pl_se', stop('mkt_s', 'idle', 'guard', [6, 10]), 'pl_sw', stop('mkt_w', 'idle', 'guard', [6, 10]), 'pl_nw'), day: route(stop('mkt_n', 'idle', 'guard', [6, 10]), 'pl_ne', stop('mkt_e', 'idle', 'guard', [6, 10]), 'pl_se', stop('mkt_s', 'idle', 'guard', [6, 10]), 'pl_sw', stop('mkt_w', 'idle', 'guard', [6, 10]), 'pl_nw'), evening: guard(P(3.5, 6, Math.PI, 'mkt_n')), night: route('mkt_n', 'pl_ne', 'mkt_e', 'pl_se', 'mkt_s', stop('shops_m', 'idle', 'guard', [6, 10]), 'mkt_s', 'pl_sw', 'mkt_w', 'pl_nw') } },

  // ---------- Craft shops ----------
  // ลุงดำ took over the forge from ช่างทองดี; the id stays `blacksmith` (quests and tests use it).
  { id: 'blacksmith', name: 'ลุงดำ', occupation: 'blacksmith', home: { near: 'bl2' }, shopType: 'blacksmith', interactionRadius: 6.2,
    // Old, burly, skin darkened by forty years at the forge; grey crop, white headband, ผ้าขาวม้า at the waist.
    look: { skin: '#7a5236', hair: '#9a948a', hairStyle: 'crop', bottom: '#3a2e24', sash: '#a8432f', hat: 'headband', scale: 1.06 },
    dialogue: [
      'เข้ามาสิ ยืนเกะกะหน้าเตาทำไม ไฟมันไม่กัดเอ็งหรอก... ข้าลุงดำ ตีเหล็กมาตั้งแต่ก่อนเอ็งเกิด',
      'เหล็กน้ำพี้ต้องเผาจนแดงเป็นสีลูกตำลึง แล้วตีให้ถึงเนื้อ ทำลวก ๆ ดาบจะหักกลางศึก',
      'จะออกประตูวาปไปทุ่งนอกเมืองรึ? อย่าไปมือเปล่า หมูป่าในสวนผลไม้เขี้ยวมันแทงทะลุหนังคนได้',
      'ตกค่ำผีป่ากับผีพรายออกเพ่นพ่านแถวชายป่า ดาบดี ๆ กับเกราะหนังสักตัว ช่วยให้เอ็งได้กลับมากินข้าวเย็นที่บ้าน',
      'ได้หนังสัตว์ เขี้ยวหมูป่ามา เอามาขายข้าได้ ข้าให้ราคาไม่โกงเอ็งหรอก',
    ],
    schedule: shopHours(work('forge_smith', 'hammer')) },
  { id: 'enhancer', name: 'หมื่นเพชรศาสตรา', occupation: 'enhancer', home: { near: 'bl3' }, shopType: 'enhance', interactionRadius: 5.6,
    dialogue: ['เปลวไฟสีฟ้านี้ไม่ใช่ไฟธรรมดา มันหลอมได้ทั้งเหล็กและวิญญาณของศาสตรา', 'ตีบวกมีทั้งสำเร็จและแตกหัก เจ้าพร้อมรับความเสี่ยงหรือไม่'],
    schedule: shopHours(work('enhance_master', 'hammer')) },
  { id: 'general_merchant', name: 'เจ๊กฮวด', occupation: 'merchant', home: { near: 'shops_m' }, shopType: 'general',
    dialogue: ['คบไฟ เชือก เสบียง ครบทุกอย่างสำหรับคนเดินทาง', 'จะออกไปทุ่งนอกเมืองอย่าลืมพกยาติดตัว ข้างนอกไม่มีหมอยาเดินตามเอ็งนะ'],
    schedule: shopHours(work('general_keeper', 'sell')) },
  // Last stop before the warp: just inside the North Gate, beside the avenue.
  { id: 'gate_supplier', name: 'แม่ค้าเสบียงจันทร์เพ็ญ', occupation: 'merchant', gender: 'f', home: { near: 'gate_in' }, shopType: 'supplies', props: ['basket'],
    dialogue: [
      'ยาหม้อ น้ำผึ้งป่า ซื้อติดตัวไว้ก่อนเข้าประตูวาปเถิดพ่อคุณ ข้างนอกไม่มีร้านให้วิ่งกลับมาทัน',
      'ใครกลับจากทุ่งมาพร้อมหนังสัตว์กับเขี้ยวหมูป่า ป้ารับซื้อหมด ไม่ต้องหอบไปถึงตลาด',
      'ตกค่ำแล้วผีออกเดินในทุ่ง ทหารเฝ้าประตูยังต้องจุดโคมทั้งคืน เอ็งจะไปก็พกยาไปเยอะ ๆ',
    ],
    schedule: shopHours(work(P(-8, -99, Math.PI / 2, 'gate_in'), 'sell')) },
  // หมอยาเย็น keeps the herb shop; the class is taught at สำนักหมอยา by หมอหลวงพรหม (master_herbal).
  { id: 'herbalist', name: 'หมอยาเย็น', occupation: 'herbalist', gender: 'f', home: { near: 'shops_m' }, shopType: 'herbalist',
    dialogue: ['ใบไม้ทุกใบเป็นยา ถ้ารู้จักใช้', 'เช้า ๆ ข้าออกประตูวาปไปเก็บสมุนไพรริมสวนผลไม้ สายหน่อยก็กลับมาเปิดร้าน', 'อยากเป็นหมอยาเต็มตัว ไปกราบหมอหลวงพรหมที่สำนักหมอยา ย่านสำนักครูโน่น'],
    schedule: { morning: work('herb_gather', 'gather'), day: work('herb_keeper', 'grind'), evening: work('herb_keeper', 'grind'), night: HOME } },
  { id: 'occultist', name: 'หมออาคมเฒ่า', occupation: 'occultist', home: { near: 'shops_s' }, shopType: 'occult',
    dialogue: ['ตะกรุดดอกนี้ลงอักขระไว้สามคืน', 'ยามค่ำคืนวิชาอาคมแรงกว่ากลางวัน ร้านข้าจึงเปิดถึงดึก', 'ประตูเหนือยังปิดตาย แต่หมอผีเปิดทางวาปไว้ใต้ซุ้ม... หลังกำแพงมีสุสานเก่า ตกดึกวิญญาณเดินกันเต็มทุ่ง พกตะกรุดไปด้วย'],
    schedule: { morning: sit('occult_keeper', 'chant'), day: sit('occult_keeper', 'chant'), evening: sit('occult_keeper', 'chant'), night: sit('occult_keeper', 'chant') } },

  // ---------- Class masters (ย่านสำนักครู, src/data/halls.js) ----------
  // Each master works at `<hall id>_master` (spot registered by the hall builder) and goes home at night;
  // the หมอผี and the โจรป่า keep their halls open through the night, when their arts are strongest.
  { id: 'master_muay', name: 'ครูมวยเสือ', occupation: 'boxing_master', home: { near: 'hq_s' }, trainer: 'muay', interactionRadius: 5,
    dialogue: ['ไหว้ครูก่อนเข้าค่าย! ข้าครูมวยเสือ เจ้าของค่ายมวยไทยแห่งนี้', 'หมัด เท้า เข่า ศอก ทุกส่วนคืออาวุธ มวยไทยเน้นพลังกับความว่องไว ตีหนักและตีถี่', 'เพิ่มพลังให้หมัดหนัก เพิ่มว่องไวให้หลบเขี้ยวหมูป่าได้ อย่าลืมไปลองแม่ไม้กับหุ่นฟางก่อนออกทุ่ง'],
    schedule: shopHours(work('hall_muaythai_master', 'box')) },
  { id: 'master_sword', name: 'ครูดาบสิงห์', occupation: 'sword_master', home: { near: 'hq_1' }, trainer: 'sword',
    dialogue: ['ยืนให้ตรง! ข้าครูดาบสิงห์ เคยรบมาแล้วสามศึก', 'นักรบคือโล่ของพวกพ้อง พลังให้ดาบหนัก ความอึดให้ยืนรับศัตรูได้นานกว่าใคร', 'ดาบสองมือต้องใช้ใจเดียว ออกทุ่งไปเมื่อใด จงยืนหน้า ให้เพื่อนยิงจากข้างหลัง'],
    schedule: shopHours(work('hall_warrior_master', 'sword')) },
  { id: 'master_hunter', name: 'พรานบุญ', occupation: 'hunter', home: { near: 'hq_2' }, trainer: 'hunter',
    dialogue: ['เดินเบา ๆ หน่อย... ข้าพรานบุญ ล่าสัตว์ในป่าเหนือมาครึ่งชีวิต', 'นายพรานยิงจากที่ไกล ความชำนาญให้ลูกศรแม่นและแรง ว่องไวให้ถอยหนีทัน โชคให้ศรเข้าจุดตาย', 'ป่าเหนือเมืองมีสัตว์และสิ่งที่ไม่ใช่สัตว์ ไอ้ด่างหมาคู่ใจจะดมกลิ่นผีให้เอ็งก่อนมันจะถึงตัว'],
    schedule: shopHours(work('hall_hunter_master', 'aim')) },
  { id: 'master_herbal', name: 'หมอหลวงพรหม', occupation: 'herbalist', home: { near: 'hq_3' }, trainer: 'herbal',
    look: { hair: '#c9c4ba' },
    dialogue: ['มาเถิด นั่งลงก่อน ข้าหมอหลวงพรหม เคยถวายงานหมอในวังมาสามแผ่นดิน', 'หมอยาเรียนทั้งยารักษาและยาพิษ ปัญญาให้ตำรับแรง ความอึดให้อยู่รอดจนเพื่อนกลับบ้านครบ', 'สมุนไพรดีขึ้นริมสวนผลไม้นอกกำแพง หนาดกับขมิ้นไล่ผีพรายได้ จำไว้'],
    schedule: shopHours(work('hall_herbalist_master', 'grind')) },
  { id: 'master_shaman', name: 'หมอผีจันทร์', occupation: 'shaman', home: { near: 'hq_3' }, trainer: 'shaman',
    dialogue: ['ข้าเห็นเจ้ามาตั้งแต่เปลวเทียนไหว... ข้าหมอผีจันทร์ ผู้เปิดประตูวาปใต้ซุ้มประตูเหนือ', 'หมอผีใช้ปัญญาเป็นเวท ความชำนาญให้ร่ายไว ยันต์เพลิงกับคุณไสยแรงที่สุดในหกสาย แต่ร่างบาง อย่ายืนหน้า', 'ผีตายโหงในสุสานเก่าไม่ยอมไปผุดไปเกิด ตกค่ำมันออกเดินถึงทุ่งนา ต้องมีคนช่วยส่ง'],
    schedule: { morning: sit('hall_shaman_master', 'chant'), day: sit('hall_shaman_master', 'chant'), evening: sit('hall_shaman_master', 'chant'), night: sit('hall_shaman_master', 'chant') } },
  { id: 'master_bandit', name: 'เสือดำ', occupation: 'bandit', home: { near: 'hq_s' }, trainer: 'bandit',
    dialogue: ['ชู่ว... หาเรือนนี้เจอได้ก็ไม่เลว ข้าเสือดำ เคยเป็นโจรป่าที่ทหารทั้งกรุงตามจับ', 'โจรป่าอยู่ด้วยความว่องไวกับโชค หลบให้พ้น แทงให้ตรงจุด มีดคู่คมที่สุดยามค่ำคืน', 'ตกดึกผีออกเดินในทุ่ง คนอื่นหลบเข้าบ้าน แต่เงาคือบ้านของพวกเรา'],
    schedule: { morning: idle('hall_assassin_master', 'lean'), day: idle('hall_assassin_master', 'lean'), evening: idle('hall_assassin_master', 'lean'), night: idle('hall_assassin_master', 'lean') } },

  // ---------- City centre and residential ----------
  { id: 'guard_center', name: 'ทหารหลักเมือง', occupation: 'guard', home: { near: 'center' }, faction: 'city_guard',
    dialogue: ['ศาลหลักเมืองคือหัวใจของนคร', 'ข้าเฝ้าที่นี่มาแล้วเจ็ดปี'],
    schedule: { morning: guard(P(4.5, -27, Math.PI / 2, 'center')), day: guard(P(4.5, -27, Math.PI / 2, 'center')), evening: guard(P(4.5, -27, Math.PI / 2, 'center')), night: route(stop('center', 'idle', 'guard', [10, 14]), 'rw1', 'rw2', 'rw3', 'rw2', 'rw1') } },
  { id: 'pillar_devotee', name: 'ยายสมบุญ', occupation: 'villager', gender: 'f', home: { near: 'rw1' },
    dialogue: ['ไหว้หลักเมืองทุกเช้า ให้ลูกหลานปลอดภัย', 'เจ้าเป็นคนต่างถิ่นหรือ? ยินดีต้อนรับสู่อโยธยา'],
    schedule: { morning: idle('pillar_pray', 'pray'), day: route('center', 'br_n', 'br_s', 'mkt_n', stop('stall_o3_c', 'talk', 'talk', [8, 12]), 'mkt_n', 'br_s', 'br_n', stop('center_bench', 'sit', 'rest', [20, 30])), evening: idle('pillar_pray', 'pray'), night: HOME } },
  { id: 'old_man_bench', name: 'ตาปั้น', occupation: 'villager', home: { near: 'center' },
    dialogue: ['สมัยข้ายังหนุ่ม คลองนี้มีเรือแน่นจนเดินข้ามได้', 'นั่งพักก่อนสิ แดดร้อน'],
    schedule: { morning: sit('center_bench'), day: sit('center_bench'), evening: sit('center_bench'), night: HOME } },
  { id: 'sweeper', name: 'ยายเอียด', occupation: 'villager', gender: 'f', home: { near: 'rw2' }, props: ['broom'],
    dialogue: ['ลานบ้านต้องกวาดทุกเช้าทุกเย็น', 'เด็กแถวนี้ซนนัก วิ่งเล่นทั้งวัน'],
    schedule: { morning: work(P(-37, -31, -Math.PI / 2, 'rw2'), 'sweep'), day: sit(P(-36.2, -29.4, -Math.PI / 2, 'rw2')), evening: work(P(-37, -31, -Math.PI / 2, 'rw2'), 'sweep'), night: HOME } },
  { id: 'gossip_a', name: 'ลุงเปลี่ยน', occupation: 'villager', home: { near: 'rn1' },
    dialogue: ['ได้ข่าวไหม คนเห็นแสงประหลาดแถวป่าเหนือ', 'หมอผีจันทร์เปิดประตูวาปใต้ซุ้มประตูเหนือ คนหนุ่ม ๆ เข้าแสงไปล่าหมูป่ากันทุกวัน'],
    schedule: { morning: talk(P(-44.6, -44, Math.PI / 2, 'rn1')), day: talk(P(-44.6, -44, Math.PI / 2, 'rn1')), evening: talk(P(-44.6, -44, Math.PI / 2, 'rn1')), night: HOME } },
  { id: 'gossip_b', name: 'ป้าพร', occupation: 'villager', gender: 'f', home: { near: 'rn1' },
    dialogue: ['แสงที่ไหนกัน ลุงก็ตาฝาดอีกแล้ว', 'ประตูเหนือปิดก็จริง แต่แสงวาปนั่นพาคนออกไปถึงทุ่งนอกเมือง ตกค่ำผีเดินเต็มทุ่ง ป้าไม่ไปเด็ดขาด'],
    schedule: { morning: talk(P(-43.3, -44.2, -Math.PI / 2, 'rn1')), day: talk(P(-43.3, -44.2, -Math.PI / 2, 'rn1')), evening: talk(P(-43.3, -44.2, -Math.PI / 2, 'rn1')), night: HOME } },
  { id: 'kid_a', name: 'เด็กหญิงอ้อย', occupation: 'child', gender: 'f', home: { near: 'rw3' },
    dialogue: ['ไล่จับกัน! ข้าเป็นยักษ์!', 'อย่าบอกแม่นะว่าข้ามาเล่นถึงนี่'],
    schedule: { morning: route('rw3', 'rn6', 'rn1', 'rw2', stop('rw3', 'idle', 'look', [2, 4])), day: route('rw3', 'rn6', 'rn1', 'rw2', stop('rw3', 'idle', 'look', [2, 4])), evening: route('rw3', 'rw2', stop('rw3', 'idle', 'look', [2, 4])), night: HOME } },
  { id: 'kid_b', name: 'เด็กชายมะลิ', occupation: 'child', home: { near: 'rw3' },
    dialogue: ['รอด้วย! วิ่งเร็วจัง', 'ข้าอยากเป็นทหารเหมือนพ่อ'],
    schedule: { morning: route('rn6', 'rn1', 'rw2', 'rw3', stop('rn6', 'idle', 'look', [2, 4])), day: route('rn6', 'rn1', 'rw2', 'rw3', stop('rn6', 'idle', 'look', [2, 4])), evening: route('rw2', 'rw3', stop('rw2', 'idle', 'look', [2, 4])), night: HOME } },
  { id: 'basket_woman', name: 'นางแตง', occupation: 'villager', gender: 'f', home: { near: 'rw3' }, props: ['headBasket'],
    dialogue: ['ผักบุ้งสด ๆ จากริมคลอง ไปขายที่ตลาด', 'ทูนกระจาดเดินไกลจนคอแข็ง'],
    schedule: { morning: carry('rw3', 'wb_n', 'wb_s', 'w2', 'w1', 'mkt_w', stop('stall_veg_c', 'talk', 'talk', [8, 12]), 'mkt_w', 'w1', 'w2', 'wb_s', 'wb_n', stop('rw3', 'idle', 'look', [6, 10])), day: carry('rw3', 'rw2', 'rw1', 'center', 'br_n', 'br_s', 'mkt_n', stop('stall_o1_c', 'talk', 'talk', [8, 12]), 'mkt_n', 'br_s', 'br_n', 'center', 'rw1', 'rw2', 'rw3'), evening: HOME, night: HOME } },

  // ---------- Temple ----------
  { id: 'monk_elder', name: 'พระอาจารย์มั่น', occupation: 'monk', home: 'kuti_a', map: 'city',
    dialogue: ['เจริญพร โยม', 'จิตที่สงบย่อมเห็นทางสว่าง', 'ความลับของเมืองนี้ บางส่วนถูกจารไว้ในใบลานของวัด'],
    schedule: { morning: route(stop('t1', 'idle', 'look', [2, 3]), 'tg', 'tw', 'ave1', 'center', stop('rw1', 'idle', 'pray', [6, 9]), 'rw2', stop('rn1', 'idle', 'pray', [6, 9]), 'rx1', 'ave1', 'tw', 'tg', 't1', 'ta', 'tb', 'c_sw', stop('temple_sala', 'sit', 'pray', [40, 60])),
      day: route('cs', 'c_se', 'ce', 'c_ne', 'cn', 'c_nw', 'cw', 'c_sw'), evening: route('cs', 'c_se', 'ce', 'c_ne', 'cn', 'c_nw', 'cw', 'c_sw'), night: HOME } },
  { id: 'monk_young', name: 'พระน้อย', occupation: 'monk', home: 'kuti_b', map: 'city', props: ['broom'],
    dialogue: ['เจริญพร ลานวัดต้องสะอาดเสมอ', 'หลวงพ่อสอนว่ากวาดใบไม้ก็คือการภาวนา'],
    schedule: { morning: route('t1', 'tg', 'tw', 'ave1', 'ave2', stop('gate_in', 'idle', 'pray', [6, 9]), 'ave2', 'ave1', 'tw', 'tg', 't1', stop('temple_sweep', 'work', 'sweep', [60, 90])), day: work('temple_sweep', 'sweep'), evening: route('cs', 'c_se', 'ce', 'c_ne', 'cn', 'c_nw', 'cw', 'c_sw'), night: HOME } },
  { id: 'monk_teacher', name: 'พระครูใบฎีกา', occupation: 'monk', home: 'kuti_a', map: 'city',
    dialogue: ['เจริญพร ศาลานี้เปิดให้ผู้เดินทางพักเสมอ', 'วัดสุวรรณเจดีย์สร้างมาพร้อมกับเมือง'],
    schedule: allDay(sit('temple_sala', 'pray')) },
  { id: 'temple_visitor', name: 'ยายทองคำ', occupation: 'villager', gender: 'f', home: { near: 'rx1' },
    dialogue: ['มาทำบุญให้ตายายที่ล่วงลับ', 'ไหว้พระเจดีย์ทองแล้วใจสงบ'],
    schedule: { morning: route('rx1', 'ave1', 'tw', 'tg', 't1', stop('temple_pray', 'idle', 'pray', [20, 30]), 'ta', 'tb', 'c_sw', 'cs', 'c_se', 'ce', 'c_ne', 'cn', 'c_nw', 'cw', 'c_sw', 'tb', 'ta', 't1', 'tg', 'tw', 'ave1'), day: idle('temple_pray2', 'pray'), evening: HOME, night: HOME } },
  { id: 'traveler', name: 'ผู้เดินทางพเนจร', occupation: 'traveler', home: 'bodhi_seat', map: 'city',
    dialogue: ['ข้าเดินทางมาจากหัวเมืองไกล ได้ยินว่าอโยธยางามนัก', 'ใต้ต้นโพธิ์นี้นอนหลับสบายกว่าโรงเตี๊ยม'],
    schedule: allDay(sit('bodhi_seat')) },
  { id: 'guard_temple', name: 'ทหารรักษาวัด', occupation: 'guard', home: { near: 'tw' }, faction: 'city_guard',
    dialogue: ['ถอดรองเท้าก่อนเข้าเขตพุทธาวาส', 'ข้ามีหน้าที่ดูแลความสงบของวัด'],
    schedule: { morning: guard(P(21.5, -48.5, -Math.PI / 2, 'tg')), day: guard(P(21.5, -48.5, -Math.PI / 2, 'tg')), evening: guard(P(21.5, -48.5, -Math.PI / 2, 'tg')), night: guard(P(21.5, -48.5, -Math.PI / 2, 'tg')) } },

  // ---------- North gate ----------
  { id: 'guard_gate_w', name: 'นายประตูอิน', occupation: 'guard', home: { near: 'gate_in' }, faction: 'city_guard',
    dialogue: ['บานประตูเหนือปิดตายตามรับสั่ง ผู้ใดจะกลับเข้าเมืองต้องเข้าแสงวาปข้างหลังข้า', 'ผู้ที่มีกรรมหนัก ทหารอโยธยาไม่ปล่อยให้เข้าเมือง', 'ถ้าบาดเจ็บหนัก กลับเข้าเมืองไปพักก่อน ทุ่งนี้ไม่ใช่ที่ของคนประมาท'],
    schedule: { morning: guard(P(-4, -116, Math.PI, 'gate_out')), day: guard(P(-4, -116, Math.PI, 'gate_out')), evening: guard(P(-4, -116, Math.PI, 'gate_out')), night: guard(P(-4, -116, Math.PI, 'gate_out')) } },
  { id: 'guard_gate_e', name: 'นายประตูจัน', occupation: 'guard', home: { near: 'gate_in' }, faction: 'city_guard',
    dialogue: ['ข้าเฝ้าแสงวาปนอกกำแพงนี้ทั้งวันทั้งคืน หมูป่ากับลิงในสวนผลไม้ยังพอสู้ไหว', 'ยิ่งเดินลึกเข้าป่ายิ่งอันตราย ตกค่ำผีป่าออกจากชายป่า ไกลไปถึงสุสานเก่ามีแต่วิญญาณ', 'เห็นแสงไฟแปลก ๆ ในป่าเหนือเมื่อคืน... อย่าไปคนเดียว'],
    schedule: { morning: guard(P(4, -116, Math.PI, 'gate_out')), day: guard(P(4, -116, Math.PI, 'gate_out')), evening: guard(P(4, -116, Math.PI, 'gate_out')), night: guard(P(4, -116, Math.PI, 'gate_out')) } },
  { id: 'guard_patrol', name: 'หมื่นตระเวน', occupation: 'guard', home: { near: 'ave1' }, faction: 'city_guard',
    dialogue: ['ข้าตระเวนรอบเมืองวันละหลายรอบ', 'ยามค่ำคืนทหารจะออกตระเวนมากขึ้น'],
    schedule: { morning: route('center', 'br_n', 'br_s', 'mkt_n', 'pl_ne', 'mkt_e', 'pl_se', stop('mkt_s', 'idle', 'guard', [4, 7]), 'pl_sw', 'mkt_w', 'pl_nw', 'mkt_n', 'br_s', 'br_n', 'center', 'ave1', 'ave2', stop('gate_in', 'idle', 'guard', [5, 8]), 'ave2', 'ave1'),
      day: route('center', 'br_n', 'br_s', 'mkt_n', 'pl_ne', 'mkt_e', 'pl_se', stop('mkt_s', 'idle', 'guard', [4, 7]), 'pl_sw', 'mkt_w', 'pl_nw', 'mkt_n', 'br_s', 'br_n', 'center', 'ave1', 'ave2', stop('gate_in', 'idle', 'guard', [5, 8]), 'ave2', 'ave1'),
      evening: route('gate_in', 'wr_w1', stop('wr_w2', 'idle', 'guard', [5, 8]), 'wr_w1', 'gate_in', 'wr_e1', 'wr_e2', stop('wr_e3', 'idle', 'guard', [5, 8]), 'wr_e2', 'wr_e1'),
      night: route('gate_in', 'wr_w1', stop('wr_w2', 'idle', 'guard', [5, 8]), 'wr_w1', 'gate_in', 'wr_e1', 'wr_e2', stop('wr_e3', 'idle', 'guard', [5, 8]), 'wr_e2', 'wr_e1') } },

  // ---------- Fishing village ----------
  { id: 'net_mender', name: 'ป้าเหลือง', occupation: 'fisher', gender: 'f', home: { near: 'fv_m' },
    dialogue: ['อวนขาดต้องชุนทุกวัน ไม่งั้นปลาหนี', 'ปลาตากแห้งของหมู่บ้านนี้ขึ้นชื่อที่สุด'],
    schedule: { morning: sit('fv_net', 'mend'), day: sit('fv_net', 'mend'), evening: sit('fv_net', 'mend'), night: HOME } },
  { id: 'fish_carrier', name: 'ไอ้ทุย', occupation: 'fisher', home: { near: 'fv_e' },
    dialogue: ['ปลาเต็มเข่ง! วันนี้โชคดี', 'ตากปลาให้แห้งก่อนเอาไปขายที่ตลาด'],
    schedule: { morning: carry(stop('fv_dock', 'work', 'lift', [4, 6]), stop('fv_rack', 'work', 'hang', [5, 8])), day: carry(stop('fv_dock', 'work', 'lift', [4, 6]), stop('fv_rack', 'work', 'hang', [5, 8])), evening: route('fv_e', 'port_w2', 'port_w', stop('fishW_b2', 'talk', 'talk', [10, 14]), 'port_w', 'port_w2', 'fv_e'), night: HOME } },
  { id: 'boat_fixer', name: 'ตาเชย', occupation: 'fisher', home: { near: 'fv_m' },
    dialogue: ['ยาชันเรือใหม่ก่อนหน้าน้ำหลาก', 'เรือลำนี้อายุมากกว่าเจ้าเสียอีก'],
    schedule: { morning: work('fv_boat'), day: work('fv_boat'), evening: sit('fv_boat'), night: HOME } },
  { id: 'boatwright', name: 'ช่างเรือเปีย', occupation: 'villager', home: { near: 'er_m' }, props: ['hammer'],
    dialogue: ['เรือลำนี้ใช้ไม้ตะเคียนทั้งลำ', 'วันหนึ่งเรือที่ข้าต่อจะพาผู้คนไปไกลถึงทะเล'],
    schedule: shopHours(work('boatyard', 'hammer')) },
  // ---------- ทุ่งนาข้าว (map `paddy`): the farmers' village by the warp ----------
  // The paddies' shop: restock and sell loot without warping back.
  { id: 'village_trader', name: 'ยายเพียร', occupation: 'merchant', gender: 'f', map: 'paddy', home: { near: 'fv2' }, shopType: 'village', props: ['basket'],
    dialogue: [
      'มาจากในเมืองรึลูก? ยายมียาหม้อกับน้ำผึ้งป่าพอให้ไปต่อได้อีกหน่อย',
      'หนังสัตว์ เขี้ยวหมูป่า ขี้เถ้าธูปจากผี เอามาขายยายได้ ไม่ต้องแบกกลับเข้าเมือง',
      'ตะวันตกดินเมื่อไรรีบกลับมาหมู่บ้านนะ ผีป่ามันออกมาจากชายป่า ไม่ปรานีใคร',
    ],
    schedule: shopHours(work(P(-69.5, -131, 0, 'fv2'), 'sell')) },
  { id: 'farmer_a', name: 'นายมา', occupation: 'farmer', map: 'paddy', home: { near: 'fv2' },
    dialogue: ['ปีนี้น้ำดี ข้าวในทุ่งนาหลวงงามทั้งแปลง', 'หมูป่าลงมากินข้าวกล้าจากสวนผลไม้ทุกคืน ใครล่ามันได้ข้าขอบใจนัก'],
    schedule: { morning: work('paddy_a', 'plant'), day: work('paddy_a', 'plant'), evening: sit('village_yard'), night: HOME } },
  { id: 'farmer_b', name: 'นางดวง', occupation: 'farmer', gender: 'f', map: 'paddy', home: { near: 'fv2' },
    dialogue: ['ดำนาตั้งแต่ไก่โห่ หลังแทบหัก', 'ตกค่ำได้ยินเสียงผีพรายหัวเราะจากชายป่า ปิดประตูนอนกันแต่หัวค่ำ'],
    schedule: { morning: work('paddy_b', 'plant'), day: work('paddy_b', 'plant'), evening: work('pounder', 'pound'), night: HOME } },
  { id: 'farmer_c', name: 'ลุงคำ', occupation: 'farmer', map: 'paddy', home: { near: 'fv3' }, props: ['pole'],
    dialogue: ['ข้าวเปลือกสองกระบุงนี้ต้องขึ้นยุ้งก่อนฝนมา', 'แต่ก่อนขนข้าวเข้าเมืองทางประตูเหนือ ตอนนี้ประตูปิด ต้องรอแสงวาปของหมอผีจันทร์'],
    schedule: { morning: carry('fv2', 'fb2', stop('paddy_d', 'work', 'plant', [10, 14]), 'fb2', 'fv2', stop('village_yard', 'work', 'lift', [4, 6])), day: carry('fv2', 'fb2', 'fc2', stop('paddy_b', 'work', 'plant', [10, 14]), 'fc2', 'fb2', 'fv2', stop('village_yard', 'work', 'lift', [4, 6])), evening: sit('village_yard'), night: HOME } },
  // ---------- ป่าลึก (map `deep_forest`) and วัดร้าง (map `wat_rang`) ----------
  // One wandering supplier just inside each wild map's entrance, there day and night,
  // so hunters can restock without walking back to the village (tests/two-maps-qa.test.js).
  { id: 'forest_herbalist', name: 'หมอแสง', occupation: 'herbalist', gender: 'f', map: 'deep_forest', home: { near: 'fe' }, shopType: 'herbalist', props: ['basket'],
    dialogue: [
      'ข้าเก็บสมุนไพรอยู่แถวศาลปากป่านี่แหละ ยาหม้อยังอุ่นอยู่ จะเอาสักกี่ขวด',
      'ข้ามสะพานขอนไม้ไปแล้วอย่าเดินออกนอกทาง ผีพรายมันชอบคนหลงทาง',
      'เลยไพรลึกไปทางเหนือคือวัดร้าง ตกค่ำแล้วข้าเองยังไม่กล้าไป',
    ],
    schedule: { morning: work(P(-2.4, -317, Math.PI / 2, 'fe'), 'sell'), day: work(P(-2.4, -317, Math.PI / 2, 'fe'), 'sell'), evening: work(P(-2.4, -317, Math.PI / 2, 'fe'), 'sell'), night: work(P(-2.4, -317, Math.PI / 2, 'fe'), 'sell') } },
  { id: 'wat_hermit', name: 'ตาฤๅษีพรหม', occupation: 'shaman', map: 'wat_rang', home: { near: 'f6' }, shopType: 'herbalist',
    dialogue: [
      'ข้าบำเพ็ญอยู่ปากทางวัดร้างมาหลายพรรษา ยาที่ข้าปรุงช่วยให้เจ้าเดินต่อได้',
      'ศาลร้างทางตะวันตกกับป่าช้าข้างหน้า ตกเย็นวิญญาณเร่ร่อนจะออกมาเดินเต็มทาง',
      'โบสถ์ร้างหลังป่าช้ามีของไม่ดีสิงอยู่ อย่าเข้าไปถ้ายังไม่แกร่งพอ',
    ],
    schedule: { morning: sit(P(2.5, -466, -Math.PI / 2, 'f6'), 'pray'), day: sit(P(2.5, -466, -Math.PI / 2, 'f6'), 'pray'), evening: sit(P(2.5, -466, -Math.PI / 2, 'f6'), 'pray'), night: sit(P(2.5, -466, -Math.PI / 2, 'f6'), 'pray') } },
  // ---------- คลองหนองบึง (map `klong`) ----------
  // The last trader before the marsh: moored by the deserted hamlet, day and night.
  { id: 'marsh_trader', name: 'แม่บัวผัน', occupation: 'merchant', gender: 'f', map: 'klong', home: { near: 'kv1' }, shopType: 'marsh', props: ['basket'],
    dialogue: [
      'เรือยายจอดตรงนี้มาตั้งแต่ชาวบ้านทิ้งหมู่บ้านไป ยาหม้อกับน้ำผึ้งป่ายังพอมีนะลูก',
      'อย่าลงเดินในดงอ้อตอนค่ำ ผีพรายน้ำมันดึงขาคนลงหนอง',
      'คนเฒ่าคนแก่ว่าใต้หนองใหญ่ทางตะวันออกเฉียงใต้ ชาละวันยังไม่ตาย มันรอเหยื่ออยู่',
    ],
    schedule: { morning: work(P(20.5, -626, -Math.PI / 2, 'kv1'), 'sell'), day: work(P(20.5, -626, -Math.PI / 2, 'kv1'), 'sell'), evening: work(P(20.5, -626, -Math.PI / 2, 'kv1'), 'sell'), night: work(P(20.5, -626, -Math.PI / 2, 'kv1'), 'sell') } },
];


for(const e of EXPEDITIONS)NPCS.push({id:`supply_${e.id}`,name:`คนเสบียง · ${e.name}`,occupation:'merchant',gender:'female',map:e.id,home:`${e.id}_supply`,shopType:`supplies_${e.id}`,interactionRadius:3,dialogue:['พักเติมเสบียงก่อนเข้าวงล่า ให้เพื่อนพร้อมแล้วค่อยไปด้วยกัน'],schedule:Object.fromEntries(['morning','day','evening','night'].map(p=>[p,{do:'stay',at:`${e.id}_supply`,state:'work',anim:'sell'}]))});
