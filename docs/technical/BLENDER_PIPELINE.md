# Blender → เกม: pipeline ตัวละคร 3D

เกมโหลดตัวละครจากไฟล์ `.glb` ที่ `public/assets/characters/<id>.glb` ตามที่กำหนดใน
`src/player/characters.js` ถ้าไฟล์ยังไม่มี เกมจะใช้ตัวแทนชั่วคราวที่สร้างจากโค้ด
(`src/player/placeholderNakMuay.js`) โดยอัตโนมัติ จึงวางไฟล์จริงทับได้ทุกเมื่อโดยไม่ต้องแก้โค้ด

## สเปกไฟล์ที่เกมต้องการ

| หัวข้อ | ค่า |
| --- | --- |
| รูปแบบ | glTF Binary (`.glb`) รวม mesh, armature, animation และ texture ในไฟล์เดียว |
| ทิศทาง | หันหน้าไปทาง **+Z**, แกน **+Y** ขึ้น (Blender export: Forward = -Z, Up = +Y ซึ่งเป็นค่าเริ่มต้น) |
| ตำแหน่ง | เท้าอยู่ที่ y = 0, ตัวละครอยู่ตรงจุดกำเนิด เกมจะปรับขนาดให้ตาม `height` ใน `characters.js` เอง |
| สัดส่วน | 5–6 หัวตาม `docs/art/CHARACTER_GUIDE.md` |
| Polygon | ไม่เกิน ~15k triangles ต่อตัว (มองจากกล้องไกล รายละเอียดเล็กหายไปอยู่แล้ว) |
| Texture | 1 ชุดต่อตัว ขนาด ≤ 2048, แนว hand-painted ตาม `docs/art/MATERIAL_GUIDE.md` |
| Material | Principled BSDF ธรรมดา (export เป็น PBR) เกมใช้ toon shading ทับเองได้ |
| Animation | เป็น **Action แยกชื่อ** ใน NLA หรือ Dope Sheet ต้องมี clip ชื่อตามตารางด้านล่าง |

### ชื่อ clip ที่เกมค้นหา (ไม่สนตัวพิมพ์เล็ก-ใหญ่)

| state ในเกม | ชื่อ clip | ลักษณะ | loop |
| --- | --- | --- | --- |
| `idle` | `Idle` | ยืนย่อเข่าเล็กน้อย หายใจ | ใช่ |
| `walk` | `Walk` | เดิน 1 รอบ (ซ้าย-ขวา) ความยาว ~0.8 วินาที | ใช่ |
| `guard` | `Guard` | ตั้งการ์ดสูง ขยับเล็กน้อย | ใช่ |
| `elbow` | `ElbowStrike` | ศอกกลับ ~0.6 วินาที จบที่ท่ายืน | ไม่ |
| `knee` | `FlyingKnee` | เข่าลอย ~0.9 วินาที กระโดดช่วง 0.15–0.6 วินาที (เกมเลื่อนตัวไปข้างหน้าช่วงนี้) | ไม่ |

ถ้า clip ไหนหายไป เกมจะแจ้งใน console (`[hero] ... has no clips for: ...`) และท่านั้นจะไม่ทำงาน

## ขั้นตอนใน Blender

1. **โมเดล** จากภาพอ้างอิง `docs/art/references/nak-muay-class-sheet.webp`
   จะปั้นเอง หรือใช้บริการแปลงภาพเป็น 3D (Hunyuan3D / Hyper3D ผ่าน blender-design plugin) แล้วเก็บงานต่อก็ได้
   ถ้าใช้บริการแปลงภาพ ให้ทำ retopology ให้ polygon อยู่ในงบ และทำ UV ใหม่
2. **Rig** ด้วย Rigify หรือ armature ธรรมดา ใส่ weight ให้เรียบร้อย
3. **Animation** ทำ Action ตามชื่อในตาราง กด **Push Down** ทุก Action ลง NLA เพื่อให้ export ครบทุก clip
4. **Export** `File > Export > glTF 2.0`
   - Format: glTF Binary (`.glb`)
   - Include: Selected Objects (เลือก mesh + armature)
   - Transform: +Y Up
   - Data > Animation: เปิด **Animation**, **NLA Strips**, **Export all Actions** (ถ้ามี)
   - Data > Mesh: Apply Modifiers
5. วางไฟล์ที่ `public/assets/characters/nak-muay.glb` แล้วรีเฟรชเกม การ์ดตัวละครจะแสดงว่า "โมเดลจาก Blender (.glb)"

## ใช้ blender-design plugin (ให้ AI สั่ง Blender)

Plugin: <https://github.com/full-aigc-plugins/blender-design-plugin> ต้องรันบนเครื่องที่มี Blender เท่านั้น

ความต้องการ: Blender (เวอร์ชันล่าสุด), Node.js 22+, Python 3.11–3.13

```bat
cd D:\Project
git clone https://github.com/full-aigc-plugins/blender-design-plugin.git
cd ThaiNativeOnline
claude mcp add partme_blender -- node D:\Project\blender-design-plugin\scripts\mcp_bootstrap.mjs
claude mcp list
```

จากนั้นใน Claude Code พิมพ์ว่า "connect Blender" plugin จะติดตั้ง Add-on **PartMe Blender MCP**
เปิด Blender และเริ่ม connector ให้เอง ถ้าไม่สำเร็จให้ทำตาม `docs/getting-started.md` ของ plugin
(ติดตั้ง Add-on จากไฟล์ zip แล้วกด Start MCP Server ในแผง `N` ของ 3D View)

แล้วสั่งงานเช่น: "สร้างตัวละครนักมวยจากภาพ docs/art/references/nak-muay-class-sheet.webp
ตามสเปกใน docs/technical/BLENDER_PIPELINE.md แล้ว export เป็น public/assets/characters/nak-muay.glb"

## ทางเลือก: PixelLab (sprite 2D)

PixelLab (<https://pixellab.ai>) สร้าง sprite pixel art แบบหลายทิศพร้อมท่าทางได้ เหมาะกับเกมแนว 2D sprite
แต่ผลเป็น pixel art ซึ่งไม่ตรงกับ `docs/art/ART_BIBLE.md` (stylized 3D) ถ้าจะใช้ต้องตัดสินใจเปลี่ยนทิศทางศิลป์ก่อน

ข้อควรระวัง:
- การเจนใช้เวลาหลายนาทีต่อชุด ให้เจนแบบ batch ครั้งเดียวแล้วเก็บไฟล์ไว้ใน `public/assets/characters/`
  เกมต้องไม่เรียก PixelLab ตอนรัน
- API key เป็นความลับ ห้ามใส่ใน repo, `.mcp.json` ที่ commit, หรือแชท
  ตั้งค่าด้วย `claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer <KEY>"` บนเครื่องตัวเองเท่านั้น
- session บน cloud ต้องอนุญาตโดเมน `api.pixellab.ai` ใน Network access ของ environment ก่อนจึงจะเรียกได้
