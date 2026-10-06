# มวยไทย · ชุดท่า (Animation) ตามสกิลที่ออกแบบไว้

ท่าทั้งหมดผูกกับสกิล 10 ท่าใน `prototypes/skill-fx/src/boxer_skills.js` (จังหวะโดนเป้าอิงจากต้นแบบ)
ข้อมูลที่เกมใช้อยู่ใน `src/forest/muaythai-moves.js` — ชื่อ clip, ปุ่ม, ความยาว, เวลาที่หมัด/เท้าโดน

## Rig

- โมเดล: `public/models/muay-thai-fighter.glb` (Tripo, Humanoid · **Mixamo skeleton**)
- ทุกท่าต้องทำบน **rig ตัวเดียวกัน** และ export รวมเป็น GLB ไฟล์เดียว
- ทุกท่า **in place** (ไม่เดินหนีจุดเดิม) เกมเป็นคนขยับตัวละครเอง และตัดการเลื่อนของ Hips แนวนอนให้อัตโนมัติ
- ท่าโจมตีทุกท่า **เริ่มและจบที่ท่าการ์ด** (orthodox guard) เพื่อให้ต่อกับ idle ได้เนียน
- ตั้งชื่อท่าตอน export ตามคอลัมน์ **clip** ด้านล่าง (ถ้าตั้งไม่ได้ เกมจะเดาจากชื่อ prompt ได้บางท่า)

## ตารางท่า

| ปุ่ม | สกิล | clip | ยาว (วิ) | จังหวะโดน (วิ) | ใช้แทนชั่วคราว |
| --- | --- | --- | --- | --- | --- |
| – | ยืนการ์ด | `idle` | 2.0 วน | – | เฟรมแรกของ jab |
| – | เดิน | `walk` | 1.0 วน | – | มีแล้ว |
| – | วิ่ง | `run` | 0.7 วน | – | มีแล้ว |
| – | โดนตี | `hurt` | 0.5 | – | – |
| – | ล้ม | `die` | 1.6 | – | – |
| 1 | หมัดแย็บ | `boxer_jab` | 0.9 | 0.18 / 0.31 / 0.44 | jab |
| 2 | เตะก้านคอ | `boxer_kick` | 1.1 | 0.45 | front kick |
| 3 | จระเข้ฟาดหาง | `boxer_croc` | 1.4 | 0.55 / 0.85 | jab-cross |
| 4 | ไหว้ครูรำมวย | `boxer_waikru` | 3.2 | (บัฟ) | – |
| 5 | หักงวงไอยรา | `boxer_ngouy` | 1.6 | 0.95 | jab-cross |
| 6 | กลองมังคละปลุกใจ | `boxer_drum` | 2.6 | 0.40 / 0.85 / 1.30 | jab |
| 7 | ศอกกลับพลิกล็อก | `boxer_elbow` | 0.9 | 0.20 / 0.36 | jab-cross |
| 8 | เข่าลอยทะลวงฟ้า | `boxer_knee` | 1.2 | 0.60 | teep |
| 9 | กายเหล็กคาถามหาอุด | `boxer_iron` | 2.4 | (บัฟ) | – |
| 0 | หนุมานถวายแหวน | `boxer_hanuman` | 1.6 | ทุก 0.11 วิ × 8 | jab-cross |

## สถานะ

ทุกท่าในตารางมีแล้วใน `public/models/muay-thai-fighter.glb` (15 clip) สร้างด้วยสคริปต์
`tools/muaythai-anims/compose.mjs` จากท่าดิบของ Tripo ดูวิธีสร้างใหม่ใน README ของโฟลเดอร์นั้น
คุณภาพระดับ prototype: อ่านท่าออกจากมุมกล้องเกม แต่ยังไม่ลื่นเท่าท่า mocap/Tripo Animate
ถ้าจะอัปเกรดทีละท่า ใช้ prompt ด้านล่างใน Tripo แล้ว export ชื่อ clip เดิม

## Prompt สำหรับ Tripo Animate (ภาษาอังกฤษ)

ทุก prompt ลงท้ายด้วย `In place, no root drift. Starts and ends in orthodox Muay Thai guard.` แล้ว (ยกเว้น idle/walk/run)

**idle**
```
Muay Thai fighter idle in orthodox guard, seamless loop. Fists at cheek level, elbows tucked, chin down, weight on the back leg. Rhythmic Thai bounce: slight up-down sway on the balls of the feet, lead knee lifting a little every other beat, shoulders rolling gently. 2 seconds per loop. In place.
```

**hurt**
```
Muay Thai fighter taking a hit to the face: head snaps back, torso recoils, one small step back, then recovers into guard. 0.5 seconds.
```

**die**
```
Muay Thai fighter knocked out: legs buckle, body twists and falls backward onto the ground, arms limp, comes to rest lying on the back. 1.6 seconds. Does not return to guard.
```

**1 · หมัดแย็บ `boxer_jab`**
```
Muay Thai fighter throwing three rapid lead-hand jabs in a row, each snapping straight out at face height and back to the cheek, small forward step on the first jab, rear hand glued to the chin. Punches land at 0.18, 0.31 and 0.44 seconds. Total 0.9 seconds.
```

**2 · เตะก้านคอ `boxer_kick`**
```
Muay Thai fighter loading and throwing a full-power rear-leg high roundhouse kick to the neck: rise on the ball of the lead foot, full hip turn, shin strikes at head height at 0.45 seconds, kicking-side arm swings down for balance, full follow-through then back to guard. Total 1.1 seconds.
```

**3 · จระเข้ฟาดหาง `boxer_croc`**
```
Muay Thai fighter performing a spinning back heel kick ("crocodile tail whip") twice in a row: spin backward over the lead shoulder, rear leg whips out straight in a wide horizontal circle at body height, heel lands at 0.55 seconds, continue the momentum into a second spinning whip landing at 0.85 seconds. Arms tight during spins. Ends facing the starting direction. Total 1.4 seconds.
```

**4 · ไหว้ครูรำมวย `boxer_waikru`**
```
Muay Thai fighter performing a short Wai Khru Ram Muay: kneel on one knee, press palms together and bow forward to the ground once, rise slowly with arms sweeping outward like wings in a graceful Thai dance gesture, step in place in a proud ceremonial rhythm, finish by returning to guard. Respectful, slow and powerful. Total 3.2 seconds.
```

**5 · หักงวงไอยรา `boxer_ngouy`**
```
Muay Thai fighter performing a jumping downward elbow strike ("breaking the elephant's trunk"): crouch, explode upward into a high leap, rear elbow raised high above the head, then crash down driving the elbow straight down onto the opponent's head, impact at 0.95 seconds as the feet land in a deep crouch, hold the impact briefly, rise back to guard. Total 1.6 seconds.
```

**6 · กลองมังคละปลุกใจ `boxer_drum`**
```
Muay Thai fighter beating a large war drum standing in front of him: wide strong stance, raise both fists high and bring them down hard onto the drum three times in a steady heavy rhythm, impacts at 0.4, 0.85 and 1.3 seconds, body bouncing with each beat, then a proud chest-out pose and return to guard. Total 2.6 seconds.
```

**7 · ศอกกลับพลิกล็อก `boxer_elbow`**
```
Muay Thai fighter throwing two whipping elbow strikes: a lead horizontal elbow slash at 0.2 seconds, then the torso spins back and the rear elbow whips across in the opposite direction at 0.36 seconds, tight and fast, guard hand stays up. Total 0.9 seconds.
```

**8 · เข่าลอยทะลวงฟ้า `boxer_knee`**
```
Muay Thai fighter performing a flying knee: two quick steps, launch off the lead foot, rear knee drives upward and forward, both hands reaching forward to clinch the opponent's head, knee connects at chest-to-chin height at 0.6 seconds at the peak of the jump, land balanced and return to guard. Total 1.2 seconds.
```

**9 · กายเหล็กคาถามหาอุด `boxer_iron`**
```
Muay Thai fighter channeling an invulnerability charm: bring palms together in front of the chest and murmur, then spread the arms wide and flex the whole body, chest out, muscles tensed, a strong stomp of one foot, finish with fists clenched at the sides and return to guard. Powerful and still. Total 2.4 seconds.
```

**0 · หนุมานถวายแหวน `boxer_hanuman`**
```
Muay Thai fighter unleashing an eight-strike flurry in 0.9 seconds: jab, roundhouse kick, knee, elbow, cross, roundhouse kick, elbow, knee, one strike every 0.11 seconds, all aimed forward, extremely fast and fluid, ends with a short upward palm-offering gesture then guard. Total 1.6 seconds.
```

## ลำดับทำงาน

1. Tripo Studio → โมเดลมวยไทย → Animate ใส่ prompt ทีละท่า
2. ตั้งชื่อท่าตามคอลัมน์ clip แล้ว export **GLB** รวมทุกท่า
3. วางทับ `public/models/muay-thai-fighter.glb` แล้วกด 1–0 ในป่าสนใหญ่ เพื่อตรวจทุกท่า
4. ถ้าเวลาโดนไม่ตรงตาราง ปรับ `hits` ใน `src/forest/muaythai-moves.js` (ตอนผูกกับระบบ combat)
