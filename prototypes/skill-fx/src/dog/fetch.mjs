import fs from 'fs';
const jobs = JSON.parse(fs.readFileSync('dog/jobs.json', 'utf8'));
for (const [anim, dirs] of Object.entries(jobs)) for (const [dir, id] of Object.entries(dirs)) {
  const n = anim === 'idle' ? 5 : 9; const out = `dog/${anim}/${dir}`; fs.mkdirSync(out, { recursive: true });
  for (let i = 0; i < n; i++) { const f = `${out}/${i}.png`; if (fs.existsSync(f) && fs.statSync(f).size > 200) continue;
    const r = await fetch(`https://api.pixellab.ai/mcp/images/${id}/download?index=${i}`); const b = Buffer.from(await r.arrayBuffer());
    if (r.ok && b[1] === 0x50) fs.writeFileSync(f, b); else { console.log('not ready', anim, dir, i, r.status); break; } }
}
console.log('done');
