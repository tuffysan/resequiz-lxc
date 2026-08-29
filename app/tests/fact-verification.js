const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..');
const qs=JSON.parse(fs.readFileSync(path.join(root,'data','questions.json'),'utf8'));
const seed=JSON.parse(fs.readFileSync(path.join(root,'data','question-verification-seed.json'),'utf8'));
assert.equal(Object.keys(seed).length,qs.length,'verification seed must cover the active question bank');
const verified=Object.values(seed).filter(x=>x.status==='verified').length;
const review=Object.values(seed).filter(x=>x.status==='needs-review').length;
assert.equal(verified,qs.length,'all active questions must be verified');
assert.equal(review,0,'no active question may be needs-review');
let expansion=null;
const candidates=['verified-new-facts-report-17.4.json','verified-new-facts-report-17.3.json','verified-new-facts-report-17.2.json','verified-new-facts-report-17.0.json','verified-new-facts-report-16.9.json','verified-new-facts-report-16.8.json'];
const expansionPath=candidates.map(f=>path.join(root,'data',f)).find(p=>fs.existsSync(p));
if(fs.existsSync(expansionPath)){
  expansion=JSON.parse(fs.readFileSync(expansionPath,'utf8'));
  assert.equal(expansion.totalQuestions ?? expansion.total,qs.length);
  assert.ok((expansion.addedNewFacts ?? expansion.addedVerifiedVariants ?? expansion.added)>0 || (expansion.addedVerifiedVariants ?? 0)>0);
  const excluded=expansion.excludedCategories ?? expansion.excluded ?? [];
  assert.ok(excluded.includes('Världen'));
  assert.ok(excluded.includes('Hjärngympa'));
}
console.log(JSON.stringify({ok:true,questions:qs.length,verified,needsReview:review,expansion:expansion?(expansion.addedNewFacts ?? expansion.added):0}));
