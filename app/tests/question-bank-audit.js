const fs=require('fs'),path=require('path');
const qs=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','questions.json'),'utf8'));
const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').replace(/[^a-z0-9åäö ]/g,' ').replace(/\s+/g,' ').trim();
const ids=new Set(),texts=new Map(),issues=[];let visual=0,audio=0;
for(const q of qs){if(ids.has(q.id))issues.push({severity:'error',id:q.id,type:'duplicate-id'});ids.add(q.id);if(!q.q||!Array.isArray(q.a)||q.a.length<2||q.r<0||q.r>=q.a.length)issues.push({severity:'error',id:q.id,type:'invalid-structure'});if(new Set(q.a.map(norm)).size!==q.a.length)issues.push({severity:'error',id:q.id,type:'duplicate-options'});const t=[norm(q.q),q.visual||'',q.audio||'',JSON.stringify(q.specialData||null)].join('|');if(texts.has(t))issues.push({severity:'review',id:q.id,type:'duplicate-text',other:texts.get(t)});else texts.set(t,q.id);if(/\b1 timmar\b/i.test(q.q))issues.push({severity:'review',id:q.id,type:'grammar',message:'1 timmar'});if(q.visual)visual++;if(q.audio)audio++}
const templated=qs.filter(q=>/^(Snabbfråga|Kunskapskoll|Välj rätt svar|Quizfråga|Vetenskapskoll|Teknik och vetenskap):/i.test(q.q)).length;
const report={generatedAt:new Date().toISOString(),total:qs.length,uniqueIds:ids.size,visual,audio,templated,errors:issues.filter(x=>x.severity==='error').length,review:issues.filter(x=>x.severity==='review').length,issues:issues.slice(0,2000)};
fs.writeFileSync(path.join(__dirname,'..','data','question-quality-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,issues:undefined},null,2));if(report.errors)process.exit(1);
