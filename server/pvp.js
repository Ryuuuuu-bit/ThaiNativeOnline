import {MAPS} from '../src/world/maps.js';
export const PVP = { inviteSecs:30, duelSecs:180, requestEvery:3, combatSecs:10, inviteRange:12, leash:40 };
// Server-owned consent. PK requires both players to opt in; duels require a
// fresh explicit acceptance. Guests and safe maps never participate.
export class Pvp {
  constructor({now=()=>Date.now()/1000}={}) { this.now=now; this.players=new Map(); this.requests=new Map(); this.duels=new Map(); this.next=1; }
  state(id) { if(!this.players.has(id))this.players.set(id,{pk:false,duel:null,combatUntil:0,requestAt:-Infinity});return this.players.get(id); }
  view(id) { const s=this.state(id);return {pk:s.pk,duel:s.duel?this.duels.get(s.duel):null,wait:Math.max(0,Math.ceil(s.combatUntil-this.now()))}; }
  eligible(a,b) { if(!a||!b)return 'offline';if(a.id===b.id)return 'self';if(!a.signed||!b.signed)return 'guest';if(a.dead||b.dead)return 'dead';if(a.room!==b.room)return 'room';if(MAPS[a.map]?.safe!==false||MAPS[b.map]?.safe!==false)return 'safe';return null; }
  request(a,b) { const why=this.eligible(a,b);if(why)return why;const s=this.state(a.id);if(this.now()-s.requestAt<PVP.requestEvery)return 'slow';s.requestAt=this.now();if(s.duel||this.state(b.id).duel||a.busy||b.busy)return 'busy';if(Math.hypot(a.x-b.x,a.z-b.z)>PVP.inviteRange)return 'far';this.requests.set(`${a.id}:${b.id}`,this.now()+PVP.inviteSecs);return null; }
  accept(a,b) {const key=`${b?.id}:${a?.id}`,at=this.requests.get(key);this.requests.delete(key);if(!at||at<=this.now())return {why:'expired'};const why=this.eligible(a,b);if(why)return {why};if(a.busy||b.busy||this.state(a.id).duel||this.state(b.id).duel)return {why:'busy'};if(Math.hypot(a.x-b.x,a.z-b.z)>PVP.inviteRange)return {why:'far'};const d={id:this.next++,a:a.id,b:b.id,until:this.now()+PVP.duelSecs};this.duels.set(d.id,d);for(const id of [a.id,b.id])Object.assign(this.state(id),{pk:false,duel:d.id});return {duel:d};}
  decline(to,from){this.requests.delete(`${from}:${to}`);}
  toggle(p,on){if(!p?.signed)return 'guest';const s=this.state(p.id);if(p.dead)return 'dead';if(s.duel)return 'busy';if(on&&MAPS[p.map]?.safe!==false)return 'safe';if(!on&&s.combatUntil>this.now())return 'combat';s.pk=!!on;return null;}
  canAttack(a,b){const why=this.eligible(a,b);if(why)return why;const sa=this.state(a.id),sb=this.state(b.id);if(a.trade||b.trade)return 'busy';if(sa.duel||sb.duel){const d=this.duels.get(sa.duel);return d&&sa.duel===sb.duel&&[d.a,d.b].includes(b.id)&&d.until>this.now()?null:'consent';}if(!sa.pk||!sb.pk)return 'consent';if(a.party&&a.party===b.party)return 'party';return null;}
  touch(a,b){for(const id of [a,b])this.state(id).combatUntil=this.now()+PVP.combatSecs;}
  finish(id,why='cancelled',winner=null){const s=this.state(id),d=this.duels.get(s.duel);if(!d)return null;this.duels.delete(d.id);for(const pid of [d.a,d.b])this.state(pid).duel=null;return {...d,why,winner};}
  leave(id){const d=this.finish(id,'left');this.players.delete(id);for(const k of this.requests.keys())if(k.split(':').map(Number).includes(id))this.requests.delete(k);return d;}
  sweep(find){const ended=[];for(const d of this.duels.values()){const a=find(d.a),b=find(d.b);if(!a||!b||a.dead||b.dead||a.room!==b.room||Math.hypot(a.x-b.x,a.z-b.z)>PVP.leash||this.now()>=d.until){const end=this.finish(d.a,this.now()>=d.until?'timeout':'left');if(end)ended.push(end);}}for(const [k,until]of this.requests)if(until<=this.now())this.requests.delete(k);return ended;}
}
