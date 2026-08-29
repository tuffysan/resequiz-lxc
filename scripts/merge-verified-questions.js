#!/usr/bin/env node
'use strict';
const fs=require('fs');
const [,,target,pack]=process.argv;
if(!target||!pack){console.error('Usage: merge-verified-questions.js <questions.json> <verified-questions.json>');process.exit(2)}
const current=JSON.parse(fs.readFileSync(target,'utf8'));
const incoming=JSON.parse(fs.readFileSync(pack,'utf8'));
const ids=new Set(current.map(q=>String(q.id)));
const fingerprints=new Set(current.map(q=>`${String(q.category||'').trim().toLowerCase()}|${String(q.question||'').trim().toLowerCase()}`));
let added=0, skipped=0;
for(const q of incoming){
  const fp=`${String(q.category||'').trim().toLowerCase()}|${String(q.question||'').trim().toLowerCase()}`;
  if(ids.has(String(q.id))||fingerprints.has(fp)){skipped++;continue}
  current.push(q); ids.add(String(q.id)); fingerprints.add(fp); added++;
}
const tmp=target+'.tmp';fs.writeFileSync(tmp,JSON.stringify(current,null,2)+'\n');fs.renameSync(tmp,target);
console.log(`Verifierade frågor: ${added} tillagda, ${skipped} redan befintliga, totalt ${current.length}.`);
