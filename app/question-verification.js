'use strict';
const crypto=require('crypto');

const clean=s=>String(s??'').trim();
const norm=s=>clean(s).toLocaleLowerCase('sv-SE').normalize('NFKC').replace(/\s+/g,' ');
function structuralIssues(q){
 const issues=[];
 if(!clean(q?.question))issues.push('empty-question');
 if(!Array.isArray(q?.answers)||q.answers.length<2)issues.push('too-few-answers');
 const answers=Array.isArray(q?.answers)?q.answers.map(clean):[];
 if(answers.some(x=>!x))issues.push('empty-answer');
 if(new Set(answers.map(norm)).size!==answers.length)issues.push('duplicate-answers');
 const c=Number(q?.correct);
 if(!Number.isInteger(c)||c<0||c>=answers.length)issues.push('invalid-correct-index');
 return issues;
}
function verificationStatus(q){
 if(q?.quarantined||q?.verificationStatus==='quarantined')return 'quarantined';
 const method=clean(q?.verificationMethod).toLowerCase(),level=clean(q?.verificationLevel).toLowerCase();
 if(q?.verified&&method.includes('deterministic'))return 'deterministic';
 if(q?.verified&&(level==='source-backed'||clean(q?.source)||clean(q?.sourceUrl)||clean(q?.source_url)))return 'source-verified';
 if(q?.verified)return 'legacy-verified';
 return 'needs-review';
}
function isPlayable(q){return verificationStatus(q)!=='quarantined'&&structuralIssues(q).length===0}
function arithmeticCheck(q){
 if(q?.category!=='Hjärngympa')return {applicable:false};
 const text=clean(q.question).replace(/[−–—]/g,'-').replace(/[×xX]/g,'*').replace(/[÷]/g,'/');
 const m=text.match(/(?:vad blir|räkna ut|beräkna|hur mycket är)\s*(-?\d+)\s*([+\-*/])\s*(-?\d+)/i);
 if(!m)return {applicable:false};
 const a=Number(m[1]),op=m[2],b=Number(m[3]);let expected;
 if(op==='+')expected=a+b;else if(op==='-')expected=a-b;else if(op==='*')expected=a*b;else if(op==='/'&&b!==0)expected=a/b;else return {applicable:false};
 const idx=Number(q.correct),actual=Array.isArray(q.answers)?Number(String(q.answers[idx]).replace(',','.')):NaN;
 return {applicable:true,valid:Number.isFinite(actual)&&Math.abs(actual-expected)<1e-9,expected,actual};
}
function auditBank(qs,{mutate=false,quarantineStructural=true}={}){
 const textGroups=new Map();
 for(const q of qs){const k=norm(q.question);if(k){const a=textGroups.get(k)||[];a.push(q.id);textGroups.set(k,a)}}
 const duplicateIds=new Set();for(const ids of textGroups.values())if(ids.length>1)ids.slice(1).forEach(id=>duplicateIds.add(id));
 const counts={total:qs.length,sourceVerified:0,deterministic:0,legacyVerified:0,needsReview:0,quarantined:0,structuralIssues:0,duplicateText:duplicateIds.size,changed:0};
 const rows=[],now=new Date().toISOString();
 for(const q of qs){
  const issues=structuralIssues(q),math=arithmeticCheck(q);
  if(mutate){
   const before=JSON.stringify([q.verified,q.verificationLevel,q.verificationMethod,q.verificationStatus,q.quarantined,q.verifiedAt]);
   if(math.applicable&&math.valid&&!q.verified){q.verified=true;q.verifiedAt=now;q.verificationLevel='deterministic';q.verificationMethod='Deterministic arithmetic';q.source='Calculated locally by Quiz verification engine'}
   if(issues.length&&quarantineStructural){q.quarantined=true;q.quarantineReason='Structural validation: '+issues.join(', ');q.quarantinedAt=q.quarantinedAt||now}
   q.verificationStatus=verificationStatus(q);
   if(JSON.stringify([q.verified,q.verificationLevel,q.verificationMethod,q.verificationStatus,q.quarantined,q.verifiedAt])!==before)counts.changed++;
  }
  const status=verificationStatus(q);
  if(status==='source-verified')counts.sourceVerified++;else if(status==='deterministic')counts.deterministic++;else if(status==='legacy-verified')counts.legacyVerified++;else if(status==='quarantined')counts.quarantined++;else counts.needsReview++;
  if(issues.length)counts.structuralIssues++;
  rows.push({id:q.id,category:q.category||'',difficulty:q.difficulty||'',question:q.question||'',status,verified:!!q.verified,verificationLevel:q.verificationLevel||'',verificationMethod:q.verificationMethod||'',source:q.sourceUrl||q.source_url||q.source||'',quarantined:status==='quarantined',issues,duplicateText:duplicateIds.has(q.id),factKey:q.factKey||''});
 }
 return {ok:true,generatedAt:now,counts,rows};
}
function backupName(){return `questions-verification-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(3).toString('hex')}.json`}
module.exports={structuralIssues,verificationStatus,isPlayable,arithmeticCheck,auditBank,backupName};
