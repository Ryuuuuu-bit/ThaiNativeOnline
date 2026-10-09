// Extract only named Wat Rang rig subtrees/actions from a verified L3 snapshot.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-04/wat-rang';
const input=`${dir}/jobs/job_wat_${process.argv[2]??'final'}_glb/artifact.glb`;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),sourceSha256=createHash('sha256').update(await fs.readFile(input)).digest('hex');
for(const type of ['headless','pret','krahang','krasue','phitaihong','soldier','pusom']){
 const doc=await io.read(input),root=doc.getRoot(),prefix=type[0].toUpperCase()+type.slice(1)+'V1';
 const rig=root.listNodes().find(n=>n.getName()===prefix+'Rig'),surface=root.listNodes().find(n=>n.getName()===prefix+'Surface');
 if(surface?.getParentNode()!==rig||surface.getSkin()?.getName()!==prefix+'Rig')throw Error('Wrong authored hierarchy: '+type);
 const keep=new Set();function visit(n){keep.add(n);n.listChildren().forEach(visit);}visit(rig);
 const scene=root.listScenes()[0];for(const s of root.listScenes())for(const n of s.listChildren())s.removeChild(n);scene.addChild(rig);
 for(const a of root.listAnimations())if(a.getName()!==prefix+'RigAction')a.dispose();
 for(const n of root.listNodes())if(!keep.has(n))n.dispose();await doc.transform(prune());
 if(root.listMeshes().length!==1||root.listSkins().length!==1||root.listAnimations().length!==1)throw Error('Expected one fully animated surface: '+type);
 const output=`${dir}/${type}-rig-production.glb`;await io.write(output,doc);
 await fs.writeFile(`${dir}/${type}-production-extract.json`,JSON.stringify({type,sourceSha256,outputSha256:createHash('sha256').update(await fs.readFile(output)).digest('hex')},null,2)+'\n');console.log(type);
}
