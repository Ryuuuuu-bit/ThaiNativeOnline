// Isolate one verified snapshot's registered boss rig before clip packaging.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {BIPED_BOSS_TYPES} from './calibrate_boss.mjs';

// CLI and callable offline-safe module share the same approved biped whitelist.
export async function extractBoss(type,{dir,tag='final-v1'}={}) {
if(!dir||!BIPED_BOSS_TYPES.includes(type))throw Error('Explicit approved biped output directory/type required; Naga needs a serpent rig');
const report=JSON.parse(await fs.readFile(`${dir}/${type}-rig-report.json`)),journal=JSON.parse(await fs.readFile(`${dir}/${type}-${tag}-export.json`));
const receipt=journal.jobs.find(j=>j.format==='glb')?.verifiedStatus?.artifact;
if(!receipt)throw Error('Export must complete and verify first');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(await fs.readFile(receipt.path))!==receipt.sha256)throw Error('Export hash mismatch');
const [{NodeIO},{ALL_EXTENSIONS},{prune}]=await Promise.all([import('@gltf-transform/core'),import('@gltf-transform/extensions'),import('@gltf-transform/functions')]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(receipt.path),root=doc.getRoot();
const rig=root.listNodes().find(n=>n.getName()===report.rigName),surface=root.listNodes().find(n=>n.getName()===report.surfaceName);
if(surface?.getParentNode()!==rig||surface.getSkin()?.getName()!==report.rigName)throw Error('Wrong authored mesh/skin hierarchy');
const keep=new Set();function visit(n){keep.add(n);n.listChildren().forEach(visit);}visit(rig);
const scene=root.listScenes()[0];for(const s of root.listScenes())for(const n of s.listChildren())s.removeChild(n);scene.addChild(rig);
for(const a of root.listAnimations())if(a.getName()!==report.rigName+'Action')a.dispose();
for(const n of root.listNodes())if(!keep.has(n))n.dispose();await doc.transform(prune());
if(root.listMeshes().length!==1||root.listSkins().length!==1||root.listAnimations().length!==1)throw Error('Expected one authored animated surface');
const retained=new Set(root.listSkins()[0].listJoints().map(j=>j.getName()));
for(const detail of report.rigidBones??[])if(!retained.has(detail.bone))throw Error('Missing authored rigid detail bone '+detail.bone);
const output=`${dir}/${type}-rig-production.glb`;await io.write(output,doc);
await fs.writeFile(`${dir}/${type}-production-extract.json`,JSON.stringify({type,sourceSha256:receipt.sha256,outputSha256:hash(await fs.readFile(output))},null,2)+'\n');
return output;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 try {console.log(process.argv[2],await extractBoss(process.argv[2],{tag:process.argv[3]??'final-v1',dir:process.env.MESHY_RIG_OUTPUT}));}
 catch(error) {console.error(error.message);process.exitCode=1;}
}
