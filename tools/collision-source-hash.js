import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
export function collisionSourceHash(){const files=[];function walk(dir){for(const e of readdirSync(new URL(dir,root),{withFileTypes:true})){const p=dir+e.name;if(e.isDirectory())walk(p+'/');else if(e.name.endsWith('.js'))files.push(p);}}walk('src/world/');files.push('src/shared/foliage.js','src/data/hunting.js');const h=createHash('sha256');for(const p of files.sort()){h.update(p);h.update(readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n'));}return h.digest('hex');}
