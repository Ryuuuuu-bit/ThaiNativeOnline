const fs=require('fs');const R='E:/รับงานตัดนอก/ThaiNative/client/assets/';
const m={hero_idle:'td/hero2_male_boxer_t3/idle.png',hero_walk:'td/hero2_male_boxer_t3/walk.png',hero_attack:'td/hero2_male_boxer_t3/attack.png',
sword_idle:'@dual/hero_idle.png',archer_idle:'td/hero2_male_archer_t3/idle.png',mage_idle:'td/hero2_male_mage_t3/idle.png',hanuman_yant:'@hanuman_yant.png',erawan_yant:'@erawan_yant.png'};
for(const g of ['pob','phrai'])for(const a of ['idle','attack','die'])m[g+'_'+a]=`td/mob_phi_${g}/${a}.png`;
for(const s of ['jab','kick','croc','waikru','ngouy','drum','elbow','knee','iron','hanuman'])m['ic_boxer_'+s]=`icons/sk_boxer_${s}.png`;
const A={};for(const[k,p]of Object.entries(m))A[k]='data:image/png;base64,'+fs.readFileSync(p.startsWith('@')?p.slice(1):R+p).toString('base64');
const h=fs.readFileSync('boxer_fx.src.html','utf8').replace('__ASSETS__',JSON.stringify(A));fs.writeFileSync('boxer_fx.html',h);console.log('bytes',h.length);
