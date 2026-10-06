# หมอยา · ชุดท่า (Animation) ตามสกิลที่ออกแบบไว้

สกิลอ้างอิง `prototypes/skill-fx/src/healer_fx.src.html` (10 สกิล) · โมเดล: Tripo "หมอยา" (ชุดขาวเขียว ย่ามยา)
Rig: Humanoid · **Mixamo** · ทุกท่า in place · ท่าร่ายเริ่ม/จบที่ท่ายืน idle (ถือตำรายาไว้ข้างลำตัว)

หมอยาเป็นสายร่าย ท่าจึงใช้ร่วมกันหลายสกิล: 6 ท่าร่าย + ท่าพื้นฐาน

| clip | ยาว (วิ) | จังหวะสำคัญ | ใช้กับสกิล |
| --- | --- | --- | --- |
| `idle` | 2.4 วน | – | – |
| `walk` / `run` | วน | – | – |
| `hurt` / `die` | 0.5 / 1.6 | – | – |
| `cast_book` | 1.6 | ปล่อยพลัง 0.7 | สายใยสมุนไพร, หมอกยาชโลมใจ, ยาบำรุงกำลังเจ็ดพลัง |
| `toss` | 1.0 | ปล่อยมือ 0.45 | ขวดยาเด้งห้าทิศ |
| `kneel_heal` | 2.4 | แตะพื้น 0.9 | วงหนาดปราบผี, พรแม่โพสพ |
| `brew` | 2.4 | ยาเดือด 1.2 | ยาต้มพยัคฆ์เหิน |
| `pound` | 2.2 | ตำ 0.6 / 1.1 / 1.6 | ครกยาระเบิดสมุนไพร |
| `raise_sky` | 2.2 | รับพร 1.1 | พิธีสู่ขวัญ, น้ำอมฤตชุบชีวา |

## สถานะ

ทุกท่าในตารางมีแล้วใน `public/models/herbalist.glb` (11 clip) สร้างด้วย `tools/herbalist-anims/compose.mjs`
ตำรายาเล่มดำไม่ได้อยู่ในโมเดล เป็นพร็อพ 3D ใน `src/forest/fx/herbalist-skills.js` ที่โผล่มาตอนใช้สกิล
(ถือในมือซ้ายสำหรับท่าที่ใช้มือเดียว ลอยข้างไหล่สำหรับท่าสองมือ) และเปิดออกตอนปล่อยพลัง

## Prompt (Tripo Animate)

ลงท้ายทุกท่าร่ายด้วย `In place, no root drift. Starts and ends in a calm standing pose holding a herbal book at the side.`

**idle**
```
Gentle Thai herbalist healer idle, seamless loop. Standing relaxed and upright, a herbal book held in the left hand at the hip, right hand loose. Soft breathing, slight sway, head tilts a little as if listening to the forest. 2.4 seconds per loop. In place.
```
**walk**
```
Thai herbalist healer walking forward, seamless loop. Calm, light graceful steps, book held at the left hip, right arm swinging softly, loose sleeves and sash swaying. 1.1 seconds per cycle. In place, no root drift.
```
**cast_book**
```
Herbalist opens a book held in the left hand at chest height, reads, then sweeps the right palm forward and up to release a healing spell at 0.7 seconds, fingers spread, body leaning slightly forward, then closes the book. Total 1.6 seconds.
```
**toss**
```
Herbalist takes a small medicine bottle from a waist pouch with the right hand and tosses it forward in an underhand-to-overhand arc, release at 0.45 seconds, follow-through with the arm, weight shifting onto the front foot. Total 1.0 second.
```
**kneel_heal**
```
Herbalist drops to one knee and presses the right palm onto the ground at 0.9 seconds as if sending life into the earth, left hand holds the book against the chest, head bowed, then rises back to standing. Total 2.4 seconds.
```
**brew**
```
Herbalist stirs a large pot in front of him with the right hand in two slow circles, leans back from the rising steam at 1.2 seconds, then lifts the hand high as if sending the vapor upward. Total 2.4 seconds.
```
**pound**
```
Herbalist grips a pestle with both hands and pounds downward into a mortar on the ground three times, impacts at 0.6, 1.1 and 1.6 seconds, knees bending on each hit, shoulders driving down, then straightens. Total 2.2 seconds.
```
**raise_sky**
```
Herbalist raises both arms slowly to the sky, palms up, receiving a blessing at 1.1 seconds, head tilted back, then lowers the arms forward in a sprinkling gesture over the ground. Total 2.2 seconds.
```
**hurt** / **die**: ใช้ prompt เดียวกับมวยไทยได้ (เปลี่ยนคำว่า Muay Thai fighter เป็น herbalist)

## ถ้ายังไม่ได้ animate ใน Tripo

ส่งโมเดลที่ rig แล้ว (มีแค่ walk/run หรือไม่มีท่าเลย) มาได้ สคริปต์ `tools/` จะประกอบท่าร่ายจากท่าพื้นฐานให้แบบเดียวกับมวยไทย
