import * as THREE from 'three';
import { MAPS } from './maps.js';
import { portalYaw } from './portal-layout.js';

function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ringTexture = () => canvasTexture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 18, s / 2, s / 2, 62);
  grad.addColorStop(0, 'rgba(255,226,150,0)'); grad.addColorStop(.62, 'rgba(255,226,150,.18)');
  grad.addColorStop(.8, 'rgba(255,232,170,.95)'); grad.addColorStop(1, 'rgba(255,226,150,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});
// A circle of small yantra marks (อักขระ-like strokes) between two thin rings.
const runeTexture = () => canvasTexture(256, (g, s) => {
  const c = s / 2;
  g.strokeStyle = 'rgba(190,240,255,.95)'; g.lineWidth = 3;
  for (const r of [96, 120]) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    g.save(); g.translate(c + Math.cos(a) * 108, c + Math.sin(a) * 108); g.rotate(a + Math.PI / 2);
    g.beginPath();
    if (i % 2) { g.moveTo(-5, -6); g.lineTo(5, -6); g.moveTo(0, -6); g.lineTo(0, 6); }
    else { g.arc(0, 0, 5, 0, Math.PI * 1.5); g.moveTo(5, 0); g.lineTo(5, 6); }
    g.stroke(); g.restore();
  }
});
// Vertical fade for the veil: bright at the ground, gone at the top, with soft streaks.
const veilTexture = () => canvasTexture(64, (g, s) => {
  const grad = g.createLinearGradient(0, s, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(.35, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(0,0,0,${.25 + (i % 3) * .2})`; g.fillRect(i * 7 + 2, 0, 3, s); }
});
function labelTexture(title, destination) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,41,32,.78)'; g.strokeStyle = 'rgba(214,188,117,.7)'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(8, 18, 496, 124, 14); g.fill(); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#9fe6ff'; g.font = '30px "Noto Sans Thai", sans-serif'; g.fillText(title, 256, 56, 470);
  g.fillStyle = '#fff1c8'; g.font = '500 44px "Noto Serif Thai", serif'; g.fillText(`→ ${destination}`, 256, 104);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowMaterial = (map, color, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side,
});


// Every connection has an open, walk-through gateway. Pillar anchors match portal-layout.
const PALETTES = {
  city: ['#b4a17c','#b69b56','#efd58a'], paddy: ['#66533a','#b5a66a','#b5d5a0'],
  forest: ['#697565','#aa9c65','#a8d3b9'], wat: ['#78665f','#b5a079','#c8b4dc'],
  klong: ['#637b76','#b8a779','#9ed8cf'],
};
export class Portals {
  constructor(root, map, heightAt) {
    this.items = [];
    for (const portal of map.portals) {
      const at = portal.at, radius = at.radius ?? 2.4, offset = radius + .75;
      const group = new THREE.Group();
      group.position.set(at.x, heightAt(at.x,at.z), at.z); group.rotation.y = portalYaw(map,at);
      const [stone, gold, light] = PALETTES[map.theme] ?? PALETTES.forest;
      const body = new THREE.MeshLambertMaterial({color:stone});
      const trim = new THREE.MeshLambertMaterial({color:gold});
      const add = (geometry, material, x,y,z=0) => {
        const mesh = new THREE.Mesh(geometry,material); mesh.position.set(x,y,z);
        mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
      };
      for (const side of [-1,1]) {
        const x=side*offset;
        add(new THREE.CylinderGeometry(.29,.34,3.9,8),body,x,1.95);
        for(const y of [.18,.55,3.65,3.95]) add(new THREE.CylinderGeometry(.37,.37,.16,8),trim,x,y);
        add(new THREE.ConeGeometry(.34,.7,6),trim,x,4.5);
        // Small hanging bells stay above the player's clearance.
        add(new THREE.ConeGeometry(.16,.25,8),trim,x-side*.55,3.55);
      }
      add(new THREE.BoxGeometry(offset*2+.7,.28,.62),body,0,4.08);
      add(new THREE.BoxGeometry(offset*2+.9,.08,.7),trim,0,4.26);
      for(const side of [-1,1]) {
        const slope=add(new THREE.BoxGeometry(Math.hypot(offset+.3,1.2),.16,.68),body,side*(offset+.3)/2,4.88);
        slope.rotation.z=-side*Math.atan2(1.2,offset+.3);
      }
      add(new THREE.ConeGeometry(.22,.8,6),trim,0,5.85);
      const crest=add(new THREE.OctahedronGeometry(.3),trim,0,4.75,.42);crest.scale.set(.7,1.3,.4);
      if(map.id==='paddy') {
        // Woven field-gate cloth and marigolds sit above the walk-through
        // clearance; pillar anchors and trigger geometry remain shared.
        const cloth=new THREE.MeshLambertMaterial({color:portal.to==='city'?'#bc9a59':'#617b73',side:THREE.DoubleSide});
        const flower=new THREE.MeshLambertMaterial({color:'#d8b857'});
        for(const side of [-1,1]) {
          add(new THREE.BoxGeometry(.24,1.05,.055),cloth,side*offset,3.2,.36);
          for(let i=0;i<6;i++)add(new THREE.IcosahedronGeometry(.095,0),flower,side*(offset-.23),3.78-i*.12,.31);
        }
        for(let i=0;i<7;i++) {
          const x=(i-3)*.65, y=3.9+.28*Math.abs(i-3)/3;
          add(new THREE.BoxGeometry(.14,.36,.025),cloth,x,y,.4);
        }
      }
      const flat=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
      const ground=add(flat,glowMaterial(ringTexture(),light),0,.07);ground.scale.setScalar(radius*2.5);
      const runes=add(flat,glowMaterial(runeTexture(),light),0,.09);runes.scale.setScalar(radius*2.1);
      // Wisps on either side frame the opening without hiding characters.
      const veil=veilTexture();
      for(const side of [-1,1]) {
        const wisp=add(new THREE.PlaneGeometry(.65,3.2),glowMaterial(veil,light,THREE.DoubleSide),side*(radius-.35),1.65);
        wisp.material.opacity=.22;
      }
      const destination=MAPS[portal.to], levels=destination.levels;
      const caption=levels ? `จุดล่า Lv.${levels[0]}–${levels[1]} · เดินผ่านเพื่อวาร์ป` : 'เขตปลอดภัย · เดินผ่านเพื่อวาร์ป';
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(caption,destination.name),transparent:true,depthWrite:false,fog:false}));
      const compact=map.id==='paddy', labelY=compact?6.6:7;
      label.scale.set(compact?4.6:6.4,compact?1.44:2,1);label.position.y=labelY;group.add(label);
      root.add(group); this.items.push({at,ground,runes,label,labelY,range:compact?22:38});
    }
  }
  update(t, player) {
    for(const {at,ground,runes,label,labelY,range} of this.items) {
      ground.material.opacity=.48+.12*Math.sin(t*1.5);
      runes.rotation.y=t*.12;runes.material.opacity=.5+.1*Math.sin(t*1.8);
      label.position.y=labelY+Math.sin(t)*.05;
      label.visible=!player || Math.hypot(at.x-player.x,at.z-player.z)<range;
    }
  }
}
