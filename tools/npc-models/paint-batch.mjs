import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './glb.mjs';
import { paintTextiles } from './thai-textiles.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const profiles=JSON.parse(await readFile(path.join(root,'docs/art/npcs/THAI_TEXTILE_PROFILES.json'),'utf8')).profiles;
const pinned=path.join(root,'artifacts/city-npc-models/garment-basis');await mkdir(pinned,{recursive:true});
const report={schema:1,scope:'Garment preview only. Body and runtime acceptance remain independent.',families:{}};
for(const profile of profiles) {
  if(profile.family==='warp_keeper') continue; // Accepted immutable v4 pilot.
  try {
    const input=path.join(root,profile.basis.source),bytes=await readFile(input),actual=sha256(bytes);
    if(actual!==profile.basis.sourceSHA256) throw Error('Garment basis changed; remeasure or prove decoded geometry equivalence');
    const file=path.join(pinned,`${profile.family}-${actual}.glb`);
    await writeFile(file,bytes); // Same content-addressed basis, no mutable candidate overwrite.
    const result=await paintTextiles(file,profile);
    report.families[profile.family]={status:'preview-ready',...result};
    console.log(JSON.stringify({family:profile.family,status:'preview-ready',sha256:result.sha256,bytes:result.bytes,changedPixels:result.changedPixels}));
  }catch(error){report.families[profile.family]={status:'pending',error:error.message};console.log(JSON.stringify({family:profile.family,...report.families[profile.family]}));}
}
await writeFile(path.join(root,'artifacts/city-npc-models/textiles/batch.json'),JSON.stringify(report,null,2)+'\n');
