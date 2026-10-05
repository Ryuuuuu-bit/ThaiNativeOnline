const fs = require('fs'); let s = fs.readFileSync('healer_fx.src.html', 'utf8');
const R = (a, b) => { if (!s.includes(a)) throw 'missing: ' + a.slice(0, 90); s = s.replace(a, b); };
// drop the buff helper block
const b0 = s.indexOf('/* ---------------- buff visuals:'), b1 = s.indexOf('/* =================== SKILLS =================== */');
if (b0 < 0 || b1 < 0) throw 'buff block'; s = s.slice(0, b0) + s.slice(b1);
// tiger
R('const d = decal(3, healer.pos.x, healer.pos.z, R, C(1.1, .45, .1), C(.5, .12, .02), { life: 1.6, grow: .5, alpha: .55 });', 'const d = decal(3, healer.pos.x, healer.pos.z, R, EMBER, C(1.4, .3, .05), { life: 1.6, grow: .5 });');
R(`      popup(headP(a), 'ป้องกัน +20% · เร็ว +25%', 'st b-tiger'); a.tint = 1; a.tintC = C(1.15, .85, .45);
      auraTiger(a, 4); buffChip(a, 'ic_heal_tiger', '#ff9a4a', 4);
`, `      popup(headP(a), 'ป้องกัน +20% · เร็ว +25%', 'st'); a.tint = 1; a.tintC = C(1.15, .85, .45);
      addTask((dt, t) => {
        for (let k = 0; k < 2; k++) { const an = t * 7 + k * Math.PI; const h = (t * 1.6 + k * .5) % 1.9;
          emit({ p: a.pos.clone().add(V(Math.cos(an + h * 3) * .45, h, Math.sin(an + h * 3) * .45)), v: V(0, .3, 0), c: k ? EMBER : C(2.5, 1.7, .5), life: .5, size: .1, size1: .02 }); }
        if (Math.random() < dt * 6) emit({ p: a.pos.clone().add(V(rand(-.4, .4), .05, rand(-.4, .4))), v: V(0, 0, 0), c: C(1.5, .55, .1), life: .4, size: .3, size1: .6, a: .5 });
        if (t > 4) return false;
      });
`);
// mist
R(`    after(.45, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'ป้องกัน +6', 'st b-mist'));
    auraMist(a, 3.4); buffChip(a, 'ic_heal_mist', '#7fdcff', 3.4);
`, `    const sh = new THREE.Mesh(new THREE.SphereGeometry(.85, 28, 18), fresnelMat(C(.5, 1.4, 1.6))); sh.scale.y = 1.35; sh.position.copy(a.pos).y = .9; scene.add(sh);
    addTask((dt, t) => { sh.material.uniforms.uTime.value = t; sh.material.uniforms.uA.value = clamp01(t * 4) * clamp01((2.4 - t) / .5); sh.position.copy(a.pos).y = .9;
      if (Math.random() < dt * 14) emit({ p: a.pos.clone().add(V(rand(-.5, .5), rand(.1, .6), rand(-.5, .5))), v: V(0, rand(.8, 1.4), 0), c: MPBLUE, life: .9, size: .09, shape: Math.random() < .3 ? SH.star : SH.glow });
      if (t > 2.4) { kill(sh); return false; } });
`);
// tonic
R(`living().forEach(a => { heal(a, a.maxHp * .05); after(.25, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'โจมตี +18% · ป้องกัน +15%', 'st b-tonic')); auraTonic(a, 4); buffChip(a, 'ic_heal_tonic', '#ff6a5a', 4); });`,
`living().forEach(a => { heal(a, a.maxHp * .05); after(.25, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'โจมตี +18% · ป้องกัน +15%', 'st')); shock(a.pos.x, a.pos.z, 1.1, C(2.4, .8, .3), GOLD, .5);
      addTask((dt, t) => { for (let k = 0; k < 2; k++) { const an = rand(0, 6.28); emit({ p: a.pos.clone().add(V(Math.cos(an) * .42, .05, Math.sin(an) * .42)), v: V(0, rand(1.2, 2.2), 0), c: Math.random() < .5 ? C(2.4, .7, .25) : GOLD, life: .55, size: .2, size1: .03 }); } if (t > 3) return false; }); });`);
// mother
R(`'คริ +10%', 'st b-mother')); auraMother(a, 4); buffChip(a, 'ic_heal_mother', '#ffd25a', 4);`, `'คริ +10%', 'st'));`);
// info layers
R(`'คลื่นไฟลายเสือแผ่บนพื้น (shader)', 'บัฟ: วงไฟลายเสือใต้เท้า + เงาส้มติดตัวเหมือนวิ่งเร็ว', 'ไอคอนบัฟสีส้มใต้หลอดเลือด นับถอยหลัง']`, `'คลื่นไฟลายเสือแผ่บนพื้น (shader)', 'เกลียวถ่านไฟวนรอบเพื่อนที่ได้บัฟ']`);
R(`'บัฟ: เมฆฝนก้อนเล็กลอยเหนือหัวเพื่อน โปรยละอองลงมา', 'วงน้ำกระเพื่อมใต้เท้า + หยด MP สีฟ้าวนเข้าตัว', 'ไอคอนบัฟสีฟ้าใต้หลอดเลือด']`, `'โล่ฟองแสงแบบ fresnel รอบเพื่อน', 'ประกาย MP สีฟ้าลอยขึ้น']`);
R(`'เพื่อนเปลี่ยนสีตามยาที่ได้', 'บัฟ: ลูกปัด 7 สีหมุนรอบเอวเหมือนประคำ', 'พลังแดงพุ่งขึ้นจากเท้าเป็นจังหวะ', 'ไอคอนบัฟสีแดงใต้หลอดเลือด']`, `'เพื่อนเปลี่ยนสีตามยาที่ได้', 'เปลวแดงทองลุกที่เท้าระหว่างบัฟ']`);
R(`'เมล็ดข้าวทองลอยขึ้น', 'บัฟ: มงกุฎเมล็ดข้าวทองหมุนเหนือหัว', 'ประกายคริแวบบนตัว + ละอองทองโปรยลง', 'ไอคอนบัฟสีทองใต้หลอดเลือด']`, `'เมล็ดข้าวทองลอยขึ้น', 'ไฟอุ่นสว่างทั้งลาน']`);
// css added for buffs
s = s.replace(/\.chips\{[^\n]*\n\.chip\{[^\n]*\n\.chip img\{[^\n]*\n\.chip i\{[^\n]*\n\.pop\.b-tiger[^\n]*\n/, '');
fs.writeFileSync('healer_fx.src.html', s);
