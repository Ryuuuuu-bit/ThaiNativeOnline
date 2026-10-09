// Split one snapshot-bound L3 background GLB into species rigs before packing.
// Export jobs include hidden authoring objects; only the named rig subtree and
// its baked action belong in a game's individual creature file.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [input,out,...selected]=process.argv.slice(2);
if(!input||!out)throw Error('Usage: extract_batch.mjs verified-background.glb output-directory');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),sourceSha256=createHash('sha256').update(await fs.readFile(input)).digest('hex');
const specs=selected.length?selected.map(s=>s.split(':')):[['kongkoi','v3'],['monitor','v4'],['pray','v4'],['khamot','v1'],['winyan','v4'],['takian','v4']];
for(const [type,version] of specs){
 if(!['kongkoi','monitor','pray','khamot','winyan','takian'].includes(type)||!(/^(rest|v[1-9][0-9]*)$/).test(version))throw Error('Unknown species/version');
 const doc=await io.read(input),root=doc.getRoot(),prefix=type[0].toUpperCase()+type.slice(1)+version.toUpperCase();
 const surface=root.listNodes().find(n=>n.getName()===prefix+'Surface'),rig=surface?.getParentNode();
 if(rig?.getName()!==prefix+'Rig'||surface.getSkin()?.getName()!==prefix+'Rig')throw Error('Expected authored species hierarchy');
 const keep=new Set();function visit(n){keep.add(n);n.listChildren().forEach(visit);}visit(rig);
 const scene=root.listScenes()[0];for(const s of root.listScenes())for(const n of s.listChildren())s.removeChild(n);scene.addChild(rig);
 for(const action of root.listAnimations())if(action.getName()!==prefix+'RigAction')action.dispose();
 for(const n of root.listNodes())if(!keep.has(n))n.dispose();
 await doc.transform(prune());
 if(root.listMeshes().length!==1||root.listSkins().length!==1||root.listAnimations().length!==(version==='rest'?0:1))throw Error('Batch extraction retained authoring objects');
 const output=`${out}/${type}-rig-production.glb`;await io.write(output,doc);
 const report={type,version,sourceSha256,outputSha256:createHash('sha256').update(await fs.readFile(output)).digest('hex'),bones:surface.getSkin().listJoints().length};
 await fs.writeFile(`${out}/${type}-production-extract.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
