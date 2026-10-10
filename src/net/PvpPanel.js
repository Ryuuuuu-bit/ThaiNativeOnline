import {PartyFollow} from './PartyFollow.js';
import {SKILLS} from '../combat/data/skills.js';
import {KARMA} from '../data/karma.js';
import './pvp.css';
const WHY={guest:'ต้องเข้าสู่ระบบก่อน',safe:'เมืองเป็นพื้นที่ปลอดภัย',level:`ต้องถึง Lv ${KARMA.freeLevel} ก่อนจึง PK ได้`,protected:`ผู้เล่นต่ำกว่า Lv ${KARMA.freeLevel} ได้รับความคุ้มครองจาก PK`,duel:'ระหว่างดวลตีได้เฉพาะคู่ดวล',party:'โจมตีสมาชิกปาร์ตี้ไม่ได้',far:'เป้าหมายอยู่ไกลเกินไป',blocked:'มีสิ่งกีดขวางระหว่างเป้าหมาย',busy:'ทำไม่ได้ระหว่างต่อสู้ ดวล หรือแลกของ',dead:'ต้องฟื้นก่อน',room:'ต้องอยู่แผนที่และแชนแนลเดียวกัน',expired:'คำท้าดวลหมดอายุ',slow:'กรุณารอสักครู่',offline:'ไม่พบผู้เล่น',city:'อยู่ในเมืองแล้ว',cooldown:'ยังอยู่ในคูลดาวน์',self:'เลือกผู้เล่นอื่น'};
export function attachPvp(net,game,chat,social) {
  const app=document.getElementById('app')??document.body;
  const root=document.createElement('section');root.className='online-actions glass';root.setAttribute('aria-label','การเดินทางและต่อสู้');
  root.innerHTML='<button data-recall title="B · วาร์ปกลับเมือง">กลับเมือง <kbd>B</kbd></button><div data-karma class="karma-line" title="บาปลดลงทีละ 1 ทุกครั้งที่ปราบมอนสเตอร์"></div><button data-follow hidden>เดินตามหัวหน้า</button><button data-warp hidden>วาร์ปไปแผนที่หัวหน้า</button><div data-target hidden><b></b><button data-hit>โจมตีผู้เล่น</button><button data-cancel>ยอมแพ้ / ปิดเป้าหมาย</button></div><div data-ask hidden><p></p><button data-yes>รับคำท้าดวล</button><button data-no>ปฏิเสธ</button></div>';
  app.append(root);let me=null,target=null,invite=null,askTimer,markEvery=0;
  const states=new Map();   // the last pvp_state of each player: plates made later still get their marks
  const note=t=>chat.add('ระบบ',t), el=s=>root.querySelector(s);
  const follow=new PartyFollow(game,()=>social.party,()=>me,note);
  const pick=(id,name)=>{target=id;el('[data-target]').hidden=false;el('[data-target] b').textContent=name;};
  const recall=()=>{if(game.serviceModalOpen)return;follow.stop();if(net.online)net.send({t:'recall'});else note('เชื่อมต่อเซิร์ฟเวอร์ก่อนวาร์ป');};
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-recall]'))recall();
    if(e.target.closest('[data-follow]'))follow.toggle();
    if(e.target.closest('[data-warp]')){follow.stop();net.send({t:'party_warp'});}
    if(e.target.closest('[data-hit]')&&target!==null){follow.stop();net.send({t:'pvp_hit',id:target});}
    if(e.target.closest('[data-cancel]')){net.send({t:'duel_cancel'});target=null;el('[data-target]').hidden=true;}
    if(e.target.closest('[data-yes],[data-no]')){net.send({t:'duel_answer',from:invite,ok:!!e.target.closest('[data-yes]')});el('[data-ask]').hidden=true;invite=null;clearTimeout(askTimer);}
  });
  window.addEventListener('keydown',e=>{if(e.code!=='KeyB'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;e.preventDefault();recall();});
  net.on('welcome',m=>{me=m.you;states.clear();follow.stop();target=null;el('[data-target]').hidden=true;})
    .on('party',m=>{if(!m.id)follow.stop();el('[data-follow]').hidden=el('[data-warp]').hidden=!m.id||m.leader===me;})
    .on('pvp_state',m=>{
      states.set(m.id,m);
      const plate=plateOf(m.id);
      if(plate)markPlate(plate,m);
      if(m.id===me)showKarma(m);
    })
    .on('karma',m=>{
      if(m.kind==='murder')note(`สังหารผู้บริสุทธิ์ ${m.name} · บาป +${m.sin} (รวม ${m.total.sin})`);
      else if(m.kind==='justice')note(`ปราบหัวแดง ${m.name} · บุญ +${m.merit} (รวม ${m.total.merit})`);
      else if(m.kind==='defense')note(`ป้องกันตัวจาก ${m.name} · ไม่บาป`);
      else if(m.kind==='slain')note(`ถูก ${m.by} สังหาร${m.why==='murder'?' · ผู้สังหารรับบาป':''}`);
    })
    .on('karma_news',m=>note(`${m.killer} ปราบหัวแดง ${m.victim} ได้สำเร็จ`))
    .on('duel_invite',m=>{invite=m.from;el('[data-ask] p').textContent=`${m.name} ท้าดวล · ผู้แพ้เหลือ 1 HP ไม่เสียตำลึง`;el('[data-ask]').hidden=false;clearTimeout(askTimer);askTimer=setTimeout(()=>{invite=null;el('[data-ask]').hidden=true;},30000);})
    .on('duel_start',m=>{follow.stop();const id=m.a===me?m.b:m.a;pick(id,game.net?.remote?.list.get(id)?.name??'คู่ดวล');note('เริ่มดวล · จำกัดเวลา 3 นาที');})
    .on('duel_end',m=>{target=null;el('[data-target]').hidden=true;note(m.winner===me?'คุณชนะการดวล':m.winner?'การดวลจบแล้ว':'ยุติการดวล');})
    .on('pvp_no',m=>{if(m.why!=='cooldown')note(WHY[m.why]??'ต่อสู้ไม่ได้');})
    .on('recall_no',m=>note(WHY[m.why]??'วาร์ปไม่ได้'))
    .on('pvp_hit',m=>{if(m.id===me){const c=game.game.character;game.game.combat.combatTimer=5;if(m.dead)game.game.combat.knockOut();else{c.hp=m.hp;c.emit('change');}}if(m.from===me)note(m.miss?'โจมตีพลาด':`ทำดาเมจ ${m.amount} · เป้าหมาย HP ${Math.ceil(m.hp)}/${m.maxHp}`);})
    .on('status',on=>{if(!on){follow.stop();target=null;el('[data-target]').hidden=el('[data-ask]').hidden=true;el('[data-karma]').textContent='';}});
  // the plate: "PK" where free PK reaches this player, the ยศ before the name, the name colour by บาป
  const plateOf=id=>id===me?document.querySelector('.plate.is-self'):game.net?.remote?.list.get(id)?.plate;
  function markPlate(plate,m){
    const sig=`${m.pk}|${m.rank}|${m.tier}`;if(plate.dataset.karmaSig===sig)return;plate.dataset.karmaSig=sig;
    const pre=[m.pk?'PK':'',m.rank??''].filter(Boolean).join(' · ');
    if(pre)plate.dataset.pre=pre;else delete plate.dataset.pre;
    if(m.rank)plate.style.setProperty('--rank-color',m.rankColor);else plate.style.removeProperty('--rank-color');
    plate.dataset.karma=m.tier||'';
  }
  function showKarma(m){
    const zone=m.pk?'เขต PK เสรี':`ปลอดภัยจาก PK${game.game.character.level<KARMA.freeLevel?` (ถึง Lv ${KARMA.freeLevel} จึง PK ได้)`:''}`;
    el('[data-karma]').innerHTML=`<span>${zone}</span><span>บาป <b class="sin">${m.sin}</b> · บุญ <b class="merit">${m.merit}</b>${m.rank?` · ยศ <b style="color:${m.rankColor}">${m.rank}</b>`:''}</span>`;
  }
  net.on('pvp_hit',m=>{
    if(m.from!==me)return;
    const player=game.player,r=game.net?.remote?.list.get(m.id);
    if(r)player.group.rotation.y=Math.atan2(r.tx-player.position.x,r.tz-player.position.z);
    const basic=game.game.character.cls.skills.find(id=>SKILLS[id]?.basic),clip=player.casts[basic];
    if(clip&&player.model?.has?.(clip))player.model.attack(clip,player.swingSpeed(clip));
  });
  return {pick,update(dt){follow.update(dt);
    if((markEvery-=dt)<=0){markEvery=.5;for(const [id,m] of states){const plate=plateOf(id);if(plate)markPlate(plate,m);}}
    el('[data-follow]').textContent=follow.active?'หยุดเดินตาม':'เดินตามหัวหน้า';}};
}
