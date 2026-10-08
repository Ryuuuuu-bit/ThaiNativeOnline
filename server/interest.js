// Snapshot interest is per connection: entering range receives a fresh row even
// when the monster did not move this tick. Lifecycle/reward events remain global.
export const MONSTER_INTEREST_RADIUS = 96;
export function monsterInterest(monsters,changed,player,known=new Set()){
 const visible=new Set(),rows=[],dirty=new Map(changed.map(row=>[row[0],row]));
 const states=['dormant','idle','chase','return','dead','flee'];
 for(const m of monsters){if(m.hp<=0||Math.hypot(m.x-player.x,m.z-player.z)>MONSTER_INTEREST_RADIUS)continue;visible.add(m.id);
  const row=dirty.get(m.id);if(row)rows.push(row);else if(!known.has(m.id))rows.push([m.id,+m.x.toFixed(2),+m.z.toFixed(2),+m.f.toFixed(2),Math.round(m.hp),states.indexOf(m.state),m.moving?1:0]);
 }
 return {rows,visible};
}
