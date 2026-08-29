const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const pkg=require(path.join(root,'package.json'));
const q=JSON.parse(fs.readFileSync(path.join(root,'data','questions.json'),'utf8'));
function assert(v,m){if(!v){console.error('FAIL',m);process.exit(1)}}
for(const x of [`APP_VERSION = '${pkg.version}'`,'/api/admin/question-health','questionVerifications','actualDifficultyFor','autoQuarantineFromHealth','recordReceipt','hostBroadcast','scoreBreakdown'])assert(server.includes(x),x);
const capitals=q.filter(x=>String(x.factKey||'').includes('capital'));
console.log(JSON.stringify({ok:true,version:pkg.version,questions:q.length,capitalFacts:capitals.length,hardening:true}));
