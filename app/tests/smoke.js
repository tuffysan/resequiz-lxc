const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const q=JSON.parse(fs.readFileSync(path.join(root,'data','questions.json'),'utf8'));
function ok(v,m){if(!v){console.error('FAIL:',m);process.exit(1)}}
ok(q.length>=10000,'question bank');ok(new Set(q.map(x=>x.id)).size===q.length,'unique ids');
for(const x of q){ok(x.id&&x.q&&Array.isArray(x.a)&&x.a.length>=2,'question schema '+x.id);ok(Number.isInteger(x.r)&&x.r>=0&&x.r<x.a.length,'correct index '+x.id)}
const pub=path.join(root,'public');for(const f of ['index.html','online.html','display.html','admin.html','styles.css','online.js','display.js','sw.js','world-map.svg'])ok(fs.existsSync(path.join(pub,f)),f);
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');for(const marker of ['9.0.0','resequiz-night','journey-night','journey:true','soloMode:r.players.length===1','smartPick(','balanceTeams(','/api/admin/backup','/api/admin/restore','QUESTION_METRICS_FILE','QUESTION_RATINGS_FILE','/api/question-rating','/api/seasons','/api/diagnostics','directorLevel:2'])ok(server.includes(marker),marker);
const online=fs.readFileSync(path.join(pub,'online.js'),'utf8');for(const marker of ['shareCode','shareQr','Dela QR','resequiz-night','journey-night','På väg','Starta soloquiz','room.players.length===1'])ok(online.includes(marker),marker);
console.log(JSON.stringify({ok:true,questions:q.length,uniqueIds:new Set(q.map(x=>x.id)).size,version:'9.0.0'}));

// v7.2 balance-engine presence checks
const fs2=require('fs'), path2=require('path');
const serverSrc=fs2.readFileSync(path2.join(__dirname,'..','server.js'),'utf8');
const offlineSrc=fs2.readFileSync(path2.join(__dirname,'..','public','app.js'),'utf8');
if(!serverSrc.includes('const byCat=new Map()')) throw new Error('Server balance engine missing');
if(!offlineSrc.includes('function balancedPick(')) throw new Error('Offline balance engine missing');
console.log('Balance engine: OK');

// 7.4 Quiet Mode static guards
const onlineQuiet=fs.readFileSync(path.join(__dirname,'..','public','online.js'),'utf8');
const serverQuiet=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const offlineQuiet=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
if(!onlineQuiet.includes('audioQuestionsToggle')||!onlineQuiet.includes("resequiz-audio-questions")) throw new Error('Quiet Mode lobby control missing');
if(!serverQuiet.includes('audioQuestions:s.audioQuestions===true')||!serverQuiet.includes("allQuestions().filter(q=>s.audioQuestions===true||!q.audio)")) throw new Error('Server audio filtering missing');
if(!offlineQuiet.includes('audioQuestions:false')||!offlineQuiet.includes("if(!state.audioQuestions)pool=pool.filter(q=>!q.audio)")) throw new Error('Offline audio filtering missing');
console.log('Quiet Mode checks OK');

for(const marker of ['data-environment','mapRevealHtml','upcomingAssets','createLiveResultCard','question-rating'])if(!online.includes(marker))throw new Error('8.0 feature missing '+marker);console.log('Smart Game Night 8.0 checks OK');
for(const marker of ['questionDoctor()','ACTIVE_ROOMS_FILE','hostMigration','/api/admin/question-doctor','/api/quiz-dna','RESEQUIZ_ALLOW_WEB_UPDATE','restoreActiveRooms()'])if(!server.includes(marker))throw new Error('9.0 server feature missing '+marker);
for(const marker of ['offline – återansluter','hostMigration','RESEQUIZ 9.0'])if(!online.includes(marker))throw new Error('9.0 client feature missing '+marker);
console.log('Smart Quiz Engine 9.0 checks OK');
