import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const base = 'docs/art/items/painted-complete-v1';
const backlog = JSON.parse(readFileSync(`${base}/backlog.json`));
const finalize = process.argv.includes('--finalize');
const reviewPath = `${base}/art-review.json`;
const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath)) : null;
const approved = new Set(review?.approved === true ? review.approvedIDs : []);
const items = [], pending = [], mapping = {};
for (const group of backlog.groups) {
  let image = group.approvedImage, receipt;
  if (group.status === 'new-generation') {
    const path = `${base}/provenance/${group.representativeID}.json`;
    if (!existsSync(path)) { pending.push(group.representativeID); continue; }
    receipt = JSON.parse(readFileSync(path));
    if (receipt.jobID !== group.representativeID || JSON.stringify(receipt.memberIDs) !== JSON.stringify(group.memberIDs)) throw Error(`Receipt/group mismatch: ${path}`);
    if (receipt.width !== 256 || receipt.height !== 256 || !receipt.hasAlpha || receipt.alphaMin !== 0 || receipt.alphaMax !== 255 || !existsSync(receipt.output)) throw Error(`Invalid exported texture: ${path}`);
    image = receipt.output.replace(/^public\//, '');
  }
  if (!image || !existsSync(`public/${image}`)) throw Error(`Missing image: ${group.representativeID}`);
  for (const id of group.memberIDs) {
    if (mapping[id]) throw Error(`Duplicate mapped item: ${id}`);
    mapping[id] = image;
  }
  items.push({ id: group.representativeID, name: group.name, type: group.type,
    levels: group.levels, memberIDs: group.memberIDs, image: `/${image}`,
    origin: receipt ? 'new' : 'reuse',
    status: !receipt || approved.has(group.representativeID) ? 'อนุมัติแล้ว' : 'รอตรวจภาพ',
    bytes: receipt?.bytes ?? null });
}
const summary = { plannedNewMasters: backlog.counts.newImageGenJobs,
  completedNewMasters: items.filter(item => item.origin === 'new').length,
  reusedApprovedMasters: items.filter(item => item.origin === 'reuse').length,
  mappedIDs: Object.keys(mapping).length, activeIDs: backlog.counts.activeItems,
  pendingMasters: pending.length };
mkdirSync('public/ui/items/painted-complete-v1', { recursive: true });
writeFileSync('public/ui/items/painted-complete-v1/preview-manifest.json', JSON.stringify({ summary, items }, null, 2) + '\n');
if (finalize) {
  if (pending.length || Object.keys(mapping).length !== backlog.counts.activeItems) throw Error(`Completion gate not satisfied: ${JSON.stringify(summary)}`);
  if (!review?.approved || !(review.score >= 8) || approved.size !== backlog.groups.length || backlog.groups.some(group => !approved.has(group.representativeID)) || review.rejectedIDs?.length) throw Error('Art review gate not satisfied: require score>=8, all semantic masters explicitly approved and no rejected IDs');
  const sorted = Object.fromEntries(Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync('src/character/data/complete-painted-item-icons.js', `// Generated from the audited semantic asset backlog; art-only IDs.\nexport const COMPLETE_PAINTED_ITEM_ICONS = Object.freeze(${JSON.stringify(sorted, null, 2)});\n`);
  writeFileSync(`${base}/completion-manifest.json`, JSON.stringify({ summary, items }, null, 2) + '\n');
}
console.log(JSON.stringify(summary));
