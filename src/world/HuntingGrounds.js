import * as THREE from 'three';
import { SANS, afterFonts } from '../ui/canvasFonts.js';
import { huntingFor, huntingLevel, huntingSign } from '../data/hunting.js';

export class HuntingGrounds {
  constructor(root,map,heightAt) {
    this.items=[];
    if(!huntingFor(map.id).length)return;
    const wood=new THREE.MeshLambertMaterial({color:'#594831'}),brass=new THREE.MeshLambertMaterial({color:'#b7985b'});
    for(const camp of huntingFor(map.id)) {
      const at=huntingSign(camp),group=new THREE.Group();group.position.set(at.x,heightAt(at.x,at.z),at.z);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,1.65,6),wood);pole.position.y=.825;
      const board=new THREE.Mesh(new THREE.BoxGeometry(1.4,.65,.12),wood);board.position.y=1.45;
      const cap=new THREE.Mesh(new THREE.ConeGeometry(.2,.3,6),brass);cap.position.y=1.94;group.add(pole,board,cap);
      const compact=map.id==='paddy';
      const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d'),texture=new THREE.CanvasTexture(c);
      const paint=()=>{
        g.clearRect(0,0,c.width,c.height);
        g.fillStyle='#142f26ee';g.strokeStyle='#cbb16a';g.lineWidth=4;g.beginPath();g.roundRect(5,5,502,182,18);g.fill();g.stroke();
        g.textAlign='center';g.fillStyle='#ead49c';g.font=`700 ${compact?48:36}px ${SANS}`;g.fillText(camp.name,256,compact?82:65,470);
        g.fillStyle='#fff0bc';g.font=`500 ${compact?38:32}px ${SANS}`;g.fillText(`จุดล่า · ${huntingLevel(camp)}${camp.party?` · ${camp.party[0]}–${camp.party[1]} คน`:""}`,256,compact?143:112,470);
        if(!compact){g.fillStyle='#b8c7a4';g.font=`400 23px ${SANS}`;g.fillText('ดูมอนสเตอร์และเส้นทางบนแผนที่',256,153,470);}
        texture.needsUpdate=true;
      };
      paint();afterFonts(paint);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true,fog:false}));
      label.position.y=compact?2.8:4.2;label.scale.set(compact?3.5:4.8,compact?1.3125:1.8,1);
      label.visible=false;group.add(label);root.add(group);this.items.push({camp,group,label,range:compact?13:30});
    }
  }
  update(player) {for(const {camp,label,range} of this.items)label.visible=Math.hypot(camp.approach.x-player.x,camp.approach.z-player.z)<range;}
}
