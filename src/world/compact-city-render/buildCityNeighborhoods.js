import * as THREE from 'three';
import { M as kitMaterials } from '../materials.js';

// +Z is the street face. Gate clearance includes the stair centre and the
// central approach; caps and posts stay on the closed side of that interval.
function residentialBoundary({p,w,d,doorX=0,gateHalf=.92,centralSpan=null,style,base,box,cyl,beam,M,plaster,fullSides=false}) {
  const fence=new THREE.Group();fence.name='residential-boundary';p.add(fence);
  const edge=w*.455,front=d*.455,height=1.08-base;
  const left=Math.max(-edge+.40,Math.min(-gateHalf,doorX-.72));
  const right=Math.min(edge-.40,Math.max(gateHalf,doorX+.72));
  const stats={segments:0,gatePosts:centralSpan?4:2,style};
  fence.userData.gate={left,right,front,doorX,base,top:1.18};
  fence.userData.gateOpenings=centralSpan?
    [{left,right:centralSpan.left-.16},{left:centralSpan.right+.16,right}]:[{left,right}];
  fence.userData.fenceStyle=style;
  function segment(x1,z1,x2,z2) {
    const length=Math.hypot(x2-x1,z2-z1);if(length<.10)return;
    const s=new THREE.Group();s.position.set((x1+x2)/2,0,(z1+z2)/2);
    s.rotation.y=Math.atan2(x2-x1,z2-z1);fence.add(s);
    // Longitudinal local Z lets the geometry work for every front orientation.
    if(style==='plaster') {
      box(s,plaster,0,base+height*.43,0,.16,height*.86,length);
      box(s,M.rim,0,base+height*.88,0,.23,.10,length+.04);
    }else {
      const bamboo=style==='bamboo',count=Math.max(2,Math.ceil(length/(bamboo?.24:.36)));
      for(const y of[base+.22,base+height-.08])box(s,bamboo?M.ochre:M.wood,0,y,0,.09,.085,length);
      for(let i=0;i<=count;i++) {
        const z=-length/2+i*length/count;
        if(bamboo) {
          cyl(s,M.timber,0,base+height/2,z,.042,height);
          // A few broad tie bands convey bamboo without a noisy node texture.
          if(i%3===0)cyl(s,M.wood,0,base+height*.72,z,.049,.045);
        }else box(s,M.timber,0,base+height/2,z,.07,height,style==='slat'?.19:.09);
      }
      if(style==='timber')beam(s,M.wood,[0,base+.18,-length/2],[0,base+height-.13,length/2],.045);
    }
    for(const z of[-length/2,length/2]) {
      box(s,style==='plaster'?plaster:M.wood,0,base+height/2,z,.16,height,.16);
      box(s,M.rim,0,1.11,z,.23,.10,.23);
    }
    stats.segments++;
  }
  segment(-edge,front,left-.16,front);
  segment(right+.16,front,edge,front);
  if(centralSpan) {
    segment(centralSpan.left,front,centralSpan.right,front);
    fence.children.at(-1).name='residential-central-front-span';
  }
  const rear=fullSides?-d*.455:d*.10;
  segment(-edge,rear,-edge,front);segment(edge,rear,edge,front);
  if(fullSides) {
    segment(-edge,rear,-.55,rear);segment(.55,rear,edge,rear);
  }
  for(const x of[left-.16,right+.16,...(centralSpan?[centralSpan.left,centralSpan.right]:[])]) {
    box(fence,style==='plaster'?plaster:M.wood,x,(base+1.12)/2,front,.20,1.12-base,.20);
    box(fence,M.rim,x,1.145,front,.27,.07,.27);
  }
  return stats;
}

// Canonical lots own occupancy. Everything here, including eaves, planting and
// domestic props, belongs to the lot; this module never dresses the street.
// All primitives/materials go through the caller's tracked allocation helpers.
export function buildCityNeighborhoods({
  root, CITY, mat, geo, box, cyl, beam, ball, lanternAt, pot, crate,
  kitRoof, roofM, M,
}) {
  const lots=CITY.buildings.filter(b=>b.kind==='infill');
  const result={count:0,variants:{},sourceMeshes:0,ids:[],fenceLots:0,fenceSegments:0,gatePosts:0,fenceStyles:{}};
  if(!lots.length)return result;
  const plaster=[M.cream,mat('#d9c8aa'),mat('#c9cfad')];
  const cloth=[roofM.cream,roofM.gold,roofM.timber];
  const foliage=[M.leaf,M.leafLight,M.leafDark];
  const blossom=mat('#c88798');
  // A shallow basket uses shared caller materials and one shared torus geometry.
  const basketRim=geo(new THREE.TorusGeometry(1,.07,4,12).rotateX(Math.PI/2));

  function basket(p,x,y,z,s=.65) {
    cyl(p,M.timber,x,y+.22*s,z,.34*s,.43*s);
    const rim=new THREE.Mesh(basketRim,M.ochre);
    rim.position.set(x,y+.46*s,z);rim.scale.setScalar(.35*s);
    rim.castShadow=true;rim.receiveShadow=true;p.add(rim);
    cyl(p,M.dark,x,y+.47*s,z,.28*s,.022*s);
    for(const side of[-1,1])beam(p,M.wood,[x+side*.27*s,y+.46*s,z],[x+side*.22*s,y+.69*s,z],.025*s);
    beam(p,M.wood,[x-.22*s,y+.69*s,z],[x+.22*s,y+.69*s,z],.025*s);
  }
  function window(p,x,y,z,width=.90,height=1.05,ry=0) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);
    box(g,M.dark,0,0,0,width+.20,height+.19,.10);
    box(g,M.window,0,0,.06,width,height,.07);
    for(const side of[-1,1]) {
      box(g,M.timber,side*(width/2+.065),0,.10,.13,height+.25,.12);
      box(g,M.timber,0,side*(height/2+.06),.10,width+.25,.12,.12);
      // Broad shutters read as separate planes at normal gameplay zoom.
      box(g,M.wood,side*(width/2+.23),0,.04,.24,height,.12);
      box(g,M.timber,side*(width/2+.23),-.28*height,.115,.22,.07,.04);
    }
    box(g,M.cream,0,0,.12,.065,height,.07);
  }
  function door(p,x,z,bottom,height=1.95,width=.95) {
    box(p,M.dark,x,bottom+height/2,z,width,height,.09);
    for(const side of[-1,1])box(p,M.timber,x+side*(width/2+.07),bottom+height/2,z+.07,.14,height+.13,.14);
    box(p,M.timber,x,bottom+height+.07,z+.07,width+.37,.16,.17);
    box(p,M.gold,x+width*.30,bottom+height*.47,z+.12,.06,.19,.04);
  }
  function room(p,{x=0,z,width,depth,bottom,top,material}) {
    box(p,material,x,(top+bottom)/2,z,width,top-bottom,depth);
    const front=z+depth/2+.035;
    for(const side of[-1,1]) {
      box(p,M.wood,x+side*(width/2-.06),(top+bottom)/2,front,.13,top-bottom,.11);
      box(p,M.wood,x,(top+bottom)/2,z+side*depth/2,width,.14,.12);
    }
    if(material===M.wood||material===M.timber) {
      for(let y=bottom+.42;y<top-.15;y+=.52) {
        box(p,M.timber,x,y,front,width-.20,.055,.045);
        box(p,M.timber,x,y,z-depth/2-.035,width-.20,.055,.045);
      }
    }
    // These close-set lots are seen from both street headings. Give rear and
    // side elevations usable framed bays instead of blank opaque box walls.
    window(p,x,bottom+1.42,z-depth/2-.065,Math.min(.92,width*.28),1.02,Math.PI);
    window(p,x-width/2-.065,bottom+1.45,z,Math.min(.87,depth*.34),1.03,-Math.PI/2);
    if(top-bottom>3.6)window(p,x,bottom+3.24,z-depth/2-.065,.88,1.02,Math.PI);
    return front;
  }
  function post(p,x,z,bottom,top) {
    box(p,M.rim,x,bottom+.07,z,.30,.14,.30);
    box(p,M.wood,x,(bottom+top)/2,z,.15,top-bottom,.15);
    beam(p,M.timber,[x,top-.62,z],[x,top-.09,z-.45],.06);
  }
  function rail(p,x,z,width,y) {
    box(p,M.wood,x,y+.58,z,width,.08,.08);
    const count=Math.max(3,Math.round(width/.30));
    for(let i=0;i<=count;i++)box(p,M.timber,x-width/2+i*width/count,y+.29,z,.055,.55,.055);
  }
  function steps(p,x,z,width,height) {
    const n=height>.65?3:2;
    for(let i=0;i<n;i++)box(p,M.timber,x,height*(i+1)/(2*n),z-i*.23,width,height*(i+1)/n,.25);
  }
  function awning(p,x,z,width,depth,y,material) {
    const sheet=box(p,material,x,y,z,width,.065,depth);sheet.rotation.x=.12;
    box(p,roofM.wood,x,y-.11,z+depth/2-.04,width,.10,.10);
    for(const side of[-1,1])post(p,x+side*(width/2-.16),z+depth/2-.10,.28,y-.14);
  }
  function planter(p,x,z,bottom,s=.65) {
    // Compact, layered planting is anchored inside the porch, not the footpath.
    pot(p,x,bottom,z,s,true);
    for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3;
      ball(p,foliage[i],x+Math.cos(a)*.18*s,bottom+.84*s,z+Math.sin(a)*.18*s,.30*s,.27*s,.28*s);
      ball(p,blossom,x+Math.cos(a)*.21*s,bottom+1.06*s,z+Math.sin(a)*.21*s,.12*s,.09*s,.12*s);
    }
  }
  function laundry(p,x,z,y,width,material) {
    beam(p,M.wood,[x-width/2,y,z],[x+width/2,y,z],.018);
    for(const side of[-1,1]) {
      const sheet=box(p,material,x+side*width*.23,y-.35,z,.34,.63,.035);
      sheet.rotation.z=side*.04;
    }
  }
  function roof(p,width,depth,y,height,material,x=0,z=0,ry=0) {
    return kitRoof(p,{width,depth,y,height,material,x,z,ry,pattern:'panel',tips:true});
  }
  function courtyardFence(p,w,d,variant,index) {
    const doorX=w*({fisher:.13,'fisher-home':.13,merchant:-.146,townhouse:-.146,
      inn:-.15,weaver:-.20,woodworker:-.23,potter:-.17,bakery:.08,teahouse:-.12,'tea-house':-.12}[variant]??0);
    const style=/fisher|woodworker/.test(variant)?'bamboo':/inn|teahouse|tea-house/.test(variant)?'plaster':index%2?'slat':'timber';
    const f=residentialBoundary({p,w,d,doorX,style,base:.32,box,cyl,beam,M,plaster:plaster[index%plaster.length]});
    result.fenceLots++;result.fenceSegments+=f.segments;result.gatePosts+=f.gatePosts;
    result.fenceStyles[style]=(result.fenceStyles[style]??0)+1;
    // Planting sits behind the outer corner, leaving the gate and stair mouth clear.
    if(index%2===0)planter(p,w*.36,d*.37,.33,.53);
  }
  const fallback=['townhouse','tea-house','fisher-home','warehouse-extension'];
  function variantFor(b,index) {
    const raw=b.variant&&typeof b.variant==='object'?(b.variant.type??b.variant.id??''):b.variant??'';
    if(/weav|textile/i.test(raw))return 'weaver';
    if(/bake|bread/i.test(raw))return 'bakery';
    if(/pott|kiln/i.test(raw))return 'potter';
    if(/woodwork|carpent/i.test(raw))return 'woodworker';
    if(/inn|guest|lodg/i.test(raw))return 'inn';
    if(/tea|eat|cafe/i.test(raw))return 'teahouse';
    if(/fish|river|stilt/i.test(raw))return 'fisher';
    if(/merchant/i.test(raw))return 'merchant';
    if(/warehouse|cargo|store|shed/i.test(raw))return 'warehouse-extension';
    if(/town|shop|merchant|house|home/i.test(raw))return 'townhouse';
    return fallback[index%fallback.length];
  }

  for(let index=0;index<lots.length;index++) {
    const b=lots[index],variant=variantFor(b,index),g=new THREE.Group();
    g.name=b.id;g.userData.neighborhoodVariant=variant;
    root.add(g);
    // Work in a front-facing local frame; +Z always points to the entrance.
    const sideways=b.front==='east'||b.front==='west';
    const w=sideways?b.d:b.w,d=sideways?b.w:b.d;
    const paint=plaster[index%plaster.length],fabric=cloth[index%cloth.length];
    const bodyW=w*.73,bodyD=d*.50,rear=-d*.16;
    box(g,M.brick,0,.16,0,w-.32,.32,d-.32);
    if(variant==='townhouse'||variant==='merchant') {
      const tall=index%2===0,deck=.45,top=tall?4.75:3.9;
      const front=room(g,{z:rear,width:bodyW,depth:bodyD,bottom:deck,top,material:tall?M.timber:paint});
      roof(g,w-.95,d*.61,top+.12,tall?2.45:2.0,tall?kitMaterials.tileDark:kitMaterials.tileOrange,0,rear);
      door(g,-bodyW*.20,front+.08,deck,1.97,.90);
      window(g,bodyW*.25,1.91,front+.08,.80,1.04);
      if(tall) {
        for(const side of[-1,1])window(g,side*bodyW*.25,3.73,front+.08,.80,.95);
        box(g,M.timber,0,2.98,front+.30,bodyW*.86,.12,.65);
        rail(g,0,front+.58,bodyW*.85,3.03);
      }else window(g,-bodyW/2-.06,2.14,rear,.98,1.07,-Math.PI/2);
      awning(g,bodyW*.10,d*.29,w*.73,d*.23,2.77,fabric);
      steps(g,-bodyW*.20,d*.42,1.0,deck);
      // Everyday doorway cluster: water storage, woven basket and flowering pot.
      pot(g,w*.29,deck,d*.30,.76,false);
      basket(g,w*.12,deck,d*.33,.66);
      planter(g,-w*.30,d*.31,deck,.66);
      lanternAt(g,w*.29,2.39,d*.35,.16,.37);
    }else if(variant==='tea-house'||variant==='teahouse') {
      const deck=.48,top=3.10;
      const front=room(g,{x:-w*.04,z:-d*.19,width:w*.76,depth:d*.45,bottom:deck,top,material:paint});
      roof(g,w-.96,d*.57,top+.12,2.12,kitMaterials.tileGreen,-w*.02,-d*.19);
      // Side roof and deep open porch distinguish the tea room from a shop.
      roof(g,w*.28,d*.53,2.32,1.05,kitMaterials.tileDark,w*.29,d*.05);
      door(g,-w*.13,front+.08,deck,1.93,1.05);
      window(g,w*.19,1.89,front+.08,.90,1.1);
      awning(g,-w*.05,d*.28,w*.78,d*.25,2.57,roofM.cream);
      for(const side of[-1,1]) {
        const x=side*w*.23;
        box(g,M.timber,x,.95,d*.29,w*.22,.13,.45);
        for(const z of[d*.24,d*.34])box(g,M.wood,x,.71,z,w*.19,.44,.075);
      }
      cyl(g,M.wood,0,1.06,d*.29,.38,.11);
      cyl(g,M.wood,0,.77,d*.29,.11,.47);
      pot(g,0,1.13,d*.29,.34,false);
      steps(g,-w*.12,d*.43,1.1,deck);
      planter(g,w*.33,d*.36,deck,.68);
      planter(g,-w*.34,d*.36,deck,.62);
      lanternAt(g,-w*.31,2.15,d*.37,.18,.39);
    }else if(variant==='fisher-home'||variant==='fisher') {
      const deck=.93,top=3.72;
      for(const side of[-1,1])for(const z of[-d*.31,d*.32]) {
        cyl(g,M.wood,side*w*.31,deck/2,z,.13,deck);
        beam(g,M.timber,[side*w*.31,.14,z],[side*w*.14,deck-.06,z],.065);
      }
      box(g,M.timber,0,deck,0,w*.77,.16,d*.77);
      const front=room(g,{z:rear,width:bodyW,depth:bodyD,bottom:deck+.10,top,material:M.wood});
      // Broad thatch mass above the raised gallery, with a small tool shelter.
      roof(g,w-.95,d*.62,top,2.25,kitMaterials.thatch,0,rear);
      door(g,w*.13,front+.08,deck+.10,1.99,.90);
      window(g,-w*.22,deck+1.57,front+.08,.88,1.03);
      rail(g,-w*.22,d*.34,w*.25,deck+.08);
      steps(g,w*.13,d*.43,1.03,deck);
      laundry(g,-w*.13,d*.31,3.01,w*.41,roofM.cream);
      basket(g,-w*.27,deck+.10,d*.22,.76);
      pot(g,-w*.06,deck+.10,d*.25,.68,false);
      planter(g,w*.31,-d*.30,.33,.69);
      // A bundled fishing pole rack has a clear long silhouette, not tiny gear.
      for(const side of[-1,1])beam(g,M.timber,[-w*.31+side*.08,.30,-d*.15],[-w*.31+side*.08,2.53,-d*.22],.034);
      lanternAt(g,w*.30,3.12,d*.29,.17,.38);
    }else if(variant==='weaver') {
      const deck=.61,top=3.32;
      const front=room(g,{x:-w*.10,z:-d*.18,width:w*.61,depth:d*.45,bottom:deck,top,material:paint});
      roof(g,w*.71,d*.58,top+.10,2.18,kitMaterials.tileOrange,-w*.10,-d*.18);
      // Offset low loom pavilion, open between its posts.
      roof(g,w*.29,d*.61,2.72,1.12,kitMaterials.tileDark,w*.29,d*.08);
      door(g,-w*.20,front+.08,deck,1.93,.91);
      window(g,w*.07,2.06,front+.08,.79,1.03);
      box(g,M.timber,w*.08,.74,d*.27,w*.43,.13,d*.30);
      for(const side of[-1,1]) {
        const x=w*.08+side*w*.17;
        post(g,x,d*.28,.55,2.09);
        beam(g,M.timber,[x,.91,d*.16],[x,1.49,d*.35],.055);
      }
      // One broad fabric plane, framed loom and visible rolls establish the trade.
      box(g,roofM.cream,w*.08,1.65,d*.27,w*.31,.76,.045);
      box(g,M.wood,w*.08,2.08,d*.27,w*.42,.13,.13);
      for(let i=0;i<3;i++) {
        const roll=cyl(g,i%2?M.indigo:M.ochre,-w*.22+i*.20,1.10,d*.27,.095,.66);
        roll.rotation.x=Math.PI/2;
      }
      laundry(g,-w*.11,d*.34,2.72,w*.50,fabric);
      basket(g,-w*.28,deck,d*.29,.70);planter(g,w*.32,-d*.28,.34,.77);
      steps(g,-w*.20,d*.43,.98,deck);lanternAt(g,-w*.31,2.60,d*.31,.17,.40);
    }else if(variant==='bakery') {
      const deck=.36,top=3.01;
      const front=room(g,{x:w*.08,z:-d*.20,width:w*.68,depth:d*.42,bottom:deck,top,material:paint});
      roof(g,w*.80,d*.55,top+.10,1.97,kitMaterials.tileGreen,w*.08,-d*.20);
      // A squat bake oven with a broad arched dome and chimney breaks the roof mass.
      box(g,M.brick,-w*.26,.93,d*.18,1.13,1.15,1.02);
      ball(g,M.brick,-w*.26,1.55,d*.18,.65,.58,.61);
      box(g,M.dark,-w*.26,1.23,d*.18+.52,.62,.57,.065);
      box(g,M.fire,-w*.26,1.02,d*.18+.56,.43,.13,.032);
      box(g,M.brick,-w*.30,2.23,-d*.12,.46,3.81,.48);
      box(g,M.rim,-w*.30,4.19,-d*.12,.62,.16,.64);
      door(g,w*.08,front+.08,deck,1.90,.90);
      window(g,w*.29,2.01,front+.08,.75,.95);
      awning(g,w*.16,d*.27,w*.55,d*.23,2.60,roofM.gold);
      box(g,M.wood,w*.17,1.04,d*.27,w*.43,.90,.59);
      box(g,M.timber,w*.17,1.53,d*.27,w*.46,.12,.70);
      for(let i=0;i<3;i++)ball(g,M.ochre,w*.02+i*.22,1.65,d*.26,.15,.10,.23);
      basket(g,w*.29,deck,d*.39,.64);planter(g,-w*.34,-d*.30,.34,.69);
      lanternAt(g,w*.31,2.23,d*.35,.17,.39);
    }else if(variant==='potter') {
      const deck=.32,top=2.87;
      const front=room(g,{x:-w*.13,z:-d*.23,width:w*.57,depth:d*.37,bottom:deck,top,material:M.timber});
      roof(g,w*.66,d*.48,top+.10,1.99,kitMaterials.tileOrange,-w*.13,-d*.23);
      // Smaller kiln roof and open pottery court make an asymmetric workshop.
      roof(g,w*.29,d*.42,2.02,1.31,kitMaterials.tileDark,w*.29,-d*.16);
      cyl(g,M.brick,w*.29,1.01,-d*.16,.49,1.36);
      ball(g,M.brick,w*.29,1.77,-d*.16,.52,.54,.51);
      cyl(g,M.brick,w*.29,2.17,-d*.16,.13,.51);
      door(g,-w*.17,front+.08,deck,1.86,.93);
      awning(g,-w*.08,d*.27,w*.76,d*.22,2.47,roofM.cream);
      box(g,M.timber,-w*.08,1.14,d*.25,w*.53,.13,.61);
      for(let i=0;i<4;i++)pot(g,-w*.26+i*w*.12,1.22,d*.25,.49+i%2*.13,false);
      pot(g,w*.28,deck,d*.34,1.02,false);pot(g,w*.08,deck,d*.35,.75,false);
      cyl(g,M.timber,-w*.24,.85,d*.32,.36,.09);cyl(g,M.wood,-w*.24,.61,d*.32,.11,.40);
      basket(g,-w*.33,deck,d*.16,.60);planter(g,-w*.34,-d*.34,.33,.67);
      lanternAt(g,-w*.29,2.11,d*.34,.17,.38);
    }else if(variant==='inn') {
      const deck=.55,top=4.79;
      const front=room(g,{x:-w*.06,z:-d*.19,width:w*.76,depth:d*.46,bottom:deck,top,material:paint});
      roof(g,w*.87,d*.58,top+.13,2.61,kitMaterials.tileGreen,-w*.06,-d*.19);
      roof(g,w*.34,d*.57,3.38,1.67,kitMaterials.tileOrange,w*.28,d*.02);
      door(g,-w*.15,front+.08,deck,2.05,1.14);
      for(const side of[-1,1])window(g,side*w*.22,3.84,front+.08,.87,1.14);
      box(g,M.timber,-w*.05,3.09,front+.28,w*.68,.16,.67);
      rail(g,-w*.05,front+.57,w*.68,3.17);
      for(const side of[-1,1])post(g,side*w*.31,front+.50,deck,4.74);
      awning(g,-w*.08,d*.30,w*.74,d*.20,2.89,fabric);
      box(g,M.timber,-w*.25,.92,d*.29,w*.27,.11,.43);
      for(const side of[-1,1])box(g,M.wood,-w*.25+side*w*.10,.72,d*.29,.09,.40,.34);
      laundry(g,w*.15,front+.57,4.04,w*.27,roofM.cream);
      steps(g,-w*.15,d*.43,1.14,deck);
      planter(g,w*.31,d*.32,deck,.88);planter(g,-w*.34,-d*.30,.33,.72);
      pot(g,w*.08,deck,d*.36,.83,false);lanternAt(g,-w*.30,2.53,d*.37,.20,.43);
    }else if(variant==='woodworker') {
      const top=3.27;
      const front=room(g,{x:-w*.17,z:-d*.21,width:w*.48,depth:d*.40,bottom:.33,top,material:M.wood});
      roof(g,w*.63,d*.55,top+.10,2.16,kitMaterials.tileDark,-w*.15,-d*.21);
      roof(g,w*.34,d*.65,2.58,1.04,kitMaterials.thatch,w*.28,d*.04);
      for(const side of[-1,1])post(g,w*.28+side*w*.11,d*.31,.33,2.57);
      door(g,-w*.23,front+.08,.33,1.89,.88);
      window(g,-w*.41,1.93,-d*.20,.81,1.00,-Math.PI/2);
      box(g,M.timber,w*.06,1.14,d*.25,w*.55,.16,.66);
      for(const side of[-1,1])box(g,M.wood,w*.06+side*w*.21,.78,d*.25,.13,.63,.53);
      for(let i=0;i<3;i++)box(g,i%2?M.wood:M.timber,w*.22,.43+i*.14,-d*.09,w*.34,.11,d*.34);
      beam(g,M.iron,[-w*.07,1.30,d*.21],[w*.18,1.30,d*.28],.035);
      box(g,M.wood,w*.23,1.35,d*.29,.24,.12,.14);
      crate(g,-w*.27,.33,d*.28,.70);basket(g,-w*.09,.33,d*.32,.61);
      planter(g,w*.33,-d*.32,.33,.72);lanternAt(g,w*.32,2.21,d*.32,.17,.39);
    }else {
      const deck=.32,top=3.60;
      const front=room(g,{z:-d*.19,width:w*.77,depth:d*.47,bottom:deck,top,material:M.timber});
      roof(g,w-.96,d*.60,top+.06,2.45,kitMaterials.tileDark,0,-d*.19);
      // Wide framed cargo bay and slanted loading awning, with no shop counter.
      door(g,0,front+.09,deck,2.73,w*.42);
      for(const side of[-1,1]) {
        const x=side*w*.30;
        box(g,M.wood,x,1.80,front+.12,w*.14,2.67,.12);
        beam(g,M.timber,[x-w*.06,.59,front+.20],[x+w*.06,3.02,front+.20],.06);
      }
      awning(g,0,d*.28,w*.80,d*.26,2.9,M.roofDark);
      box(g,M.timber,0,.45,d*.25,w*.78,.19,d*.31);
      crate(g,-w*.24,.56,d*.24,.72);
      crate(g,-w*.24,1.20,d*.24,.63);
      crate(g,w*.21,.56,d*.22,.79);
      basket(g,w*.12,.56,d*.36,.62);
      ball(g,M.cream,-w*.07,.80,d*.34,.22,.25,.28);
      planter(g,w*.33,-d*.31,.33,.65);
      lanternAt(g,w*.30,2.53,d*.37,.17,.39);
    }
    courtyardFence(g,w,d,variant,index);
    // Local fit includes curled eaves and leaf crowns, preventing accidental
    // geometry overhang if the canonical author selects a particularly narrow lot.
    g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    const fit=Math.min(1,(w-.10)/size.x,(d-.10)/size.z);
    g.scale.set(fit,1,fit);
    // Recenter the authored mass before applying the lot's front rotation.
    for(const child of g.children){child.position.x-=center.x;child.position.z-=center.z;}
    g.position.set(b.x,0,b.z);
    g.rotation.y=({east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0})[b.front]??0;
    g.traverse(o=>{if(o.isMesh)result.sourceMeshes++;});
    result.count++;result.variants[variant]=(result.variants[variant]??0)+1;result.ids.push(b.id);
  }
  return result;
}

// Original landmarks/services keep their own architecture. These shallow
// attachments and short courtyard returns make them belong to the surrounding
// block without fencing off their street-facing approach or adding occupancy.
export function buildCityCourtyardEdges({
  root,CITY,mat,geo,box,cyl,beam,ball,M,pot,lanternAt,
}) {
  const result={count:0,walls:0,planters:0,facadeBays:0,clusters:0,sourceMeshes:0,fenceLots:0,fenceSegments:0,gatePosts:0,fenceStyles:{}};
  const buildings=CITY.buildings.filter(b=>!['infill','garden','fair','kit'].includes(b.kind));
  if(!buildings.length)return result;
  const warmPlaster=mat('#d9cfb4'),soil=M.dark;

  function shutterBay(p,x,y,z,width,height,ry=0) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);
    box(g,M.dark,0,0,0,width+.18,height+.18,.065);
    box(g,M.window,0,0,.045,width,height,.065);
    for(const side of[-1,1]) {
      box(g,M.timber,side*(width/2+.065),0,.11,.13,height+.23,.14);
      box(g,M.timber,0,side*(height/2+.065),.11,width+.27,.13,.14);
      box(g,M.wood,side*(width/2+.24),0,.035,.27,height,.085);
      for(const t of[-.30,.30])box(g,M.timber,side*(width/2+.24),t*height,.095,.23,.075,.035);
    }
    box(g,M.cream,0,0,.10,.065,height,.08);result.facadeBays++;
    // Window boxes sit on the exterior sill, rather than in front of the gate.
    box(g,M.timber,0,-height/2-.18,.18,width+.15,.25,.36);
    box(g,soil,0,-height/2-.04,.18,width,.03,.28);
    for(const side of[-1,0,1])ball(g,side?M.leaf:M.leafLight,side*width*.29,-height/2+.11,.18,.18,.17,.17);
    result.planters++;
  }
  function wall(p,x1,z1,x2,z2,height,timber) {
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    if(length<.18)return;
    const x=(x1+x2)/2,z=(z1+z2)/2;
    if(timber) {
      beam(p,M.wood,[x1,height+.20,z1],[x2,height+.20,z2],.065);
      beam(p,M.timber,[x1,.42,z1],[x2,.42,z2],.04);
      const count=Math.max(2,Math.ceil(length/.65));
      for(let i=0;i<=count;i++)box(p,M.wood,x1+dx*i/count,.22+height/2,z1+dz*i/count,.075,height,.075);
    }else {
      box(p,warmPlaster,x,.22+height/2,z,.19,height,length,angle);
      box(p,M.rim,x,.24+height,z,.24,.10,length+.08,angle);
      for(const t of[0,1]) {
        box(p,M.cream,x1+dx*t,.22+(height+.14)/2,z1+dz*t,.28,height+.14,.28);
        box(p,M.rim,x1+dx*t,height+.43,z1+dz*t,.33,.10,.33);
      }
    }
    result.walls++;
  }
  function strip(p,x,z,width,depth) {
    box(p,M.brick,x,.37,z,width,.25,depth);
    box(p,soil,x,.51,z,width-.10,.025,depth-.08);
    const count=Math.max(2,Math.ceil(width/.75));
    for(let i=0;i<count;i++)ball(p,i%2?M.leaf:M.leafLight,x+(i+.5-count/2)*width/count,.68+(i%2)*.07,z,.32,.23,.26);
    result.planters++;
  }
  function cluster(p,x,z,role) {
    if(role==='craft') {
      box(p,M.timber,x,.67,z,.98,.14,.52);
      for(const side of[-1,1])box(p,M.wood,x+side*.36,.46,z,.11,.38,.43);
      beam(p,M.iron,[x-.29,.78,z],[x+.29,.78,z+.10],.038);
      box(p,M.timber,x+.27,.84,z+.10,.23,.13,.16);
      pot(p,x-.68,.23,z+.10,.62,false);
    }else if(role==='cargo') {
      for(let i=0;i<2;i++) {
        box(p,M.timber,x+(i-.5)*.62,.53,z,.52,.60,.52);
        box(p,M.wood,x+(i-.5)*.62,.53,z+.27,.54,.08,.045);
      }
      ball(p,M.cream,x,.69,z+.58,.28,.34,.31);
      box(p,M.wood,x,.99,z+.58,.15,.045,.10);
    }else if(role==='herbs') {
      box(p,M.timber,x,.47,z,1.35,.21,.60);
      for(const side of[-1,0,1])pot(p,x+side*.41,.59,z,.56,true);
    }else {
      box(p,M.timber,x,.70,z,1.12,.13,.42);
      for(const side of[-1,1])box(p,M.wood,x+side*.39,.45,z,.10,.45,.34);
      pot(p,x+.78,.22,z,.82,false);
      cyl(p,M.timber,x+.78,.84,z,.27,.055);
    }
    result.clusters++;
  }

  for(let index=0;index<buildings.length;index++) {
    const b=buildings[index],g=new THREE.Group();g.name=`courtyard:${b.id}`;root.add(g);
    const sideways=b.front==='east'||b.front==='west',w=sideways?b.d:b.w,d=sideways?b.w:b.d;
    const sacred=['temple','chedi','landmark'].includes(b.kind);
    const craft=b.id==='forge'||/muay|warrior|hunter|assassin/.test(b.id);
    const cargo=b.id==='storage'||b.kind==='warehouse'||b.kind==='market';
    const herbs=/pharm|herbal|shaman/.test(b.id);
    const timber=craft||b.kind==='house'||cargo;
    const height=sacred?.76:timber?.63:.69,edge=w*.46,rear=-d*.46;
    if(b.kind==='house') {
      // Original compounds get visible street corners as well as rear walls.
      // The broad middle stays open for both houses' stairs and the kuti door.
      const style=b.id==='kuti'?'bamboo':'plaster';
      const centralSpan=b.id==='homes'?{left:-w*.20625,right:w*.20625}:null;
      const f=residentialBoundary({p:g,w,d,doorX:0,gateHalf:w*(b.id==='homes'?.38:.31),centralSpan,style,base:.22,box,cyl,beam,M,plaster:warmPlaster,fullSides:true});
      result.fenceLots++;result.fenceSegments+=f.segments;result.gatePosts+=f.gatePosts;
      result.fenceStyles[style]=(result.fenceStyles[style]??0)+1;result.walls+=f.segments;
      strip(g,-w*.37,d*.27,Math.min(1.15,w*.12),Math.min(.53,d*.07));
    }else if(!['landmark','chedi'].includes(b.kind)) {
      // Rear fragments and side returns share the reserved lot. Never draw a
      // full front edge: smithy bays and every main doorway remain open.
      const gap=index%2===0?Math.min(1.25,w*.20):.40;
      wall(g,-edge,rear,-gap/2,rear,height,timber);
      wall(g,gap/2,rear,edge,rear,height,timber);
      wall(g,-edge,rear,-edge,d*(craft?.02:.15),height,timber);
      if(b.id!=='forge')wall(g,edge,rear,edge,d*(cargo?.06:.19),height,timber);
      strip(g,0,-d*.405,w*.47,Math.min(.53,d*.07));
    }
    // Actual service-room faces, in the same local orientation as serviceShop.
    // Windows project only a few centimetres from the original wall surface.
    if(['pharmacy','general','storage'].includes(b.id)) {
      const rearFace=b.id==='pharmacy'?-d*.405:b.id==='general'?-d*.41:-d*.415;
      const bayY=b.id==='general'?2.05:2.12;
      for(const side of[-1,1])shutterBay(g,side*w*.23,bayY,rearFace-.045,1.13,1.23,Math.PI);
      if(b.id==='general')for(const side of[-1,1])shutterBay(g,side*w*.23,4.42,rearFace-.045,1.04,1.15,Math.PI);
      shutterBay(g,-(w-.95)/2-.045,bayY,-d*.22,1.16,1.23,-Math.PI/2);
      if(b.id==='storage') {
        // Broad warehouse joinery, not a repeated tiny plank texture.
        for(const side of[-1,1]) {
          const x=side*((w-.95)/2+.025);
          beam(g,M.timber,[x,.72,-d*.36],[x,4.52,-d*.05],.075);
          box(g,M.wood,x,2.77,-d*.19,.10,.15,d*.38);
        }
      }
    }else if(b.id==='forge') {
      shutterBay(g,1.0,1.99,-d*.37-.16,1.21,1.17,Math.PI);
      // Rear hanging tool rail leaves the open forge frontage completely clear.
      box(g,M.timber,1.0,2.76,-d*.37-.16,2.54,.13,.10);
      for(const side of[-1,1])beam(g,M.iron,[1.0+side*.76,2.05,-d*.37-.20],[1.0+side*.76,2.65,-d*.37-.20],.043);
    }
    if(!sacred) {
      const role=craft?'craft':cargo?'cargo':herbs?'herbs':'domestic';
      // Three clusters live at the side/rear corners, not across the service gate.
      const sideThreshold=b.id==='forge'||b.kind==='house';
      cluster(g,-w*.31,sideThreshold?d*.06:d*.27,role);
      cluster(g,w*.29,-d*.26,herbs?'herbs':cargo?'cargo':'domestic');
      pot(g,w*.35,.23,b.id==='forge'?-d*.10:d*.30,.77,true);result.clusters++;
      lanternAt(g,-w*.39,1.33,d*.10,.17,.38);
    }else {
      for(const side of[-1,1])pot(g,side*w*.32,.22,-d*.28,.77,true);
      result.clusters+=2;
    }
    // Fit only these new attachments; original architecture and canonical
    // occupancy are unchanged. Bounds include pots, caps and window-box foliage.
    g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g);
    // Keep attachments aligned to existing façades; shrink only if an outward
    // shutter or planter exceeds the reservation, without recentering the lot.
    const extentX=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x));
    const extentZ=Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z));
    const fit=Math.min(1,(w/2-.04)/extentX,(d/2-.04)/extentZ);
    g.scale.set(fit,1,fit);g.position.set(b.x,0,b.z);
    g.rotation.y=({east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0})[b.front]??0;
    g.traverse(o=>{if(o.isMesh)result.sourceMeshes++;});result.count++;
  }
  return result;
}
