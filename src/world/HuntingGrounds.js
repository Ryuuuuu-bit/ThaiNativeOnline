import * as THREE from 'three';
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
      const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');
      g.fillStyle='#142f26ee';g.strokeStyle='#cbb16a';g.lineWidth=4;g.beginPath();g.roundRect(5,5,502,182,18);g.fill();g.stroke();
      g.textAlign='center';g.fillStyle='#ead49c';g.font='bold 36px "Noto Sans Thai",sans-serif';g.fillText(camp.name,256,65);
      g.fillStyle='#fff0bc';g.font='32px "Noto Sans Thai",sans-serif';g.fillText(`จุดล่า · ${huntingLevel(camp)}${camp.party?` · ${camp.party[0]}–${camp.party[1]} คน`:""}`,256,112,470);
      g.fillStyle='#b8c7a4';g.font='23px "Noto Sans Thai",sans-serif';g.fillText('ดูมอนสเตอร์และเส้นทางบนแผนที่',256,153);
      const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true,fog:false}));
      label.position.y=4.2;label.scale.set(4.8,1.8,1);group.add(label);root.add(group);this.items.push({camp,group,label});
    }
  }
  update(player) {for(const {camp,label} of this.items)label.visible=Math.hypot(camp.approach.x-player.x,camp.approach.z-player.z)<30;}
}
