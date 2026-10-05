const fs=require('fs');const R='E:/รับงานตัดนอก/ThaiNative/client/assets/';
const m={hero_idle:'td/hero2_male_archer_t3/idle.png',hero_walk:'td/hero2_male_archer_t3/walk.png',hero_shoot:'td/hero2_male_archer_t3/shoot.png',
sword_idle:'@dual/hero_idle.png',healer_idle:'td/hero2_male_healer_t1/idle.png',boxer_idle:'td/hero2_male_boxer_t1/idle.png',dog_idle:'@dog/dog_idle.png',dog_run:'@dog/dog_run.png',dog_bite:'@dog/dog_bite.png'};
for(const g of ['pob','phrai'])for(const a of ['idle','attack','die'])m[g+'_'+a]=`td/mob_phi_${g}/${a}.png`;
for(const s of ['quick','poison','pierce','hawk','rain','garuda','volley','trap','snipe','meteor'])m['ic_arch_'+s]=`icons/sk_arch_${s}.png`;
const A={};for(const[k,p]of Object.entries(m))A[k]='data:image/png;base64,'+fs.readFileSync(p.startsWith('@')?p.slice(1):R+p).toString('base64');
const h=fs.readFileSync('archer_fx.src.html','utf8').replace('__ASSETS__',JSON.stringify(A));fs.writeFileSync('archer_fx.html',h);console.log('bytes',h.length);
