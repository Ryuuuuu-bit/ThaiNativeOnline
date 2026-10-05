# Thai Native Online

แผนที่ต้นแบบสำหรับเกม RPG แฟนตาซีไทยยุคกรุงศรีอยุธยา สร้างด้วย Three.js และ Vite

## เริ่มใช้งาน

ต้องใช้ Node.js 22.12+ (หรือเวอร์ชันใหม่ที่ Vite รองรับ)

```sh
npm install
npm run dev
```

เปิด URL ที่ Vite แสดงใน terminal สำหรับ production ใช้ `npm run build` และตรวจด้วย `npm run preview`

## แผนที่: ป่าสนใหญ่

![ป่าสนใหญ่](docs/big-forest-preview.png)

- ต้นสนและต้นไม้ใบกว้างมีหิมะเกาะ ลำต้นโค้งตามแรงลมเป็นระลอก (gust) และปลายกิ่งพริ้วไหว เงาบนหิมะก็ไหวตาม
- แสงแดดอุ่น เงาสีฟ้านุ่ม เงาเมฆเคลื่อนผ่าน หิมะตก หญ้าแห้งโผล่พ้นหิมะ
- ตัวละครหลัก **นักมวยคาดเชือก** เป็น sprite 8 ทิศจาก PixelLab ที่นำมาจากโปรเจกต์เดิม `Ryuuuuu-bit/ThaiNative` (`client/assets/td/hero2_*_boxer_t1`) เลือกได้ด้วย `?hero=boxer-female` (ค่าเริ่มต้น, ภาพความละเอียดสูง) หรือ `?hero=boxer-male` (pixel art ขนาดเล็ก) ข้อมูลตัวละครอยู่ใน `src/player/characters.js`
- ทางเลือก 3D ตาม `docs/art/ART_BIBLE.md`: `?hero=nak-muay-3d` โหลด `public/assets/characters/nak-muay.glb` จาก Blender ([`docs/technical/BLENDER_PIPELINE.md`](docs/technical/BLENDER_PIPELINE.md)) ถ้ายังไม่มีไฟล์จะใช้ตัวแทนชั่วคราวที่สร้างจากโค้ด ([ตัวอย่าง](docs/nak-muay-placeholder.png)) ภาพอ้างอิงคลาสอยู่ที่ `docs/art/references/`
- สกิลบน hotbar: `1` หมัดตรง, `2` ศอกกลับ, `3` เข่าลอย (พุ่งไปข้างหน้า) ตอนนี้ sprite มีท่าโจมตีท่าเดียว ทุกสกิลจึงใช้ท่าเดียวกัน ส่วนโมเดล 3D ใช้ clip แยกตามชื่อ
- HUD แบบ glass ทันสมัย: การ์ดตัวละครพร้อมหลอด HP/SP, ชิปชื่อแผนที่, มินิแมป, dock สกิลและเครื่องมือด้านล่าง
- ตัวละคร sprite วาดเองสไตล์ RO ของเดิมยังอยู่ เปิดด้วย `/?sprite` และดาวน์โหลด sprite sheet 8 ทิศได้จากปุ่มในเกม ([ตัวอย่าง](docs/novice-8dir-spritesheet.png))
- เสียงป่าใหญ่จาก Web Audio: นก 7 ชนิด (trill, เสียงหวีดสองโน้ต, warble, นกกาเหว่าไกล ๆ, นกหัวขวาน, เสียงแหลมเล็ก, อีกา) กระจายซ้าย-ขวา ลม/ใบไม้ไหวตามแรงลม เสียงก้องในป่า และเสียงเหยียบหิมะ
- คลิกพื้นเพื่อเดินแบบ RO, ลากเมาส์ขวาหมุนกล้อง, ใบไม้ที่บังตัวละครจะโปร่งให้เห็น
- เครื่องที่ GPU อ่อน เปิด `/?low`

โค้ด: `src/forest/scene.js` (ป่า ลม หิมะ), `src/player/` (ข้อมูลคลาส, ตัวโหลด sprite 8 ทิศ `spriteHero.js`, ตัวโหลด .glb, ระบบท่าทาง และตัวแทนชั่วคราว), `src/forest/sprite.js` (sprite), `src/forest/audio.js` (เสียง), `src/forest/main.js`

## ควบคุม

| การกระทำ | ปุ่ม |
| --- | --- |
| เดินไปยังจุด | คลิกพื้น (เส้นตรง ไม่มี pathfinding; ใช้ WASD เดินอ้อม) |
| เดิน | W A S D / ลูกศร / ปุ่มสัมผัสบนมือถือ |
| หมุนกล้อง | ลากเมาส์ขวา |
| ซูม | Scroll |
| คืนมุมกล้อง | R |
| ใช้สกิล | 1 / 2 / 3 หรือคลิกช่องสกิล |
| ซ่อน UI ชมแผนที่ | H |

ภาพ ตัวละคร และเสียงทั้งหมดสร้างจาก geometry, canvas และ Web Audio ในโค้ด ไม่มี assets เกมจากแหล่งอื่น ฟอนต์ Noto โหลดจาก Google Fonts และมี system fallback เมื่อ offline

## ขอบเขตเวอร์ชัน 0.1

เวอร์ชันนี้เน้น map และการเดินสำรวจ ยังไม่มีระบบต่อสู้ EXP ดรอปไอเท็ม บอส multiplayer หรือ persistence

## ขั้นต่อไป

1. เพิ่มท่าสกิลเฉพาะ (ศอก เข่า) ให้ sprite นักมวยด้วย PixelLab และย่อขนาดไฟล์ชุด boxer-female (7.4 MB) ให้เล็กลง
2. เพิ่ม combat, monster spawn, EXP, inventory และ loot tables
3. เพิ่มลานบอส การบันทึกเกม และระบบออนไลน์
