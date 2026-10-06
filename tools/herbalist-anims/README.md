# สร้างท่าหมอยา 11 ท่า

`herbalist-tripo.glb` คือโมเดลหมอยาจาก Tripo (rig Mixamo, ยังไม่มีท่า) ส่งผ่าน Tripo Bridge เข้า Blender แล้ว export
`compose.mjs` สร้างท่าทั้งหมดลง `public/models/herbalist.glb`:

- `walk` / `run` — retarget จากท่าของนักมวยไทย (`tools/muaythai-anims/fighter-tripo.glb`) แบบเทียบทิศกระดูก
  เพราะ rest pose ของสอง rig ต่างกัน (ศอกขวาต่างกันถึง 165°) คัดลอก rotation ตรง ๆ ไม่ได้
- `idle`, `cast_book`, `toss`, `kneel_heal`, `brew`, `pound`, `raise_sky`, `hurt`, `die` — จัดท่าด้วยมือ (aim/bend/lift)
  ตามสเปกใน `docs/art/classes/herbalist/ANIMATIONS.md`

```sh
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4
node tools/herbalist-anims/compose.mjs
```

ถ้าทำท่าใน Tripo Animate ด้วย prompt ในสเปกแล้ว export ชื่อ clip เดิม เกมจะใช้ท่าใหม่แทนเอง
