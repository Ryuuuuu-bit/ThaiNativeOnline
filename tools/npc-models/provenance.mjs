// Whitelist provider lineage; never copy signed URLs or authentication files.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './glb.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const state=JSON.parse(await readFile(path.join(root,'artifacts/city-npc-models/jobs.json'),'utf8'));
const families={},tasks=new Set(),totals={preview:0,refine:0,rigging:0,credits:0};
function attempt(input,generation) {
  const result={generation};
  for(const stage of ['preview','refine','rigging']) {
    const s=input[stage]; if(!s) continue;
    if(!/^[\da-f-]{36}$/.test(s.taskId)||tasks.has(s.taskId)||s.status!=='SUCCEEDED'||!Number.isFinite(s.credits)) throw Error('Invalid, duplicate or incomplete generation receipt');
    tasks.add(s.taskId);totals[stage]++;totals.credits+=s.credits;
    result[stage]={taskId:s.taskId,status:s.status,consumedCredits:s.credits};
  }
  return result;
}
for(const [family,input] of Object.entries(state.families)) {
  families[family]={rejectedAttempts:(input.rejectedAttempts??[]).map(a=>attempt(a,a.generation??1)),selected:attempt(input,input.generation??1)};
}
if(totals.credits!==805||totals.preview!==26||totals.refine!==19||totals.rigging!==19||Object.keys(families).length!==17) throw Error('Reconcile approved 805-credit lineage before publishing');
const source=await readFile(path.join(root,'artifacts/city-npc-models/jobs.json'));
const report={schema:1,provider:'Meshy',generationDate:'2026-10-10',families,totals,maximumAuthorisedNpcCredits:805,
  localThaiTextileCredits:0,accountBalance:{credits:953,verifiedWith:'meshy balance --output-schema v1 --format json --no-update-check',date:'2026-10-10',scope:'Shared account; separate companion dog generation consumed 30 credits'},
  rejectedAttemptPolicy:'All paid rejected drafts are retained in task lineage; they are not shipping assets.',
  generationReceiptSHA256:sha256(source),acceptance:'Generation completed. Individual anatomy, textile and runtime acceptance receipts determine release; generation success alone is not approval.'};
await writeFile(path.join(root,'docs/art/npcs/GENERATION_PROVENANCE.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({families:Object.keys(families).length,...totals,balance:953}));
