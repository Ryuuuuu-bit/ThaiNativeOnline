const fs=require('fs');const R='E:/รับงานตัดนอก/ThaiNative/client/assets/';
const m={hero_idle:'@dual/hero_idle.png',hero_walk:'@dual/hero_walk.png',hero_slash:'@dual/hero_slash.png',hero_die:'td/hero2_male_swordman_t2/die.png',
healer_idle:'td/hero2_male_healer_t1/idle.png',boxer_idle:'td/hero2_male_boxer_t1/idle.png',boxer_die:'td/hero2_male_boxer_t1/die.png',archer_idle:'td/hero2_male_archer_t1/idle.png',archer_die:'td/hero2_male_archer_t1/die.png'};
for(const g of ['pob','phrai'])for(const a of ['idle','attack','die'])m[g+'_'+a]=`td/mob_phi_${g}/${a}.png`;
for(const s of ['twin','thrust','wind','guard','pikat','banner','whirl','leap','berserk','execute'])m['ic_sword_'+s]=`icons/sk_sword_${s}.png`;
const A={};for(const[k,p]of Object.entries(m))A[k]='data:image/png;base64,'+fs.readFileSync(p.startsWith("@")?p.slice(1):R+p).toString('base64');
const h=fs.readFileSync('warrior_fx.src.html','utf8').replace('__ASSETS__',JSON.stringify(A));fs.writeFileSync('warrior_fx.html',h);console.log('bytes',h.length);
