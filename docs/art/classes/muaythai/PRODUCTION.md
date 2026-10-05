# มวยไทย · ชุดผลิตโมเดล 3D

ใช้คู่กับ `docs/character-assets.md` (ขั้นตอน Blender / Mixamo / ตรวจไฟล์) ไฟล์นี้คือ
ข้อมูลเฉพาะของอาชีพมวยไทย: ภาพอ้างอิง prompt สี และ checklist เทียบกับ concept sheet

## ไฟล์อ้างอิง (ตัดจาก `../muaythai.webp`)

| ไฟล์ | ใช้ทำอะไร |
| --- | --- |
| `ref-front.png` | ท่ายืนหลักด้านหน้า (ขอบภาพมีส่วนของภาพข้าง ๆ ติดมา ให้ ImageGen ลบออก) |
| `ref-side.png` | ด้านข้าง |
| `ref-back.png` | ด้านหลัง (ลายสักยันต์กลางหลัง) |
| `detail-headband.png` | มงคลถักแดงขาว จี้ทองข้าวหลามตัด พู่ด้านหลัง |
| `detail-handwraps.png` | ผ้าพันมือขาว เชือกแดง จี้ทอง |
| `detail-sash.png` | ผ้าคาดเอวหลายชั้น ผ้าขาวลายไทย จี้ทองและพู่ |

## ขั้นที่ 1 · ImageGen: ภาพ turnaround สะอาด

Tripo ให้ผลดีที่สุดเมื่อได้ภาพตัวละครเดี่ยว ยืนท่า A-pose พื้นหลังเรียบ แสงสม่ำเสมอ
แนบ `ref-front.png` + `ref-back.png` + ภาพ detail เป็นภาพอ้างอิง แล้วใช้ prompt นี้
(ภาษาอังกฤษให้ผลแม่นกว่า):

```
Full-body character turnaround sheet of the SAME character as the reference images:
front view, left side view, back view, side by side, evenly spaced, same scale.
Neutral A-pose: standing straight, feet shoulder-width apart, arms angled down
about 30 degrees away from the body, open relaxed hands, looking forward,
neutral calm expression.

Character: young Thai Muay Thai fighter, stylized anime game character,
semi-realistic proportions (about 7 heads tall), athletic lean muscular build,
warm tan skin, short messy brown hair.
Outfit (keep exactly as reference):
- braided red-and-white rope headband (mongkol) with a small gold diamond
  ornament on the right side and red/white tassels hanging at the back
- red-and-white braided rope armbands (prajiad) on both upper arms with red tassels
- white cloth hand wraps up to mid-forearm, crossed with thin red cords,
  fingers free
- black Muay Thai shorts with gold Thai kranok patterns, white and red hem trim
- layered waist sash: twisted red and white cloth rope, a hanging white cloth
  panel with orange-red Thai pattern in front, gold diamond buckle,
  gold and white tassels
- black shin guards with gold Thai motif, red-and-white rope ties at knee and ankle
- white ankle wraps, barefoot
- golden-brown sak yant tattoos on the right chest and shoulder, large sak yant
  on the upper back

Clean flat light grey background, soft even studio lighting, no shadows on the
background, no text, no labels, no props, no weapons, no motion effects,
high detail, consistent colors across all three views.
```

ถ้าได้ภาพ 3 มุมในภาพเดียว ให้ตัดแยกเป็น `front.png`, `side.png`, `back.png` ก่อนส่ง Tripo
ตรวจว่าทั้ง 3 ภาพเป็นตัวละครเดียวกันจริง (สีกางเกง ลายสัก ด้านที่มีจี้ทอง) ถ้าไม่ตรง ให้ gen ใหม่

ภาพเดี่ยวด้านหน้าสำหรับ single-image mode:

```
Same character as the reference, single full-body FRONT view, neutral A-pose,
arms 30 degrees from the body, open hands, feet apart, centered, entire body
visible including feet, flat light grey background, even lighting, no text,
no props.
```

## ขั้นที่ 2 · Tripo 3D

- โหมด: **Multiview to 3D** (ใส่ front / side / back) ถ้าไม่มี ใช้ **Image to 3D** กับภาพ front
- Texture: เปิด, คุณภาพ HD / PBR
- Style: ไม่ใช้ style filter (ให้ตามภาพ)
- จำนวน polygon: ประมาณ 20k–30k faces (ถ้ามีให้เลือก) หรือ export แล้วไปลดใน Blender
- **ไม่ต้อง rig ใน Tripo** — export เป็น **FBX** (หรือ GLB แล้วแปลงเป็น FBX ใน Blender) เพื่อส่ง Mixamo
- ตรวจผลก่อนดาวน์โหลด: นิ้วไม่ติดกัน ขาสองข้างแยกกัน ผ้าคาดเอวไม่หลอมกับต้นขามากเกินไป
  ถ้าแขนติดลำตัว ให้กลับไปแก้ภาพขั้นที่ 1 ให้แขนกางมากขึ้น

## ขั้นที่ 3 · Mixamo (ใส่กระดูก)

1. Upload FBX → วางจุด chin, wrists, elbows, knees, groin ตามที่ Mixamo ถาม
2. Skeleton LOD: **Standard Skeleton (65)** ก็ได้ เกมใช้เฉพาะกระดูกหลัก 28 ชิ้น
3. Download: Format **FBX Binary**, Pose **T-pose**, Skin **With Skin**
4. ไม่ต้องดาวน์โหลดท่าจาก Mixamo เพราะเกมมีท่าของมวยไทยอยู่แล้ว
   (ตั้งการ์ดยกเข่ากัน, ศอกตัด, เข่าลอย, ยืน, เดิน, วิ่ง)

## ขั้นที่ 4 · Blender + เข้าเกม

```
blender -b muaythai.blend --python tools/blender/prepare_character.py -- --class muaythai --out public/assets/characters/muaythai.glb
npm run check:character -- public/assets/characters/muaythai.glb
npm run dev   # เปิด /characters.html เลือกมวยไทย
```

(สคริปต์และคำสั่งตรวจไฟล์มาพร้อมระบบโหลดโมเดล GLB ดูรายละเอียดใน `docs/character-assets.md`)

## สี (ดูดจาก concept sheet)

| ส่วน | สี |
| --- | --- |
| ผิว | `#c98a5e` |
| ผม | `#5a3a22` |
| แดงผ้า/เชือก | `#a3202a` |
| ขาวผ้า | `#ece6da` |
| ดำกางเกง/สนับแข้ง | `#24201f` |
| ทองลายไทย/จี้ | `#c89b4a` |
| ลายสัก | `#7a5a35` |

## Checklist เทียบกับ concept sheet

- [ ] ผมน้ำตาล สั้น ยุ่ง ไม่ใช่ผมดำชี้
- [ ] มงคลเป็นเชือกถักแดงขาว (ไม่ใช่ผ้าคาดเรียบ) มีจี้ทองด้านขวา พู่ห้อยด้านหลัง
- [ ] ประเจียดเชือกถักที่ต้นแขนทั้งสองข้าง มีพู่แดง
- [ ] ผ้าพันมือขาวถึงกลางแขน เชือกแดงไขว้ นิ้วโผล่ (ไม่ใช่นวมกลม)
- [ ] กางเกงมวยดำ ลายกนกทอง ขอบขาวแดง
- [ ] ผ้าคาดเอวหลายชั้น แผ่นผ้าขาวลายไทยห้อยด้านหน้า จี้ทองข้าวหลามตัด พู่ทอง/ขาว
- [ ] สนับแข้งดำลายทอง เชือกแดงขาวที่เข่าและข้อเท้า
- [ ] ผ้าพันข้อเท้าขาว เท้าเปล่า (ไม่ใช่ถุงเท้าดำคลุมเท้า)
- [ ] ลายสักยันต์สีน้ำตาลทองที่อกขวา ไหล่ และกลางหลัง
- [ ] สัดส่วนประมาณ 7 หัว กล้ามเนื้อชัด หน้ายิ้มมั่นใจ
