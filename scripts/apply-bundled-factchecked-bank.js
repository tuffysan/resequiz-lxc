#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const currentPath=process.argv[2]||'/var/lib/resequiz/questions.json';
const reviewedGz=process.argv[3]||path.join(__dirname,'../app/data/questions-production-factchecked.json.gz');
const expected=30629;
const expectedQuarantined=113;
function fail(m){throw new Error(m)}
if(!fs.existsSync(currentPath))fail(`Aktiv frågebank saknas: ${currentPath}`);
if(!fs.existsSync(reviewedGz))fail(`Paketerad faktagranskad bank saknas: ${reviewedGz}`);
const current=JSON.parse(fs.readFileSync(currentPath,'utf8'));
const reviewed=JSON.parse(zlib.gunzipSync(fs.readFileSync(reviewedGz)).toString('utf8'));
if(!Array.isArray(current)||!Array.isArray(reviewed))fail('Frågebank måste vara en JSON-array.');
if(reviewed.length!==expected)fail(`Fel antal i faktagranskad bank: ${reviewed.length}, väntade ${expected}`);
const reviewedQuarantined=reviewed.filter(q=>q&&q.quarantined).length;
if(reviewedQuarantined!==expectedQuarantined)fail(`Fel antal karantänfrågor i faktagranskad bank: ${reviewedQuarantined}, väntade ${expectedQuarantined}`);
const valid=q=>q&&q.id&&q.question&&Array.isArray(q.answers)&&q.answers.length>=2&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<q.answers.length;
for(const q of reviewed)if(!valid(q))fail(`Ogiltig faktagranskad fråga: ${q?.id||'?'}`);
const ids=new Set();for(const q of reviewed){if(ids.has(q.id))fail(`Duplicerat id i faktagranskad bank: ${q.id}`);ids.add(q.id)}
const byId=new Map(reviewed.map(q=>[String(q.id),q]));
let replaced=0,extras=0;
const merged=current.map(q=>{
 const r=byId.get(String(q.id));
 if(!r){extras++;return q}
 replaced++;byId.delete(String(q.id));
 // Preserve unknown future/runtime fields, but reviewed factual content/status wins.
 return {...q,...r};
});
let added=0;for(const r of byId.values()){merged.push(r);added++}
const seen=new Set();for(const q of merged){if(!valid(q))fail(`Ogiltig fråga efter merge: ${q?.id||'?'}`);if(seen.has(String(q.id)))fail(`Duplicerat id efter merge: ${q.id}`);seen.add(String(q.id))}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=`${currentPath}.pre-factreview-24.1.2-${stamp}.bak`;
fs.copyFileSync(currentPath,backup);
const tmp=`${currentPath}.tmp-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
fs.writeFileSync(tmp,JSON.stringify(merged,null,2)+'\n');
fs.renameSync(tmp,currentPath);
const summary={ok:true,reviewedPackage:reviewed.length,currentBefore:current.length,totalAfter:merged.length,replaced,added,unreviewedExistingExtras:extras,quarantined:merged.filter(q=>q.quarantined).length,reviewed:merged.filter(q=>q.factReviewStatus).length,backup};
console.log(JSON.stringify(summary,null,2));
