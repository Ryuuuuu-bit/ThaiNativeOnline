# สร้างท่ามวยไทย 15 ท่าจากโมเดล Tripo

`compose.mjs` ประกอบท่าสกิลทั้ง 10 ท่า + idle / hurt / die จากท่าดิบที่ Tripo ใส่มาในโมเดล
(jab, jab-cross, teep, front kick, walk, run) แล้วเขียนเป็น GLB ที่เกมใช้

- ท่าต้นฉบับถูกสุ่มตัวอย่างเป็นท่าหลัก (การ์ด, หมัด, หมัดหลัง, ยกเข่า, เตะสูง) แล้วต่อกันด้วย
  keyframe ตามจังหวะใน `src/classes/muaythai-moves.js`
- ท่าที่ไม่มีในต้นฉบับ (ไหว้ครู, ศอก, กลอง, คาถา) ใช้การหมุนกระดูกตามทิศในโลก (`aim`, `bend`, `yaw`)
- หมุนตัว กระโดด ล้ม เป็น overlay ตามเวลา
- root ถูกล็อกแนวนอน (in place) เกมเป็นคนขยับตัวละครเอง

```sh
# ใช้นอกโปรเจกต์ (ไม่ได้เพิ่ม dependency ให้เกม)
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4
node tools/muaythai-anims/compose.mjs <Tripo export ต้นฉบับ>.glb public/models/muay-thai-fighter.glb
```

ต้องใช้ไฟล์ export ต้นฉบับจาก Tripo (มีท่า jab, jab-cross, teep, front_kick, walk, run)
ถ้าทำท่าใหม่ใน Tripo ที่ดีกว่า ให้ export ชื่อตาม clip ใน `docs/art/classes/muaythai/ANIMATIONS.md` แทนได้เลย
