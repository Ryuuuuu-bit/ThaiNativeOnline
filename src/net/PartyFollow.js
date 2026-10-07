// Following uses the game's path finder; it never writes player coordinates.
export class PartyFollow {
  constructor(game, party, self, note = () => {}) {
    Object.assign(this,{game,party,self,note}); this.active=false; this.timer=0;
    game.input.on('move',()=>this.stop());
    game.input.on('click',()=>this.stop());
    game.game.combat.on('target',()=>this.stop());
    game.game.combat.on('cast',()=>this.stop());
  }
  stop() { if(this.active)this.game.stopWalk(); this.active=false; }
  toggle() { if(this.active){this.stop();return;} this.active=true;this.timer=1;this.update(0); }
  update(dt) {
    if(!this.active)return;
    const party=this.party(), lead=party?.members.find(p=>p.id===party.leader), me=party?.members.find(p=>p.id===this.self());
    const combat=this.game.game.combat;
    if(!lead||!me||lead.id===me.id||lead.dead||!this.game.game.character.alive||combat.target||this.game.training?.busy||this.game.maps.busy){this.stop();return;}
    if(lead.map!==me.map||lead.ch!==me.ch){this.stop();this.note('หัวหน้าอยู่คนละแผนที่หรือแชนแนล · ใช้ปุ่มวาร์ปไปแผนที่หัวหน้า');return;}
    if((this.timer+=dt)<.7)return;this.timer=0;
    const r=this.game.net?.remote?.list.get(lead.id), x=r?.tx??lead.x,z=r?.tz??lead.z,p=this.game.player.position;
    const d=Math.hypot(x-p.x,z-p.z);
    if(d<2.5){this.game.stopWalk();return;}
    // Leave space behind the leader rather than stacking on their collision point.
    if(!this.game.walkTo(x-(x-p.x)/d*2,z-(z-p.z)/d*2,2)){this.stop();return;}
    this.game.autoWalk=true;
  }
}
