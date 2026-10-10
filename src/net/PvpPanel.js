import {PartyFollow} from './PartyFollow.js';
import {SKILLS} from '../combat/data/skills.js';
import './pvp.css';
const WHY={guest:'ต้องเข้าสู่ระบบก่อน',safe:'เมืองเป็นพื้นที่ปลอดภัย',combat:'ต้องพ้นการต่อสู้ 10 วินาทีก่อนปิด PK',consent:'อีกฝ่ายยังไม่ยินยอมต่อสู้',party:'โจมตีสมาชิกปาร์ตี้ไม่ได้',far:'เป้าหมายอยู่ไกลเกินไป',blocked:'มีสิ่งกีดขวางระหว่างเป้าหมาย',busy:'ทำไม่ได้ระหว่างต่อสู้ ดวล หรือแลกของ',dead:'ต้องฟื้นก่อน',room:'ต้องอยู่แผนที่และแชนแนลเดียวกัน',expired:'คำท้าดวลหมดอายุ',slow:'กรุณารอสักครู่',offline:'ไม่พบผู้เล่น',city:'อยู่ในเมืองแล้ว',cooldown:'ยังอยู่ในคูลดาวน์',self:'เลือกผู้เล่นอื่น'};
export function attachPvp(net,game,chat,social) {
  const app=document.getElementById('app')??document.body;
  const root=document.createElement('section');root.className='online-actions glass';root.setAttribute('aria-label','การเดินทางและต่อสู้');
  root.innerHTML='<button data-recall title="B · วาร์ปกลับเมือง">กลับเมือง <kbd>B</kbd></button><button data-pk aria-pressed="false">PK ปิด</button><button data-follow hidden>เดินตามหัวหน้า</button><button data-warp hidden>วาร์ปไปแผนที่หัวหน้า</button><div data-target hidden><b></b><button data-hit>โจมตีผู้เล่น</button><button data-cancel>ยอมแพ้ / ปิดเป้าหมาย</button></div><div data-ask hidden><p></p><button data-yes>รับคำท้าดวล</button><button data-no>ปฏิเสธ</button></div>';
  app.append(root);let me=null,pk=false,target=null,invite=null,askTimer;
  const note=t=>chat.add('ระบบ',t), el=s=>root.querySelector(s);
  const follow=new PartyFollow(game,()=>social.party,()=>me,note);
  const pick=(id,name)=>{target=id;el('[data-target]').hidden=false;el('[data-target] b').textContent=name;};
  const recall=()=>{if(game.serviceModalOpen)return;follow.stop();if(net.online)net.send({t:'recall'});else note('เชื่อมต่อเซิร์ฟเวอร์ก่อนวาร์ป');};
  root.addEventListener('click',e=>{
    if(e.target.closest('[data-recall]'))recall();
    if(e.target.closest('[data-pk]'))net.send({t:'pk',on:!pk});
    if(e.target.closest('[data-follow]'))follow.toggle();
    if(e.target.closest('[data-warp]')){follow.stop();net.send({t:'party_warp'});}
    if(e.target.closest('[data-hit]')&&target!==null){follow.stop();net.send({t:'pvp_hit',id:target});}
    if(e.target.closest('[data-cancel]')){net.send({t:'duel_cancel'});target=null;el('[data-target]').hidden=true;}
    if(e.target.closest('[data-yes],[data-no]')){net.send({t:'duel_answer',from:invite,ok:!!e.target.closest('[data-yes]')});el('[data-ask]').hidden=true;invite=null;clearTimeout(askTimer);}
  });
  window.addEventListener('keydown',e=>{if(e.code!=='KeyB'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;e.preventDefault();recall();});
  net.on('welcome',m=>{me=m.you;follow.stop();target=null;el('[data-target]').hidden=true;})
    .on('party',m=>{if(!m.id)follow.stop();el('[data-follow]').hidden=el('[data-warp]').hidden=!m.id||m.leader===me;})
    .on('pvp_state',m=>{if(m.id!==me){game.net?.remote?.list.get(m.id)?.plate.classList.toggle('pvp-enabled',m.pk);return;}pk=m.pk;el('[data-pk]').textContent=pk?'PK เปิด':'PK ปิด';el('[data-pk]').setAttribute('aria-pressed',String(pk));})
    .on('duel_invite',m=>{invite=m.from;el('[data-ask] p').textContent=`${m.name} ท้าดวล · ผู้แพ้เหลือ 1 HP ไม่เสียตำลึง`;el('[data-ask]').hidden=false;clearTimeout(askTimer);askTimer=setTimeout(()=>{invite=null;el('[data-ask]').hidden=true;},30000);})
    .on('duel_start',m=>{follow.stop();const id=m.a===me?m.b:m.a;pick(id,game.net?.remote?.list.get(id)?.name??'คู่ดวล');note('เริ่มดวล · จำกัดเวลา 3 นาที');})
    .on('duel_end',m=>{target=null;el('[data-target]').hidden=true;note(m.winner===me?'คุณชนะการดวล':m.winner?'การดวลจบแล้ว':'ยุติการดวล');})
    .on('pvp_no',m=>{if(m.why!=='cooldown')note(WHY[m.why]??'ต่อสู้ไม่ได้');})
    .on('recall_no',m=>note(WHY[m.why]??'วาร์ปไม่ได้'))
    .on('pvp_hit',m=>{if(m.id===me){const c=game.game.character;game.game.combat.combatTimer=5;if(m.dead)game.game.combat.knockOut();else{c.hp=m.hp;c.emit('change');}}if(m.from===me)note(m.miss?'โจมตีพลาด':`ทำดาเมจ ${m.amount} · เป้าหมาย HP ${Math.ceil(m.hp)}/${m.maxHp}`);})
    .on('status',on=>{if(!on){follow.stop();target=null;el('[data-target]').hidden=el('[data-ask]').hidden=true;pk=false;el('[data-pk]').textContent='PK ปิด';el('[data-pk]').setAttribute('aria-pressed','false');}});
  net.on('pvp_hit',m=>{
    if(m.from!==me)return;
    const player=game.player,r=game.net?.remote?.list.get(m.id);
    if(r)player.group.rotation.y=Math.atan2(r.tx-player.position.x,r.tz-player.position.z);
    const basic=game.game.character.cls.skills.find(id=>SKILLS[id]?.basic),clip=player.casts[basic];
    if(clip&&player.model?.has?.(clip))player.model.attack(clip,player.swingSpeed(clip));
  });
  return {pick,update(dt){follow.update(dt);el('[data-follow]').textContent=follow.active?'หยุดเดินตาม':'เดินตามหัวหน้า';}};
}
