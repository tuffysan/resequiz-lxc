'use strict';
const fs=require('fs');
const {writeJsonAtomic}=require('../app/storage');
const [,,currentFile,legacyFile]=process.argv;
if(!currentFile||!legacyFile||!fs.existsSync(currentFile)||!fs.existsSync(legacyFile))process.exit(0);
const current=JSON.parse(fs.readFileSync(currentFile,'utf8'));
const legacy=JSON.parse(fs.readFileSync(legacyFile,'utf8'));
if(!Array.isArray(current)||!Array.isArray(legacy))process.exit(0);
const clean=v=>String(v??'').trim();
const byId=new Map(legacy.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
let changed=0;
for(const q of current){
  const old=byId.get(String(q.id));
  if(!old)continue;
  const visual=clean(old.visual??old.image??old.imageUrl??old.image_url);
  if(visual&&!q.visual){q.visual=visual;changed++}
  if(!q.subtype&&old.subtype)q.subtype=clean(old.subtype);
  if(!q.factKey&&old.factKey)q.factKey=clean(old.factKey);
  if(!q.family&&old.family)q.family=clean(old.family);
}
if(changed)writeJsonAtomic(currentFile,current);
console.log(`Question media metadata repaired: ${changed}`);
