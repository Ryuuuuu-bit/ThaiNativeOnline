# ต้นแบบเอฟเฟกต์สกิล 5 สายอาชีพ (three.js)

ต้นแบบเอฟเฟกต์สกิลครบ 10 สกิลต่อสาย (หมอยา ขุนศึก พรานป่า หมอผี นักมวย) ทำแยกเป็นหน้าเดี่ยว ไม่ได้ผูกกับโค้ด Vite ของโปรเจกต์ และไม่กระทบ `npm run build`

> **สถานะด้านอาร์ต:** เป็นต้นแบบสำหรับดูจังหวะและรูปแบบเอฟเฟกต์เท่านั้น ยังไม่ผ่าน Approval Gate ใน `docs/art/ART_BIBLE.md` ตัวละครเป็นสไปรต์พิกเซลจากโปรเจกต์ ThaiNative เดิม (legacy) และใช้ bloom ค่อนข้างแรง ซึ่งขัดกับ Art Bible (ตัวละคร 3D สไตล์อนิเมะ, หลีกเลี่ยง bloom เยอะ) ถ้าจะใช้จริงต้องปรับตาม Art Bible ก่อน

## demos/ — เปิดในเบราว์เซอร์ได้เลย

| ไฟล์ | สาย | ลิงก์ออนไลน์ |
|---|---|---|
| `hub_skills.html` | หน้ารวมทั้ง 5 สาย | https://claude.ai/artifact/S6iYE5dD57giSpG9j3Mvkj |
| `healer_fx.html` | หมอยา · ตำรับแสงหมอยา | https://claude.ai/artifact/LqzGioSdhojCDU9hX3jUcV |
| `warrior_fx.html` | ขุนศึก (ดาบคู่) · เพลงดาบขุนศึก | https://claude.ai/artifact/84hfpVn5YyrZwvGSohq1vK |
| `archer_fx.html` | พรานป่า · ศรพรานไพร | https://claude.ai/artifact/V8Ebd4yBBg4vmpUwCmi95D |
| `mage_fx.html` | หมอผี · อาคมหมอผี | https://claude.ai/artifact/Tr26eNA6sLdPKBmfSZG6rs |
| `boxer_fx.html` | นักมวย · แม่ไม้มวยไทย | https://claude.ai/artifact/EK9ckRDdZPgboUoW92Hp6u |

แต่ละไฟล์ฝังภาพทุกอย่างไว้ในตัว แต่โหลด three.js r160 กับฟอนต์จากอินเทอร์เน็ต (jsdelivr, Google Fonts)

## sprites/ — สไปรต์ใหม่จาก PixelLab (ย้ายมาจาก ThaiNative/concept)

ชีตแต่ละไฟล์มี 8 แถวตามทิศ ใต้ · ตอ.ใต้ · ตะวันออก · ตอ.เหนือ · เหนือ · ตต.เหนือ · ตะวันตก · ตต.ใต้ (ฝั่งตะวันตกกลับด้านจากฝั่งตะวันออก)

| โฟลเดอร์ | ตัวละคร | ท่า | ช่องละ | PixelLab |
|---|---|---|---|---|
| `healer_herbalist/` | หมอยาชุดสมุนไพรถือตำรายา | idle 5 · walk 8 · cast 9 | 128×136 | state "Healer Herbalist Book" `4f330ff1-52dc-43aa-ae76-4d5c2c0acc8d` |
| `sword_dual/` | ขุนศึก t2 ถือดาบคู่ | idle 5 · walk 8 · slash 9 | 128×136 | state "Sword T2 Dual" `ec44ae4f-c501-4caa-89e9-26a690b6412a` |
| `hunter_dog/` | หมาไทยหลังอานคู่ใจพราน | idle 5 · run 8 · bite 9 | 96×96 | character `38a99d80-ea8f-47e5-809b-3efa3bf84764` |

`rot_*.png` ในแต่ละโฟลเดอร์คือภาพหมุน 8 ทิศ (96×96) ต้นฉบับ

## art/ — ภาพลายเส้นยันต์ (วาดใหม่ด้วย PixelLab ไม่ได้ใช้ภาพอ้างอิงตรง ๆ)

- `hanuman_yant/` หนุมานถวายแหวน (ใช้ในสกิลหนุมานถวายแหวน)
- `erawan_yant/` ช้างเอราวัณสามเศียร (ใช้ในสกิลหักงวงไอยรา)

ลายกนก อักขระ และยันต์วงกลมของวงหนาดปราบผี วาดด้วยโค้ดในหน้าเดโม อักขระเป็นตัวอักษรสุ่มไว้ตกแต่ง ไม่ใช่คาถาจริง

## src/ — ซอร์สและสคริปต์

- `*_fx.src.html` ต้นฉบับของแต่ละเดโม (ภาพยังเป็นตัวแปร `__ASSETS__`)
- `build_healer.cjs`, `build_warrior.cjs`, `build_archer.cjs`, `build_mage.cjs`, `build_boxer.cjs` ฝังภาพลงไปแล้วได้ `*_fx.html`
  - รันจากในโฟลเดอร์ `src/` เช่น `node build_boxer.cjs`
  - สคริปต์ดึงสไปรต์เดิมของเกมจาก `E:/รับงานตัดนอก/ThaiNative/client/assets/` (path ในเครื่องผู้ทำ ต้องแก้ `R` ในสคริปต์ถ้าอยู่เครื่องอื่น) และภาพใหม่จาก `dual/`, `dog/`, `herb/`
- `dual/`, `dog/`, `herb/` เฟรมดิบที่ดาวน์โหลดจาก PixelLab + `jobs.json` (รหัสงาน), `fetch.mjs`, `mksheet.mjs` (ประกอบชีต)
- `*_skills.js`, `*_part.js`, `arc2.js`, `lightning2.js`, `meteor2.js`, `yant_circle.js` ฯลฯ โค้ดสกิลแยกชิ้นตอนพัฒนา (ของจริงอยู่ใน `*_fx.src.html` แล้ว)
- `*.v*.src.html` เวอร์ชันก่อนหน้าที่เก็บไว้เผื่อย้อนกลับ
- `shot*.mjs`, `cdp_eval.mjs` สคริปต์ถ่ายภาพหน้าจอด้วย Edge แบบไม่มีหน้าจอ (Windows)

## ภาพตัวอย่าง

เปิด `demos/hub_skills.html` จะเห็นภาพหน้าจอของทั้ง 5 สายพร้อมลิงก์
