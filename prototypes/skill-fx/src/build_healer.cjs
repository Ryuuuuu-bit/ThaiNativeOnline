const fs=require('fs'),path=require('path');
const R='E:/รับงานตัดนอก/ThaiNative/client/assets/';
const m={
sword_idle:'td/hero2_male_swordman_t2/idle.png',sword_die:'td/hero2_male_swordman_t2/die.png',
boxer_idle:'td/hero2_male_boxer_t1/idle.png',boxer_die:'td/hero2_male_boxer_t1/die.png',
archer_idle:'td/hero2_male_archer_t1/idle.png',archer_die:'td/hero2_male_archer_t1/die.png'};
for(const g of ['pob','phrai'])for(const a of ['idle','attack','die'])m[g+'_'+a]=`td/mob_phi_${g}/${a}.png`;
for(const s of ['vine','pill','seed','tiger','khwan','mortar','mist','tonic','mother','amrita'])m['ic_heal_'+s]=`icons/sk_heal_${s}.png`;
m.ic_heal_pill='icons/it_flask_hp_4.png';
m.healer_idle="@herb/hero_idle.png";m.healer_walk="@herb/hero_walk.png";m.healer_cast="@herb/hero_cast.png";const A={};for(const[k,p]of Object.entries(m))A[k]='data:image/png;base64,'+fs.readFileSync(p.startsWith('@')?p.slice(1):R+p).toString('base64');
let h=fs.readFileSync('healer_fx.src.html','utf8').replace('__ASSETS__',JSON.stringify(A));
fs.writeFileSync('healer_fx.html',h);console.log('bytes',h.length);
