const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const {spawn}=require('child_process');

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:true,credentials:true}});
const PORT=process.env.PORT||3000;
const PUBLIC=path.join(__dirname,'public');
const DATA_DIR=process.env.RESEQUIZ_DATA_DIR||'/var/lib/resequiz';
const HIGHSCORE_FILE=path.join(DATA_DIR,'highscores.json');
function ensureDataDir(){try{fs.mkdirSync(DATA_DIR,{recursive:true})}catch{}}
function readHistory(){ensureDataDir();try{const x=JSON.parse(fs.readFileSync(HIGHSCORE_FILE,'utf8'));return Array.isArray(x)?x:[]}catch{return []}}
function writeHistory(h){ensureDataDir();const tmp=HIGHSCORE_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(h,null,2));fs.renameSync(tmp,HIGHSCORE_FILE)}
function pct(n,d){return d?Math.round(n/d*100):0}
function hallOfFame(){
  const h=readHistory(), by={};
  for(const e of h){const k=(e.sessionId||e.name).toLowerCase();const a=by[k]||(by[k]={sessionId:e.sessionId,name:e.name,avatar:e.avatar||'😀',games:0,wins:0,totalScore:0,bestScore:0,correct:0,total:0,bestStreak:0,visualCorrect:0,visualTotal:0,uselessCorrect:0,uselessTotal:0,categories:{}});a.name=e.name;a.avatar=e.avatar||a.avatar;a.games++;a.wins+=e.win?1:0;a.totalScore+=e.score||0;a.bestScore=Math.max(a.bestScore,e.score||0);a.correct+=e.correct||0;a.total+=e.total||0;a.bestStreak=Math.max(a.bestStreak,e.bestStreak||0);a.visualCorrect+=e.visualCorrect||0;a.visualTotal+=e.visualTotal||0;a.uselessCorrect+=e.uselessCorrect||0;a.uselessTotal+=e.uselessTotal||0;for(const [c,v] of Object.entries(e.categories||{})){const z=a.categories[c]||(a.categories[c]={correct:0,total:0});z.correct+=v.correct||0;z.total+=v.total||0}}
  const all=Object.values(by).map(a=>({...a,accuracy:pct(a.correct,a.total),visualAccuracy:pct(a.visualCorrect,a.visualTotal),uselessAccuracy:pct(a.uselessCorrect,a.uselessTotal)}));
  const best=(arr,cmp)=>arr.slice().sort(cmp).slice(0,10);
  const categoryChampions={};for(const c of Object.keys(CATEGORY_COUNTS)){const eligible=all.filter(a=>(a.categories[c]?.total||0)>=3).map(a=>({...a,categoryCorrect:a.categories[c].correct,categoryTotal:a.categories[c].total,categoryAccuracy:pct(a.categories[c].correct,a.categories[c].total)}));if(eligible.length)categoryChampions[c]=best(eligible,(a,b)=>b.categoryAccuracy-a.categoryAccuracy||b.categoryCorrect-a.categoryCorrect)[0]}
  return {games:h.length?new Set(h.map(x=>x.gameId)).size:0,players:all.length,highestScores:best(all,(a,b)=>b.bestScore-a.bestScore),mostWins:best(all,(a,b)=>b.wins-a.wins||b.games-a.games),bestAccuracy:best(all.filter(a=>a.total>=10),(a,b)=>b.accuracy-a.accuracy||b.correct-a.correct),bestStreak:best(all,(a,b)=>b.bestStreak-a.bestStreak),visualMasters:best(all.filter(a=>a.visualTotal>=3),(a,b)=>b.visualAccuracy-a.visualAccuracy||b.visualCorrect-a.visualCorrect),uselessKings:best(all.filter(a=>a.uselessTotal>=3),(a,b)=>b.uselessAccuracy-a.uselessAccuracy||b.uselessCorrect-a.uselessCorrect),categoryChampions,lastGames:h.slice(-20).reverse()};
}
function persistGame(r){
 const h=readHistory(), gameId=`${Date.now()}-${r.code}`, top=Math.max(...r.players.map(p=>p.score));
 for(const p of r.players)h.push({gameId,at:new Date().toISOString(),sessionId:p.sessionId,name:p.name,avatar:p.avatar,score:p.score,win:p.score===top,correct:p.stats.correct,total:p.stats.total,bestStreak:p.stats.bestStreak,visualCorrect:p.stats.visualCorrect,visualTotal:p.stats.visualTotal,uselessCorrect:p.stats.uselessCorrect,uselessTotal:p.stats.uselessTotal,categories:p.stats.categories});
 writeHistory(h.slice(-5000));
}
function freshStats(){return {correct:0,total:0,streak:0,bestStreak:0,visualCorrect:0,visualTotal:0,uselessCorrect:0,uselessTotal:0,categories:{}}}

function loadQuestions(){
  return JSON.parse(fs.readFileSync(path.join(__dirname,'data','questions.json'),'utf8'));
}
const QUESTIONS=loadQuestions();
const CATEGORY_COUNTS=QUESTIONS.reduce((m,q)=>{m[q.c]=(m[q.c]||0)+1;return m},{});
const rooms=new Map();
const timers=new Map();
const clean=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,20);
const cleanId=s=>String(s||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
const AVATARS=['😀','😎','🤩','🥳','🤠','🦊','🐼','🐯','🦁','🐸','🦄','🤖','👻','🚀','⚽','🎸'];
const cleanAvatar=a=>AVATARS.includes(String(a||''))?String(a):'😀';
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const code=()=>String(Math.floor(1000+Math.random()*9000));
const token=()=>require('crypto').randomBytes(24).toString('hex');
function roomPublic(r){return {code:r.code,phase:r.phase,hostSessionId:r.hostSessionId,players:r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar||'😀',score:p.score,connected:p.connected,stats:p.stats})),currentQuestion:r.phase==='question'?r.currentPublic:null,meta:{questions:QUESTIONS.length,categories:CATEGORY_COUNTS}};}
function emitRoom(r){io.to(r.code).emit('roomState',roomPublic(r));}
function findPlayer(r,sid){return r.players.find(p=>p.sessionId===sid)}
function clearRoundTimer(r){const t=timers.get(r.code);if(t){clearTimeout(t);timers.delete(r.code)}}
function closeIfEmpty(r){if(r.players.length===0){clearRoundTimer(r);rooms.delete(r.code);return true}return false}
function makeRoom(name,sessionId){let c;do c=code();while(rooms.has(c));const r={code:c,hostToken:token(),hostSessionId:sessionId,phase:'lobby',players:[{sessionId,name,avatar:'😀',score:0,connected:true,socketId:null,stats:freshStats()}],deck:[],index:0,answers:new Map(),settings:{count:20,timer:15,difficulty:'mixed',categories:[]},seen:new Set(),current:null,currentPublic:null};rooms.set(c,r);return r}
function startRound(r){
  clearRoundTimer(r);
  if(r.index>=r.deck.length)return finishGame(r);
  r.answers=new Map(); r.phase='question';
  const q=r.deck[r.index]; const opts=shuffle(q.a.map((label,i)=>({label,correct:i===q.r})));
  r.current={...q,opts};
  r.currentPublic={id:q.id,number:r.index+1,total:r.deck.length,category:q.c,difficulty:q.d==='easy'?'Lätt':q.d==='hard'?'Svår':'Medel',timer:r.settings.timer,visual:q.visual||'',text:q.q,options:opts.map(o=>o.label)};
  emitRoom(r); io.to(r.code).emit('question',r.currentPublic);
  if(r.settings.timer>0){const t=setTimeout(()=>settleRound(r),r.settings.timer*1000+1200);timers.set(r.code,t)}
}
function settleRound(r){
  if(r.phase!=='question'||!r.current)return;
  clearRoundTimer(r); const q=r.current; const correctIndex=q.opts.findIndex(o=>o.correct); const results=[];
  for(const p of r.players){const ans=r.answers.get(p.sessionId);const ok=ans===correctIndex;let gain=0;const st=p.stats||(p.stats=freshStats());st.total++;const cs=st.categories[q.c]||(st.categories[q.c]={correct:0,total:0});cs.total++;if(q.visual)st.visualTotal++;if(q.c==='Onödigt vetande')st.uselessTotal++;if(ok){gain=q.d==='hard'?200:q.d==='medium'?150:100;p.score+=gain;st.correct++;cs.correct++;st.streak++;st.bestStreak=Math.max(st.bestStreak,st.streak);if(q.visual)st.visualCorrect++;if(q.c==='Onödigt vetande')st.uselessCorrect++}else st.streak=0;results.push({sessionId:p.sessionId,correct:ok,gain})}
  r.phase='result';
  io.to(r.code).emit('roundResult',{correctAnswer:q.opts[correctIndex].label,explanation:q.f,results,room:roomPublic(r),hostSessionId:r.hostSessionId});
}
function finishGame(r){clearRoundTimer(r);r.phase='finished';if(!r.persisted){persistGame(r);r.persisted=true}io.to(r.code).emit('gameOver',{room:roomPublic(r),hostSessionId:r.hostSessionId,hall:hallOfFame()})}

app.use(express.static(PUBLIC,{maxAge:'1h'}));
app.get('/health',(req,res)=>res.json({ok:true,version:'2.7.0',rooms:rooms.size,questions:QUESTIONS.length,categories:CATEGORY_COUNTS}));
app.get('/api/qr',(req,res)=>{const text=String(req.query.text||'').slice(0,500);if(!text)return res.status(400).send('text required');res.type('png');const q=spawn('qrencode',['-t','PNG','-o','-','-s','7','-m','2',text]);q.stdout.pipe(res);q.on('error',()=>res.status(500).end());q.on('close',c=>{if(c!==0&&!res.headersSent)res.status(500).end()})});
app.get('/api/questions/meta',(req,res)=>res.json({version:'2.7.0',questions:QUESTIONS.length,categories:CATEGORY_COUNTS,difficulties:['easy','medium','hard']}));
app.get('/api/highscores',(req,res)=>res.json(hallOfFame()));

io.on('connection',socket=>{
  socket.on('createRoom',(d,cb=()=>{})=>{const name=clean(d?.name),sid=cleanId(d?.sessionId),avatar=cleanAvatar(d?.avatar);if(!name||!sid)return cb({ok:false,error:'Namn saknas.'});const r=makeRoom(name,sid);r.players[0].avatar=avatar;r.players[0].socketId=socket.id;socket.join(r.code);cb({ok:true,code:r.code,hostToken:r.hostToken,room:roomPublic(r)});emitRoom(r)});
  socket.on('joinRoom',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));const name=clean(d?.name),sid=cleanId(d?.sessionId),avatar=cleanAvatar(d?.avatar);if(!r)return cb({ok:false,error:'Rummet finns inte.'});if(r.phase!=='lobby')return cb({ok:false,error:'Spelet har redan startat.'});if(r.players.length>=20)return cb({ok:false,error:'Rummet är fullt.'});let p=findPlayer(r,sid);if(!p){p={sessionId:sid,name,avatar,score:0,connected:true,socketId:socket.id,stats:freshStats()};r.players.push(p)}else{p.name=name;p.avatar=avatar;p.connected=true;p.socketId=socket.id}socket.join(r.code);cb({ok:true,room:roomPublic(r)});emitRoom(r)});
  socket.on('rejoin',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r)return cb({ok:false});const p=findPlayer(r,cleanId(d?.sessionId));if(!p)return cb({ok:false});p.connected=true;p.avatar=cleanAvatar(d?.avatar||p.avatar);p.socketId=socket.id;socket.join(r.code);cb({ok:true,room:roomPublic(r)});if(r.phase==='question'&&r.currentPublic)socket.emit('question',r.currentPublic);emitRoom(r)});
  socket.on('startGame',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d?.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden kan starta.'});if(r.players.length<2)return cb({ok:false,error:'Minst två spelare krävs.'});const s=d.settings||{};const availableCategories=Object.keys(CATEGORY_COUNTS);const requested=Array.isArray(s.categories)?s.categories.filter(c=>availableCategories.includes(c)):[];r.settings={count:Math.min(200,Math.max(5,+s.count||20)),timer:[0,10,15,20,30].includes(+s.timer)?+s.timer:15,difficulty:['easy','medium','hard','mixed'].includes(s.difficulty)?s.difficulty:'mixed',categories:requested};let pool=QUESTIONS;if(r.settings.categories.length)pool=pool.filter(q=>r.settings.categories.includes(q.c));if(r.settings.difficulty!=='mixed')pool=pool.filter(q=>q.d===r.settings.difficulty);if(pool.length<r.settings.count){pool=QUESTIONS.filter(q=>!r.settings.categories.length||r.settings.categories.includes(q.c));}const fresh=shuffle(pool.filter(q=>!r.seen.has(q.id))),oldSeen=shuffle(pool.filter(q=>r.seen.has(q.id)));r.deck=[...fresh,...oldSeen].slice(0,r.settings.count);r.deck.forEach(q=>r.seen.add(q.id));r.players.forEach(p=>{p.score=0;p.stats=freshStats()});r.persisted=false;r.index=0;cb({ok:true});startRound(r)});
  socket.on('submitAnswer',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||r.phase!=='question'||r.currentPublic?.id!==d?.questionId)return cb({ok:false,error:'Frågan är inte aktiv.'});const p=findPlayer(r,cleanId(d?.sessionId));if(!p)return cb({ok:false,error:'Spelaren saknas.'});if(r.answers.has(p.sessionId))return cb({ok:false,error:'Du har redan svarat.'});r.answers.set(p.sessionId,+d.answerIndex);cb({ok:true});io.to(r.code).emit('answerProgress',{answered:r.answers.size,total:r.players.length});if(r.answers.size>=r.players.filter(x=>x.connected).length)settleRound(r)});
  socket.on('nextQuestion',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d?.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden kan fortsätta.'});if(r.phase!=='result')return cb({ok:false,error:'Rundan är inte klar.'});r.index++;cb({ok:true});startRound(r)});
  socket.on('resetRoom',(d)=>{const r=rooms.get(String(d?.code||''));if(!r||d?.hostToken!==r.hostToken)return;r.phase='lobby';r.deck=[];r.index=0;r.current=null;r.currentPublic=null;r.answers=new Map();r.players.forEach(p=>{p.score=0;p.stats=freshStats()});r.persisted=false;emitRoom(r)});
  socket.on('leaveRoom',d=>{const r=rooms.get(String(d?.code||''));if(!r)return;const sid=cleanId(d?.sessionId);const wasHost=r.hostSessionId===sid;r.players=r.players.filter(p=>p.sessionId!==sid);socket.leave(r.code);if(closeIfEmpty(r))return;if(wasHost){const np=r.players[0];r.hostSessionId=np.sessionId;r.hostToken=token();io.to(np.socketId).emit('hostPromoted',{hostToken:r.hostToken})}emitRoom(r)});
  socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.players.find(x=>x.socketId===socket.id);if(p){p.connected=false;p.socketId=null;emitRoom(r);if(r.phase==='question'&&r.players.some(x=>x.connected)&&r.answers.size>=r.players.filter(x=>x.connected).length)settleRound(r)}}});
});

setInterval(()=>{for(const [c,r] of rooms){if(r.players.length&&!r.players.some(p=>p.connected)&&r.phase==='lobby'){clearRoundTimer(r);rooms.delete(c)}}},15*60*1000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Resequiz listening on :${PORT} with ${QUESTIONS.length} questions`));
