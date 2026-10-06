# หมอยา · ชุดผลิตโมเดล 3D

ใช้คู่กับ `docs/character-assets.md` และใช้รูปแบบเดียวกับ `../muaythai/PRODUCTION.md`
ไฟล์นี้รวมข้อมูลเฉพาะของหมอยา: ภาพอ้างอิง, prompt, สี, checklist และวิธีนำเข้าเกม

## ไฟล์อ้างอิง (ตัดจาก `../herbalist.webp`)

| ไฟล์ | ใช้ทำอะไร |
| --- | --- |
| `ref-front.png` | ท่าหลักด้านหน้า ถือตำรายาและดอกไม้ ขอบขวามีภาพด้านข้างติดมา ให้ ImageGen ลบออก |
| `ref-side.png` | ด้านข้าง |
| `ref-back.png` | ด้านหลัง: ผ้าคลุมไหล่เขียว สายกระเป๋าพาดหลัง ผ้าห้อยเอว |
| `detail-pouch.png` | ย่ามหนังน้ำตาลใส่สมุนไพร ขวดยา น้ำเต้า จี้ทองกลม และพู่ |
| `detail-wrist.png` | ประคำไม้, เชือกพันข้อมือ, ป้ายไม้ห้อยลายใบไม้ |
| `detail-sandals.png` | ผ้าพันแข้งเขียว, รองเท้าแตะหนังสายไขว้, จี้ทองที่ข้อเท้า |

## ขั้นที่ 1 · ImageGen: ภาพ turnaround สะอาด

Tripo ให้ผลดีที่สุดเมื่อได้ภาพตัวละครเดี่ยว ยืนท่า A-pose **มือเปล่า** ไม่ถือตำราหรือดอกไม้
(อุปกรณ์ถือค่อยทำเป็นชิ้นแยกทีหลัง) แนบ `ref-front.png`, `ref-side.png`, `ref-back.png` และภาพ detail ทั้งหมด

```
Full-body character turnaround sheet of the SAME character as the reference images:
front view, left side view, back view, side by side, evenly spaced, same scale.
Neutral A-pose: standing straight, feet shoulder-width apart, arms angled down
about 30 degrees away from the body, open relaxed EMPTY hands (no book, no flower),
looking forward, gentle calm smile.

Character: young Thai traditional herbal healer (mo ya), stylized anime game
character, semi-realistic proportions (about 7 heads tall), slim build,
warm light-tan skin, messy brown hair tied in a high bun with a small white
jasmine flower and a green-and-white ribbon hanging at the back.
Outfit (keep exactly as reference):
- loose cream-white wrap shirt with wide elbow-length sleeves, gold Thai border trim
- olive-green shoulder shawl / short cape with gold Thai leaf motifs, draped over
  both shoulders and hanging down the back
- layered waist: twisted cream-and-red cloth rope belt, olive-green front and back
  cloth panels with gold kranok pattern, white jasmine flowers tucked in the belt,
  hanging gold and cream tassels, small gourd and glass potion bottles on cords
- brown leather medicine pouch (yam bag) on the right hip with herbs sticking out,
  strap across the chest to the left shoulder
- dark checked short sarong over loose cream-white baggy trousers gathered below the knee
- olive-green and cream cloth leg wraps from knee to ankle with gold clasp charms
- brown leather sandals with crossed straps, bare toes
- wooden prayer-bead bracelets and cord wraps on both wrists, a small wooden tag charm

Clean flat light grey background, soft even studio lighting, no shadows on the
background, no text, no labels, no props in hands, no magic effects,
high detail, consistent colors across all three views.
```

ถ้าได้ภาพ 3 มุมรวมในภาพเดียว ให้ตัดแยกเป็น `front.png`, `side.png`, `back.png`
แล้วตรวจว่าทั้งสามภาพเป็นตัวละครเดียวกันจริง โดยดูว่าย่ามอยู่สะโพกขวาทุกภาพ, ผ้าคลุมเป็นสีเขียว และผมเป็นมวยสูง

ภาพเดี่ยวด้านหน้า สำหรับ single-image mode:

```
Same character as the reference, single full-body FRONT view, neutral A-pose,
arms 30 degrees from the body, open empty hands, feet apart, centered, entire body
visible including sandals, flat light grey background, even lighting, no text,
no props in hands.
```

## ขั้นที่ 2 · Tripo 3D (ตั้งค่า CLI ไว้แล้ว: `tripo`, region ov, ไฟล์ออกที่ `artifacts/tripo`)

ต้องเติมเครดิตก่อน (`tripo topup`, ยอดตอนตั้งค่าคือ 0) แนะนำให้ `--dry-run` ดูราคาก่อนรันจริง

```sh
# multiview: ภาพจากขั้นที่ 1
tripo make front.png side.png back.png --for game-pc --then texture,rig --name herbalist --dry-run
tripo make front.png side.png back.png --for game-pc --then texture,rig --name herbalist

# หรือ single image
tripo make front.png --for game-pc --then texture,rig --name herbalist

tripo view @herbalist        # ตรวจในเบราว์เซอร์ก่อนใช้
```

- ใช้ rig ของ Tripo ได้เลย (มวยไทยก็ใช้ rig ชื่อกระดูก `mixamorig` จาก Tripo) หรือจะส่ง Mixamo ตามขั้นตอนใน `../muaythai/PRODUCTION.md` ก็ได้
- จำนวน polygon ประมาณ 20k–30k faces
- สิ่งที่ต้องตรวจ:
  - นิ้วไม่ติดกัน
  - ขาสองข้างแยกกัน
  - ผ้าห้อยเอวไม่หลอมรวมกับต้นขามากเกินไป
  - ย่ามไม่ติดกับแขน

## ขั้นที่ 3 · ท่าทาง

เกมต้องใช้คลิปเหล่านี้ ตั้งชื่อตามนี้ใน GLB (`src/classes/model.js` จับคู่ชื่อให้อัตโนมัติ):

| clip | ใช้ตอน |
| --- | --- |
| `idle` | ยืนนิ่ง **เท้าติดพื้น** (ตอนนี้โค้ดจะตรึงสะโพกของ idle ไว้ เพื่อไม่ให้เท้าเด้ง) |
| `walk`, `run` | เดินและวิ่งแบบ in-place |
| `hurt`, `die` | โดนตีและล้ม |
| `cast` | ร่ายยา ยื่นมือไปด้านหน้า (สกิล ลูกดอกสมุนไพร / ยาหอมโบราณ) |
| `toss` | โยนน้ำเต้ายา (ยาพิษใบไม้) |
| `heal` | คุกเข่าข้างเดียว สองมือแผ่พลัง (วงสมุนไพร) |

ท่าอ้างอิงคือ Healing Stance / Herb Toss / Support Casting ใน `../herbalist.webp`
ถ้าท่าที่ Tripo ให้มายังไม่พอ ให้ทำแบบมวยไทย คือเขียนสคริปต์ประกอบท่าตามแนว `tools/muaythai-anims/compose.mjs`

## ขั้นที่ 4 · เข้าเกม

1. วางไฟล์ที่ `public/models/herbalist.glb`
2. `src/data/training.js` → `AVATARS.herbalist` ตั้ง `url` ไว้แล้ว เปิดให้เลือกในหน้าสร้างตัวละครด้วย `ready: true`
3. เปิดหน้าแรก `/` (ใส่ `?classes=all` ระหว่างทดสอบ) สร้างตัวละครเป็นหมอยา
   ถ้าไฟล์โหลดไม่ได้ จะเหลือแค่วงแหวนใต้เท้าและแจ้งเตือนใน console

ชุดสกิล 3D + FX ของหมอยายังไม่ได้พอร์ต (มี prototype อยู่ที่ `prototypes/skill-fx/demos/healer_fx.html`)
ตอนนี้หมอยาจะใช้สกิลของระบบต่อสู้เมืองไปก่อน

## สี (ดูดจาก concept sheet)

| ส่วน | สี |
| --- | --- |
| ผิว | `#d9a77c` |
| ผม | `#5b3a22` |
| เขียวผ้าคลุม/ผ้าห้อย | `#4f6b3a` |
| ขาวครีมเสื้อ/กางเกง | `#efe8d8` |
| ทองลายไทย/จี้ | `#c9a256` |
| หนังย่าม/รองเท้า | `#6e4426` |
| ผ้าลายตาหมากรุก | `#3b3633` |

## Checklist เทียบกับ concept sheet

- [ ] ผมน้ำตาลมัดมวยสูง มีดอกมะลิขาวและริบบิ้นเขียวขาวห้อยด้านหลัง
- [ ] เสื้อครีมแขนกว้างยาวถึงศอก ขอบลายทอง
- [ ] ผ้าคลุมไหล่สีเขียวมะกอก ลายใบไม้ทอง ห้อยยาวด้านหลัง
- [ ] เข็มขัดเชือกครีมแดง ผ้าห้อยหน้าและหลังสีเขียวลายกนก มีพู่และดอกมะลิเหน็บ
- [ ] ย่ามหนังน้ำตาลที่สะโพกขวา มีสมุนไพรโผล่ สายพาดอกไปไหล่ซ้าย
- [ ] ขวดยาแก้วและน้ำเต้าห้อยเอว
- [ ] ผ้าซิ่นสั้นลายตาหมากรุกเข้ม ทับกางเกงครีมทรงหลวมที่รวบใต้เข่า
- [ ] ผ้าพันแข้งเขียวครีม จี้ทองที่ข้อเท้า รองเท้าแตะหนังสายไขว้
- [ ] ประคำไม้และเชือกพันข้อมือทั้งสองข้าง
- [ ] สัดส่วนประมาณ 7 หัว รูปร่างเพรียว หน้ายิ้มอ่อนโยน
