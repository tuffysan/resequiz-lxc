const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const q=JSON.parse(fs.readFileSync(path.join(root,'data','questions.json'),'utf8'));
function ok(v,m){if(!v){console.error('FAIL:',m);process.exit(1)}}
ok(q.length>=4000,'question bank');ok(new Set(q.map(x=>x.id)).size===q.length,'unique ids');
for(const x of q){ok(x.id&&x.q&&Array.isArray(x.a)&&x.a.length>=2,'question schema '+x.id);ok(Number.isInteger(x.r)&&x.r>=0&&x.r<x.a.length,'correct index '+x.id)}
const pub=path.join(root,'public');for(const f of ['index.html','online.html','display.html','admin.html','styles.css','online.js','display.js','sw.js','world-map.svg'])ok(fs.existsSync(path.join(pub,f)),f);
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');for(const marker of ['6.0.0','smartPick(','balanceTeams(','/api/admin/backup','/api/admin/restore','QUESTION_METRICS_FILE'])ok(server.includes(marker),marker);
console.log(JSON.stringify({ok:true,questions:q.length,uniqueIds:new Set(q.map(x=>x.id)).size,version:'6.0.0'}));
