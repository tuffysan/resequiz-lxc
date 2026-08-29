const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const qs=JSON.parse(fs.readFileSync(path.join(root,'data','questions.json'),'utf8'));
const seed=JSON.parse(fs.readFileSync(path.join(root,'data','question-verification-seed.json'),'utf8'));
const report=JSON.parse(fs.readFileSync(path.join(root,'data','final-quarantine-review-14.5.json'),'utf8'));
assert.equal(report.version,'14.5.0'); assert.equal(report.activeQuestions,qs.length); assert.equal(Object.keys(seed).length,qs.length);
const verified=Object.values(seed).filter(x=>x.status==='verified').length; const review=Object.values(seed).filter(x=>x.status==='needs-review').length;
assert.equal(verified,qs.length); assert.equal(review,0); assert.equal(report.remainingQuarantine,0);
console.log(JSON.stringify({ok:true,version:'14.5.0',questions:qs.length,verified,needsReview:review,restored:report.activatedFromQuarantine,retiredThisPass:report.retiredThisPass,quarantine:report.remainingQuarantine}));
