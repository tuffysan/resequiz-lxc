const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'..'),server=fs.readFileSync(path.join(root,'server.js'),'utf8'),storage=fs.readFileSync(path.join(root,'storage.js'),'utf8'),online=fs.readFileSync(path.join(root,'public','online.js'),'utf8');
for(const x of ["APP_VERSION = '16.3.0'",'/api/admin/question-health','questionVerifications','actualDifficultyFor','autoQuarantineFromHealth','recordReceipt','hostBroadcast','scoreBreakdown'])assert(server.includes(x),x);
for(const x of ['player_seen_questions','player_seen_facts','answer_receipts','schemaVersion'])assert(storage.includes(x),x);
assert(online.includes('submissionId'), 'client idempotency key');
const q=JSON.parse(fs.readFileSync(path.join(root,'data','questions.json'),'utf8'));assert.equal(q.length,new Set(q.map(x=>x.id)).size);assert(q.every(x=>x.factKey&&x.family),'fact/family metadata');
const capitals=q.filter(x=>/^.+ är huvudstad i .+\.$/.test(x.f||''));const pairs=new Map();for(const x of capitals){const k=x.f;(pairs.get(k)||pairs.set(k,new Set()).get(k)).add(x.factKey)}assert([...pairs.values()].every(x=>x.size===1),'capital facts share factKey');
console.log(JSON.stringify({ok:true,version:'16.3.0',questions:q.length,capitalFacts:capitals.length,hardening:true}));
