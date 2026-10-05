const fs=require('fs');const R='E:/รับงานตัดนอก/ThaiNative/client/assets/';
const m={hero_idle:'td/hero2_male_mage_t3/idle.png',hero_walk:'td/hero2_male_mage_t3/walk.png',hero_cast:'td/hero2_male_mage_t3/cast.png',hero_spell:'td/hero2_male_mage_t3/spell.png',
sword_idle:'@dual/hero_idle.png',healer_idle:'td/hero2_male_healer_t1/idle.png',archer_idle:'td/hero2_male_archer_t3/idle.png'};
for(const g of ['pob','phrai'])for(const a of ['idle','attack','die'])m[g+'_'+a]=`td/mob_phi_${g}/${a}.png`;
for(const s of ['akom','yant','shield','thunder','kalp','holy','ghostfire','curse','meditate','storm'])m['ic_mage_'+s]=`icons/sk_mage_${s}.png`;
const A={};for(const[k,p]of Object.entries(m))A[k]='data:image/png;base64,'+fs.readFileSync(p.startsWith('@')?p.slice(1):R+p).toString('base64');
const h=fs.readFileSync('mage_fx.src.html','utf8').replace('__ASSETS__',JSON.stringify(A));fs.writeFileSync('mage_fx.html',h);console.log('bytes',h.length);
