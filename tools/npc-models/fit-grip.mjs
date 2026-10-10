// Offline, source-pinned SINGLE-family grip prototype. Importing does no I/O.
// Virtual finger landmarks are authored from this body's actual mesh; no
// finger bones, retargeting, automatic names, source replacement or paid calls.
import {readFile,writeFile,mkdir,realpath,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {THREE,loadRig,worldVertices,restGeometryMatrix,assertNativeContract} from './rig.mjs';
import {GLBBuilder,sha256} from './glb.mjs';
import {auditRig,indexEdges,edgeStrain} from './audit.mjs';
import {packingDependencies} from './prepare.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {RIG} from '../../src/npc/body/rig.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUTPUT=path.join(ROOT,'artifacts/grip-fits/master_sword');
const vec=(v,label)=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error(`Invalid ${label}`);return new THREE.Vector3(...v);};
const unit=(v,label)=>{const p=vec(v,label);if(p.length()<1e-8)throw Error(`Zero ${label}`);return p.normalize();};
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
async function outputDirectory(out){const p=path.resolve(ROOT,out);if(p!==OUTPUT&&!p.startsWith(OUTPUT+path.sep))throw Error('Output must stay under artifacts/grip-fits');let a=p;for(;;){try{const actual=path.resolve(await realpath(a),path.relative(a,p)),allowed=path.join(await realpath(ROOT),'artifacts/grip-fits');if(actual!==allowed&&!actual.startsWith(allowed+path.sep))throw Error('Output junction escapes');break;}catch(e){if(e.code!=='ENOENT')throw e;a=path.dirname(a);}}await mkdir(p,{recursive:true});return p;}
function handFrame(rig,adapter,side){if(side!=='right')throw Error('Prototype scope is master_sword RIGHT hand only');const hand=adapter.hands?.[side],bone=rig.names.get('RightHand');if(hand?.name!=='RightHand'||!bone||rig.mesh.skeleton.bones.length!==24)throw Error('Actual 24-joint right hand calibration required');const expected=adapter.nodes?.RightHand?.bindWorld;if(!expected||bone.matrixWorld.elements.some((v,i)=>Math.abs(v-expected[i])>2e-5))throw Error('Adapter rest hand does not match input');const y=vec(hand.fingersWorld,'fingers').normalize(),z=vec(hand.palmWorld,'palm');z.addScaledVector(y,-z.dot(y)).normalize();const x=new THREE.Vector3().crossVectors(y,z).normalize();const wrist=new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld),matrix=new THREE.Matrix4().makeBasis(x,y,z).setPosition(wrist);return{bone,matrix,inverse:matrix.clone().invert(),wrist,x,y,z};}
export function inspectHand(rig,adapter,side='right',minimumWeight=.9999){
  const frame=handFrame(rig,adapter,side),points=worldVertices(rig),j=rig.mesh.skeleton.bones.indexOf(frame.bone),{skinIndex,skinWeight}=rig.mesh.geometry.attributes,
    records=[],map=new Map(),vertexNode=new Map();
  for(let i=0;i<points.length/3;i++){let weight=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===j)weight+=skinWeight.getComponent(i,k);if(weight<minimumWeight)continue;
    const world=new THREE.Vector3().fromArray(points,i*3),p=world.clone().applyMatrix4(frame.inverse),key=p.toArray().map(v=>Math.round(v*1e6)).join(':');
    if(!map.has(key)){map.set(key,records.length);records.push({id:records.length,vertex:i,vertices:[],hand:p.toArray(),world:world.toArray(),minimumHandWeight:weight});}
    const id=map.get(key);records[id].vertices.push(i);records[id].minimumHandWeight=Math.min(records[id].minimumHandWeight,weight);vertexNode.set(i,id);
  }
  if(records.length<25)throw Error(`Insufficient actual rigid hand geometry: ${records.length} welded points`);
  const triangles=[],edges=new Set(),indices=rig.mesh.geometry.index.array;
  for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]].map(v=>vertexNode.get(v));if(ids.some(v=>v===undefined))continue;triangles.push(ids);for(const [a,b]of [[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]])if(a!==b)edges.add([a,b].sort((a,b)=>a-b).join(':'));}
  return{schema:1,family:'master_sword',inputSha256:rig.sha256,side,frame:frame.matrix.toArray(),bone:'RightHand',minimumWeight,rigidVertices:vertexNode.size,records,triangles,edges:[...edges].map(s=>s.split(':').map(Number)),limits:['PCA gives a plotting frame, not digit identity or grip acceptance.','Authored source-vertex landmarks and independent camera review are required.']};
}
export async function inspectGripSource({input,adapter,out}){const rig=await loadRig(path.resolve(ROOT,input)),bytes=await readFile(path.resolve(ROOT,adapter)),cal=JSON.parse(bytes),evidence=inspectHand(rig,cal),context=inspectHand(rig,cal,'right',.500001),output=await outputDirectory(out);evidence.input=path.resolve(ROOT,input);evidence.adapter=path.resolve(ROOT,adapter);evidence.adapterSha256=sha256(bytes);evidence.context={records:context.records,triangles:context.triangles,edges:context.edges,minimumWeight:.500001,measurementOnly:true};await writeFile(path.join(output,'hand-evidence.json'),JSON.stringify(evidence,null,2)+'\n');return{output,sha256:rig.sha256,rigidVertices:evidence.rigidVertices,surfacePoints:evidence.records.length,contextSurfacePoints:context.records.length};}

/** Two measured virtual hinges, not new bones. Digit regions are explicitly
 * authored indexed branches; hand skin weight alone is not digit identity. */
export function bendDigit(point,{mcp,pip,mcpAxis,pipAxis,mcpAngle,pipAngle,pipFeather=.004}){
  for(const angle of [mcpAngle,pipAngle])if(!Number.isFinite(angle)||Math.abs(angle)>1.4)throw Error('Prototype virtual joint angle exceeds 1.4rad');
  const a=vec(mcp,'MCP'),b=vec(pip,'PIP'),axis=unit(mcpAxis,'MCP axis'),second=unit(pipAxis,'PIP axis'),q=new THREE.Quaternion().setFromAxisAngle(axis,mcpAngle),q2=new THREE.Quaternion().setFromAxisAngle(second,pipAngle),direction=b.clone().sub(a),length=direction.length();
  if(length<.012||length>.09||!(pipFeather>.001&&pipFeather<=.008))throw Error('Measured virtual phalanx/feather invalid');direction.normalize();
  const proximal=point.clone().sub(a).applyQuaternion(q).add(a),targetPIP=b.clone().sub(a).applyQuaternion(q).add(a),distal=point.clone().sub(b).applyQuaternion(q2).applyQuaternion(q).add(targetPIP),s=point.clone().sub(b).dot(direction),blend=smooth((s+pipFeather)/(pipFeather*2));
  return proximal.lerp(distal,blend);
}
/** Smooth centreline bend for the isolated v6 hand. Rotate intact cross-sections
 * instead of averaging two hinged surfaces (which pinches the inner web).
 * Source-relative zero rotations remain exact; the unselected mesh is untouched.
 * This is an authored shape edit, not clinical finger anatomy or new rig bones. */
export function curveDigit(point,{mcp,pip,mcpAxis,pipAxis,mcpAngle,pipAngle,rootFeather=.025,pipSpan=.022}){
  for(const angle of [mcpAngle,pipAngle])if(!Number.isFinite(angle)||Math.abs(angle)>1.4)throw Error('Prototype virtual joint angle exceeds 1.4rad');
  if(!(rootFeather>=.015&&rootFeather<=.04&&pipSpan>=.012&&pipSpan<=.035))throw Error('Measured curve transition outside hand bounds');
  const a=vec(mcp,'MCP'),b=vec(pip,'PIP'),axis=unit(mcpAxis,'MCP axis'),second=unit(pipAxis,'PIP axis'),direction=b.clone().sub(a),length=direction.length();
  if(length<.012||length>.09)throw Error('Measured virtual phalanx invalid');direction.normalize();
  const offset=point.clone().sub(a),s=offset.dot(direction);if(s<=0||mcpAngle===0&&pipAngle===0)return point.clone();
  const radial=offset.clone().addScaledVector(direction,-s),q1=new THREE.Quaternion(),q2=new THREE.Quaternion();
  const orientation=u=>q1.setFromAxisAngle(axis,mcpAngle*smooth(u/rootFeather)).multiply(q2.setFromAxisAngle(second,pipAngle*smooth((u-length+pipSpan*.5)/pipSpan)));
  // Fixed sub-millimetre integration independent of mesh tessellation; bounded
  // to this actual hand's <=110mm measured MCP reach.
  const steps=Math.max(1,Math.ceil(s/.0005)),step=s/steps,centre=a.clone(),tangent=new THREE.Vector3();
  for(let i=0;i<steps;i++)centre.addScaledVector(tangent.copy(direction).applyQuaternion(orientation((i+.5)*step)),step);
  return centre.add(radial.applyQuaternion(orientation(s)));
}
/** Follow the actual bent source tube, rather than treating its pre-existing
 * phalanx curvature as a radial offset from a straight line. The proximal and
 * distal section lengths are retained. Explicit root alignment is separate
 * from flexion; it must be justified from the source branch, never bone names. */
export function sourceCurveDigit(point,{mcp,pip,tip,mcpAxis,pipAxis,mcpAngle,pipAngle,rootFeather=.025,pipSpan=.022,rootAlignment}){
  for(const angle of [mcpAngle,pipAngle])if(!Number.isFinite(angle)||Math.abs(angle)>1.4)throw Error('Prototype virtual joint angle exceeds 1.4rad');
  if(!(rootFeather>=.015&&rootFeather<=.04&&pipSpan>=.012&&pipSpan<=.035))throw Error('Measured curve transition outside hand bounds');
  const a=vec(mcp,'MCP'),b=vec(pip,'PIP'),c=vec(tip,'tip'),axis=unit(mcpAxis,'MCP axis'),second=unit(pipAxis,'PIP axis');
  const ab=b.clone().sub(a),bc=c.clone().sub(b),l1=ab.length(),l2=bc.length();
  if(l1<.012||l1>.09||l2<.01||l2>.07)throw Error('Measured source phalanx invalid');
  const t1=ab.divideScalar(l1),t2=bc.divideScalar(l2);
  const relative=point.clone().sub(a),before=relative.dot(t1);
  if(before<=0)return point.clone();
  const on1=THREE.MathUtils.clamp(before,0,l1),on2=THREE.MathUtils.clamp(point.clone().sub(b).dot(t2),0,l2+.012);
  const p1=a.clone().addScaledVector(t1,on1),p2=b.clone().addScaledVector(t2,on2);
  const s=point.distanceToSquared(p1)<=point.distanceToSquared(p2)?on1:l1+on2;
  const source=s<=l1?a.clone().addScaledVector(t1,s):b.clone().addScaledVector(t2,s-l1),radial=point.clone().sub(source);
  const alignment=rootAlignment?new THREE.Quaternion().setFromAxisAngle(unit(rootAlignment.axis,'root alignment axis'),rootAlignment.angle):new THREE.Quaternion();
  if(rootAlignment&&(!rootAlignment.reason||!Number.isFinite(rootAlignment.angle)||Math.abs(rootAlignment.angle)>1.4))throw Error('Explicit bounded source root alignment required');
  if(mcpAngle===0&&pipAngle===0&&!rootAlignment)return point.clone();
  const q1=new THREE.Quaternion(),q2=new THREE.Quaternion(),qr=new THREE.Quaternion(),identity=new THREE.Quaternion();
  const orientation=u=>qr.copy(identity).slerp(alignment,smooth(u/rootFeather)).multiply(q1.setFromAxisAngle(axis,mcpAngle*smooth(u/rootFeather))).multiply(q2.setFromAxisAngle(second,pipAngle*smooth((u-l1+pipSpan*.5)/pipSpan)));
  const centre=a.clone(),steps=Math.max(1,Math.ceil(s/.0004)),step=s/steps;
  // Split the source tangent discontinuity exactly; this also makes the zero
  // rotation map independent of integration step size.
  for(let i=0;i<steps;i++){const lo=i*step,hi=(i+1)*step;
    if(lo<l1&&hi>l1){centre.addScaledVector(t1.clone().applyQuaternion(orientation((lo+l1)/2)),l1-lo);centre.addScaledVector(t2.clone().applyQuaternion(orientation((l1+hi)/2)),hi-l1);}
    else centre.addScaledVector((hi<=l1?t1:t2).clone().applyQuaternion(orientation((lo+hi)/2)),step);
  }
  return centre.add(radial.applyQuaternion(orientation(s)));
}
const affine=m=>{const e=m.elements;if([3,7,11].some(i=>Math.abs(e[i])>1e-9)||Math.abs(e[15]-1)>1e-9)throw Error('Non-affine socket');e[3]=e[7]=e[11]=0;e[15]=1;return m;};
export async function fitGrip({input,adapter,guide,out,deps}){
  const rig=await loadRig(path.resolve(ROOT,input)),adapterBytes=await readFile(path.resolve(ROOT,adapter)),cal=JSON.parse(adapterBytes),guideBytes=await readFile(path.resolve(ROOT,guide)),recipe=JSON.parse(guideBytes);
  if(recipe.schema!==1||recipe.family!=='master_sword'||recipe.side!=='right'||recipe.inputSha256!==rig.sha256||recipe.adapterSha256!==sha256(adapterBytes)||!recipe.sourceViews?.length)throw Error('Actual inspected master_sword source/adapter/view pins required');
  if(!Array.isArray(recipe.digits)||recipe.digits.length!==5||new Set(recipe.digits.map(d=>d.name)).size!==5||['thumb','index','middle','ring','little'].some(n=>!recipe.digits.some(d=>d.name===n)))throw Error('Exactly five authored digits required');
  const sourceViews=[];
  for(const view of recipe.sourceViews){if(!view?.path||!/^[a-f0-9]{64}$/.test(view.sha256??'')||sha256(await readFile(path.resolve(ROOT,view.path)))!==view.sha256)throw Error('Source image pin missing or stale');sourceViews.push(view);}
  const output=await outputDirectory(out);
  for(const name of ['master_sword-grip-unpacked.glb','master_sword-grip.glb','grip-fit.json']){
    try{await access(path.join(output,name));}catch(e){if(e.code==='ENOENT')continue;throw e;}
    throw Error('Grip revision already contains output; choose a new immutable revision');
  }
  const context=inspectHand(rig,cal,'right',.05),frame=handFrame(rig,cal,'right'),byVertex=new Map();
  for(const r of context.records)for(const i of r.vertices)byVertex.set(i,r);
  const pointFor=ids=>{if(!Array.isArray(ids)||ids.length<2||ids.some(v=>!byVertex.has(v)))throw Error('Landmark must reference actual same-hand surface vertices');return ids.reduce((p,i)=>p.add(vec(byVertex.get(i).hand,'landmark')),new THREE.Vector3()).divideScalar(ids.length);};
  const selected=new Map(),digitalEvidence=[];
  for(const d of recipe.digits){
    if(!d.reason||!Array.isArray(d.vertices)||d.vertices.length<4||d.vertices.some(i=>!byVertex.has(i)))throw Error('Authored digit region must use actual same-hand indexed vertices');
    // The source little digit has only ~43% Hand, despite being a visible
    // indexed finger branch. An explicit, reviewed exception is required;
    // no automatic low-weight expansion into wrist/forearm is permitted.
    const minimum=d.minimumHandWeight??.500001;
    if(!Number.isFinite(minimum)||minimum<.4||minimum>.999999||(minimum<=.5&&!d.mixedOwnershipReason))throw Error('Mixed digit ownership requires exact source evidence');
    if(d.vertices.some(i=>byVertex.get(i).minimumHandWeight<minimum))throw Error('Digit ownership below authored minimum');
    const mcp=pointFor(d.mcpVertices),pip=pointFor(d.pipVertices),tip=pointFor(d.tipVertices),bend={...d,mcp:mcp.toArray(),pip:pip.toArray()},axis=pip.clone().sub(mcp).normalize();
    const rootFeather=d.rootFeather??.025;if(!(rootFeather>=.015&&rootFeather<=.04))throw Error('Digit base blend outside 15–40mm');
    const reach=Math.max(...d.vertices.map(i=>vec(byVertex.get(i).hand,'digit').distanceTo(mcp))),bound=2*reach;
    if(reach>.11)throw Error('Digit region extends beyond measured hand-sized reach');
    if(d.deformation!==undefined&&!['hinge','curve','sourceCurve'].includes(d.deformation))throw Error('Unknown authored digit deformation');
    if(d.deformation==='sourceCurve'&&(d.mcpAngle<0||d.pipAngle<0))throw Error('Source curve flexion must be positive; source splay correction is explicit root alignment');
    const strengths=new Map();
    for(const edit of d.rootSurfaceStrengths??[]){if(!d.rootSurfaceReason||!d.vertices.includes(edit.vertex)||strengths.has(edit.vertex)||!Number.isFinite(edit.strength)||edit.strength<.25||edit.strength>1)throw Error('Explicit bounded source-root surface strengths required');strengths.set(edit.vertex,edit.strength);}
    for(const i of d.vertices){const r=byVertex.get(i);if(selected.has(r.id))throw Error('Digit regions overlap');const p=vec(r.hand,'digit'),s=p.clone().sub(mcp).dot(axis),amount=smooth((s+rootFeather*.5)/rootFeather),bent=d.deformation==='sourceCurve'?sourceCurveDigit(p,{...bend,tip:tip.toArray(),rootFeather}):d.deformation==='curve'?curveDigit(p,{...bend,rootFeather}):bendDigit(p,bend),point=d.deformation==='hinge'||d.deformation===undefined?p.clone().lerp(bent,amount):bent;point.lerp(p,1-(strengths.get(i)??1));if(point.distanceTo(p)>bound+1e-6)throw Error('Finger moved beyond twice its source MCP reach');selected.set(r.id,{digit:d.name,point,bound});}
    digitalEvidence.push({name:d.name,deformation:d.deformation??'hinge',reason:d.reason,mixedOwnershipReason:d.mixedOwnershipReason??null,minimumHandWeight:minimum,mcpVertices:d.mcpVertices,pipVertices:d.pipVertices,tipVertices:d.tipVertices,mcp:mcp.toArray(),pip:pip.toArray(),tip:tip.toArray(),mcpAxis:d.mcpAxis,pipAxis:d.pipAxis,rootAlignment:d.rootAlignment??null,rootSurfaceStrengths:d.rootSurfaceStrengths??[],rootSurfaceReason:d.rootSurfaceReason??null,virtualMCP:d.mcpAngle,virtualPIP:d.pipAngle,surfacePoints:d.vertices.length,rootFeather,measuredReach:reach,maxDisplacementBound:bound});
  }
  const original=worldVertices(rig),position=rig.mesh.geometry.attributes.position.array.slice(),modified=new Set(),displacements=[],inverseMesh=restGeometryMatrix(rig).invert();
  for(const r of context.records){const fit=selected.get(r.id);if(!fit)continue;const world=fit.point.clone().applyMatrix4(frame.matrix),delta=world.distanceTo(vec(r.world,'world'));if(delta<=1e-9)continue;for(const i of r.vertices){const local=world.clone().applyMatrix4(inverseMesh);local.toArray(position,i*3);modified.add(i);}displacements.push({digit:fit.digit,sourceVertex:r.vertex,metres:delta,bound:fit.bound});}
  // Recompute normals at changed hand vertices ONLY. Preserve every nonhand
  // position/normal, all UVs, indices, weights, bind frames, textures and clips.
  const geometry=rig.mesh.geometry.clone();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.computeVertexNormals();
  const normals=rig.mesh.geometry.attributes.normal.array.slice();
  // The source hand has duplicated positions along UV seams. Average area-
  // weighted geometric normals only at these explicitly modified hand points;
  // UVs, topology and every outside normal remain byte-identical.
  const normalSums=new Map(),nodeForVertex=new Map(context.records.flatMap(r=>r.vertices.map(i=>[i,r.id]))),ids=geometry.index.array;
  if(recipe.smoothHandNormals){const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let n=0;n<ids.length;n+=3){const tri=[ids[n],ids[n+1],ids[n+2]];if(!tri.some(i=>modified.has(i)))continue;
      a.fromArray(position,tri[0]*3);b.fromArray(position,tri[1]*3).sub(a);c.fromArray(position,tri[2]*3).sub(a);const normal=b.cross(c);
      for(const i of tri){if(!modified.has(i))continue;const id=nodeForVertex.get(i);if(!normalSums.has(id))normalSums.set(id,new THREE.Vector3());normalSums.get(id).add(normal);}
    }
  }
  for(const i of modified){const summed=normalSums.get(nodeForVertex.get(i));if(summed&&summed.lengthSq()>1e-16)summed.clone().normalize().toArray(normals,i*3);else for(let k=0;k<3;k++)normals[i*3+k]=geometry.attributes.normal.getComponent(i,k);}geometry.dispose();
  const builder=new GLBBuilder();builder.json=structuredClone(rig.json);builder.parts=[Buffer.from(rig.bin)];builder.length=rig.bin.length;
  builder.json.meshes[0].primitives[0].attributes.POSITION=builder.accessor(position,'VEC3',{bounds:true});builder.json.meshes[0].primitives[0].attributes.NORMAL=builder.accessor(normals,'VEC3');
  const unpacked=path.join(output,'master_sword-grip-unpacked.glb');await writeFile(unpacked,builder.encode(),{flag:'wx'});
  const dependencies=packingDependencies(deps),candidate=path.join(output,'master_sword-grip.glb');
  await promisify(execFile)(process.execPath,[dependencies.gltfpack,'-i',unpacked,'-o',candidate,'-cc','-kn','-ke'],{timeout:120000,windowsHide:true});
  const result=await loadRig(candidate);assertNativeContract(rig,result,2e-4);const audit=auditRig(result,{height:cal.coordinates.height,semantics:cal.semantics});
  const clean=await loadRig(unpacked);assertNativeContract(rig,clean);const positionAfter=clean.mesh.geometry.attributes.position.array,normalAfter=clean.mesh.geometry.attributes.normal.array,changedWorld=worldVertices(clean),staticEdges=edgeStrain(changedWorld,indexEdges(rig.mesh.geometry,original));
  let minAreaRatio=Infinity,minTriangle=null;const triangleIndices=rig.mesh.geometry.index.array,pa=new THREE.Vector3(),pb=new THREE.Vector3(),pc=new THREE.Vector3();
  const area=(values,a,b,c)=>{pa.fromArray(values,a*3);pb.fromArray(values,b*3).sub(pa);pc.fromArray(values,c*3).sub(pa);return pb.cross(pc).length()/2;};
  for(let n=0;n<triangleIndices.length;n+=3){const ids=[triangleIndices[n],triangleIndices[n+1],triangleIndices[n+2]];if(!ids.some(i=>modified.has(i)))continue;const restArea=area(original,...ids);if(restArea<1e-10)continue;const ratio=area(changedWorld,...ids)/restArea;if(ratio<minAreaRatio){minAreaRatio=ratio;minTriangle={triangle:n/3,vertices:ids,restArea};}}
  let outsideChanges=0;for(let i=0;i<position.length/3;i++)if(!modified.has(i))for(let k=0;k<3;k++)if(positionAfter[i*3+k]!==rig.mesh.geometry.attributes.position.getComponent(i,k)||normalAfter[i*3+k]!==rig.mesh.geometry.attributes.normal.getComponent(i,k))outsideChanges++;
  if(outsideChanges)throw Error('Nonhand geometry changed');
  for(const a of ['uv','skinIndex','skinWeight'])if(!clean.mesh.geometry.attributes[a].array.every((v,i)=>v===rig.mesh.geometry.attributes[a].array[i]))throw Error('UV/skin attributes changed');
  if(!clean.mesh.geometry.index.array.every((v,i)=>v===rig.mesh.geometry.index.array[i]))throw Error('Topology changed');
  const measured=ids=>{pointFor(ids);return ids.reduce((p,i)=>p.add(new THREE.Vector3().fromArray(changedWorld,i*3)),new THREE.Vector3()).divideScalar(ids.length);};
  const webWorld=measured(recipe.webVertices),palmAxisWorld=measured(recipe.palmAxisVertices),web=webWorld.clone().applyMatrix4(frame.inverse),shaft=webWorld.clone().sub(palmAxisWorld);
  if(shaft.length()<.035||shaft.length()>.14||shaft.dot(frame.x)<=0)throw Error('Actual thumb-web to ulnar-palm axis required');shaft.normalize();
  const normal=frame.z.clone().addScaledVector(shaft,-frame.z.dot(shaft)).normalize(),edge=frame.y.clone().addScaledVector(shaft,-frame.y.dot(shaft)).normalize(),flat=new THREE.Vector3().crossVectors(shaft,edge).normalize(),radius=.016,guardSideGripWorld=webWorld.clone().addScaledVector(normal,radius+.001),center=guardSideGripWorld.clone().addScaledVector(shaft,-.08),rotation=new THREE.Matrix4().makeBasis(edge,flat,shaft),legacy=new THREE.Vector3(0,RIG.handY,.05),world=rotation.clone().setPosition(center.clone().sub(legacy.clone().applyMatrix4(rotation))),socket=affine(frame.bone.matrixWorld.clone().invert().multiply(world));
  const profileFields={sockets:{foreR:{bone:'RightHand',matrix:socket.toArray()}}};
  const staticEdgesPassed=staticEdges.violations===0,nondegenerate=Number.isFinite(minAreaRatio)&&minAreaRatio>0;
  const report={schema:1,family:'master_sword',side:'right',status:audit.passed&&staticEdgesPassed&&nondegenerate?'PROTOTYPE_REQUIRES_ACTUAL_VISUAL_REVIEW':'PROTOTYPE_NUMERIC_HOLD',input:path.resolve(ROOT,input),inputSha256:rig.sha256,adapter:path.resolve(ROOT,adapter),adapterSha256:sha256(adapterBytes),guide:path.resolve(ROOT,guide),guideSha256:sha256(guideBytes),sourceViews,candidate,assetSha256:result.sha256,unpacked,unpackedSha256:clean.sha256,digits:digitalEvidence,smoothHandNormals:recipe.smoothHandNormals===true,changedHandVertices:modified.size,changedSourceVertices:[...modified].sort((a,b)=>a-b),maxDisplacement:Math.max(...displacements.map(d=>d.metres)),nonhandChanges:outsideChanges,unpackedUVTopologyRigWeightsTexturesAndClipsUnchanged:true,profileFields,staticDeformation:{...staticEdges,passed:staticEdgesPassed&&nondegenerate,minimumTriangleAreaRatio:minAreaRatio,worstTriangle:minTriangle,interpretation:'Original-source versus changed rest geometry, separate from native animated-rest gates; area compression still needs camera review.'},
    fit:{webVertices:recipe.webVertices,palmAxisVertices:recipe.palmAxisVertices,webHand:web.toArray(),webWorld:webWorld.toArray(),ulnarPalmWorld:palmAxisWorld.toArray(),shaftWorld:shaft.toArray(),outwardBladeEdgeWorld:edge.toArray(),guardSideGripWorld:guardSideGripWorld.toArray(),handleCenterWorld:center.toArray(),legacyHandleCenter:legacy.toArray(),legacyGuardSideGrip:[0,RIG.handY,.13],guardSideSurfaceOffset:radius+.001,meaning:'Actual thumb-index web and ulnar-palm landmarks define hilt axis; centre is 80mm along that axis toward palm. Blade width points distally away from wrist. This proposed surface fit is not a claim of physical contact.'},audit,visualApproved:false,
    limitations:['Prototype ONLY; numeric skin pass does not approve grasp/anatomy or source cleanup.','Only explicitly authored finger branches are deformed; source skin weights and nonfinger geometry remain fixed. The little finger has mixed forearm/hand ownership and needs runtime wrist review.','Virtual MCP/PIP landmarks are authored from this mesh, not actual skeleton joints or clinical anatomical measurements.','Packing uses the existing quantization pipeline; exact attribute preservation is checked on the unpacked editable candidate.','Static closed right hand is unsuitable for prayer/wai; original open input remains immutable.','Independent front/back/side closeups must confirm five digits, thumb opposition, palm-web hilt fit, no skin/prop intersections and outward blade.']};
  if(sha256(await readFile(path.resolve(ROOT,input)))!==rig.sha256||sha256(await readFile(path.resolve(ROOT,adapter)))!==sha256(adapterBytes)||sha256(await readFile(path.resolve(ROOT,guide)))!==sha256(guideBytes))throw Error('Pinned input changed');
  await writeFile(path.join(output,'grip-fit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return{status:report.status,candidate,assetSha256:result.sha256,auditPassed:audit.passed,staticPassed:report.staticDeformation.passed,failures:audit.failures,changedHandVertices:modified.size,maxDisplacement:report.maxDisplacement,report:path.join(output,'grip-fit.json'),visualApproved:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [mode,...args]=process.argv.slice(2),o={};for(let i=0;i<args.length;i+=2){const name=args[i]?.slice(2);if(!['input','adapter','guide','out','deps'].includes(name)||!args[i+1]||o[name])throw Error('Usage: fit-grip.mjs inspect|fit --input prepared-unpacked.glb --adapter actual-adapter.json [--guide source-landmarks.json --deps EXISTING_PROJECT] --out artifacts/grip-fits/master_sword');o[name]=args[i+1];}
    if(!['inspect','fit'].includes(mode)||!o.input||!o.adapter||!o.out||(mode==='fit'&&!o.guide))throw Error('Inspected input/adapter/output/landmarks required');const result=await(mode==='inspect'?inspectGripSource(o):fitGrip(o));console.log(JSON.stringify(result));if(result.auditPassed===false||result.staticPassed===false)process.exitCode=1;
  }catch(e){console.error(e.stack);process.exitCode=1;}
}
