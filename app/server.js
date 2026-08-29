'use strict';
const express=require('express');
const http=require('http');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const QRCode=require('qrcode');
const {Server}=require('socket.io');
const {readJson,writeJsonAtomic,ensureDir}=require('./storage');
const {openQuizDb,indexResults}=require('./database');

const VERSION='21.1.0',PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||'0.0.0.0';
const DATA_DIR=process.env.RESEQUIZ_DATA_DIR||path.join(__dirname,'data');
const QUESTIONS_FILE=path.join(DATA_DIR,'questions.json'),RESULTS_FILE=path.join(DATA_DIR,'results.json'),SETTINGS_FILE=path.join(DATA_DIR,'settings.json'),USERS_FILE=path.join(DATA_DIR,'users.json'),REPORTS_FILE=path.join(DATA_DIR,'question-reports.json');
const CHILD_QUESTIONS_FILE=path.join(__dirname,'data','child-questions.json');
const ADMIN_AUTH_FILE=path.join(DATA_DIR,'admin-auth.json'),ADMIN_SETUP_KEY_FILE=path.join(DATA_DIR,'admin-setup-key');
const CHILD_TOPICS=['Blandat','Djur','Disney/barnfilm','Geografi','Fotboll','Natur','Matematik'];
ensureDir(DATA_DIR);
for(const [f,d] of [[QUESTIONS_FILE,[]],[RESULTS_FILE,[]],[USERS_FILE,[]],[REPORTS_FILE,[]],[SETTINGS_FILE,{title:'Quiz',defaultQuestionCount:10,defaultSeconds:30,allowGuestAdmin:false}]])if(!fs.existsSync(f))writeJsonAtomic(f,d);
if(!fs.existsSync(ADMIN_SETUP_KEY_FILE))fs.writeFileSync(ADMIN_SETUP_KEY_FILE,crypto.randomBytes(9).toString('base64url').toUpperCase()+'\n',{mode:0o600});
if(!fs.existsSync(ADMIN_AUTH_FILE))writeJsonAtomic(ADMIN_AUTH_FILE,{passwordHash:'',passwordSalt:'',updatedAt:null});

const app=express(),server=http.createServer(app),io=new Server(server,{serveClient:true});
app.disable('x-powered-by');app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(__dirname,'public'),{extensions:['html']}));
const quizDb=openQuizDb(DATA_DIR);
const questions=()=>readJson(QUESTIONS_FILE,[]),results=()=>readJson(RESULTS_FILE,[]),users=()=>readJson(USERS_FILE,[]),reports=()=>readJson(REPORTS_FILE,[]),settings=()=>readJson(SETTINGS_FILE,{}),childQuestions=()=>readJson(CHILD_QUESTIONS_FILE,[]);
const safe=s=>String(s??'').trim(),shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const normalizeAge=a=>Math.min(15,Math.max(4,Number(a)||8));
const normalizeTopic=t=>CHILD_TOPICS.includes(t)?t:'Blandat';
const questionsForAge=(age,topic='Blandat')=>{age=normalizeAge(age);topic=normalizeTopic(topic);let pool=childQuestions().filter(q=>age>=q.ageMin&&age<=q.ageMax);if(topic!=='Blandat')pool=pool.filter(q=>q.topic===topic);return pool};
const qVisual=q=>safe(q.visual??q.image??q.imageUrl??q.image_url);
const cleanQuestionText=value=>{
 let text=safe(value).trim();
 // Older question banks sometimes stored presentation copy as part of the question.
 // Strip only known leading wrappers; repeat so nested legacy wrappers are handled too.
 const wrappers=[
  /^vad\s+säger\s+dina\s+kunskaper\s*[–—:\-]\s*/i,
  /^känner\s+du\s+till\s+svaret\s*[:–—\-]\s*/i,
  /^kan\s+du\s+svaret\s*[:–—\-]\s*/i,
  /^kan\s+du\s+räkna\s+ut\s+eller\s+ange\s+detta\s*[:–—\-]\s*/i,
  /^vilket\s+alternativ\s+är\s+rätt\s*[:–—\-]\s*/i,
  /^bildutmaning\s*[:–—\-]\s*/i,
  /^kan\s+du\s+välja\s+rätt\s+alternativ\s*[:–—\-]\s*/i,
  /^quizfråga\s*[:–—\-]\s*/i,
  /^fråga\s*[:–—\-]\s*/i
 ];
 for(let pass=0;pass<4;pass++){
  const before=text;
  for(const re of wrappers) text=text.replace(re,'').trim();
  if(text===before) break;
 }
 if(text) text=text.charAt(0).toUpperCase()+text.slice(1);
 return text;
};
const publicQuestion=q=>({id:q.id,category:q.category,difficulty:q.difficulty,question:cleanQuestionText(q.question),answers:q.answers,visual:qVisual(q),subtype:safe(q.subtype??q.type)});
const offlineQuestion=q=>({...publicQuestion(q),correct:Number(q.correct),explanation:q.explanation||'',ageMin:q.ageMin??null,ageMax:q.ageMax??null,topic:q.topic||''});
const rooms=new Map();
const publicRoom=r=>({code:r.code,phase:r.phase,hostId:r.hostId,questionIndex:r.questionIndex,total:r.quiz.length,seconds:r.seconds,category:r.category||'',age:r.age||null,topic:r.topic||'',difficulty:r.difficulty||'mixed',format:r.format||'standard',players:[...r.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,answered:p.answered}))});

// Admin authentication: first setup requires the installation key, then password login.
const sessions=new Map(),SESSION_MS=12*60*60*1000;
const authCfg=()=>readJson(ADMIN_AUTH_FILE,{passwordHash:'',passwordSalt:''});
const hasAdminPassword=()=>!!authCfg().passwordHash;
const hashPassword=(password,salt)=>crypto.scryptSync(String(password),salt,64).toString('hex');
const tokenFromReq=req=>(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
const adminAllowed=req=>{const token=tokenFromReq(req),exp=sessions.get(token);if(!token||!exp)return false;if(exp<Date.now()){sessions.delete(token);return false}return true};
const requireAdmin=(req,res,next)=>adminAllowed(req)?next():res.status(401).json({ok:false,error:'Logga in som administratör.'});
app.get('/api/admin/auth/status',(req,res)=>res.json({ok:true,configured:hasAdminPassword(),authenticated:adminAllowed(req)}));
app.post('/api/admin/auth/setup',(req,res)=>{if(hasAdminPassword())return res.status(409).json({ok:false,error:'Administratörslösenord är redan skapat.'});const key=safe(req.body?.key),password=String(req.body?.password||'');const expected=safe(fs.readFileSync(ADMIN_SETUP_KEY_FILE,'utf8'));const kb=Buffer.from(key),eb=Buffer.from(expected);if(!key||kb.length!==eb.length||!crypto.timingSafeEqual(kb,eb))return res.status(403).json({ok:false,error:'Fel installationsnyckel.'});if(password.length<8)return res.status(400).json({ok:false,error:'Lösenordet måste vara minst 8 tecken.'});const salt=crypto.randomBytes(16).toString('hex');writeJsonAtomic(ADMIN_AUTH_FILE,{passwordSalt:salt,passwordHash:hashPassword(password,salt),updatedAt:new Date().toISOString()});res.json({ok:true})});
app.post('/api/admin/auth/login',(req,res)=>{const cfg=authCfg(),password=String(req.body?.password||'');if(!cfg.passwordHash)return res.status(409).json({ok:false,error:'Admin är inte konfigurerad ännu.'});const actual=hashPassword(password,cfg.passwordSalt);if(actual.length!==cfg.passwordHash.length||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(cfg.passwordHash)))return res.status(401).json({ok:false,error:'Fel lösenord.'});const token=crypto.randomBytes(32).toString('base64url');sessions.set(token,Date.now()+SESSION_MS);res.json({ok:true,token,expiresIn:SESSION_MS/1000})});
app.post('/api/admin/auth/logout',requireAdmin,(req,res)=>{sessions.delete(tokenFromReq(req));res.json({ok:true})});
app.post('/api/admin/auth/password',requireAdmin,(req,res)=>{const password=String(req.body?.password||'');if(password.length<8)return res.status(400).json({ok:false,error:'Lösenordet måste vara minst 8 tecken.'});const salt=crypto.randomBytes(16).toString('hex');writeJsonAtomic(ADMIN_AUTH_FILE,{passwordSalt:salt,passwordHash:hashPassword(password,salt),updatedAt:new Date().toISOString()});sessions.clear();res.json({ok:true})});


// Optional player accounts. Guests can always play without registering.
const userSessions=new Map(),USER_SESSION_MS=30*24*60*60*1000;
const normalizeUsername=v=>safe(v).toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,24);
const publicUser=u=>({id:u.id,username:u.username,displayName:u.displayName,createdAt:u.createdAt});
const userFromReq=req=>{const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();const s=userSessions.get(token);if(!s)return null;if(s.expiresAt<Date.now()){userSessions.delete(token);return null}return users().find(u=>u.id===s.userId)||null};
function playerProgress(userId){
 const rs=results().filter(r=>r.userId===userId),games=rs.length,totalCorrect=rs.reduce((a,r)=>a+(Number(r.score)||0),0),xp=rs.reduce((a,r)=>a+Math.max(20,Math.round(resultPct(r)*2))+(resultPct(r)===100?100:0)+(r.difficulty==='hard'?50:0),0);
 const level=Math.max(1,Math.floor(Math.sqrt(xp/250))+1),levelStart=(level-1)*(level-1)*250,next=level*level*250;
 const byCategory={};for(const r of rs){const c=r.category||'Blandat',x=byCategory[c]||{games:0,sum:0,best:0};const v=resultPct(r);x.games++;x.sum+=v;x.best=Math.max(x.best,v);byCategory[c]=x}
 const categories=Object.entries(byCategory).map(([name,x])=>({name,games:x.games,average:Math.round(x.sum/x.games),best:x.best})).sort((a,b)=>b.average-a.average||b.games-a.games);
 let streak=0;const days=[...new Set(rs.map(r=>String(r.at||'').slice(0,10)))].sort().reverse();if(days.length){let d=new Date();for(const day of days){const want=d.toISOString().slice(0,10);if(day===want){streak++;d.setDate(d.getDate()-1)}else if(streak===0){d.setDate(d.getDate()-1);if(day===d.toISOString().slice(0,10)){streak++;d.setDate(d.getDate()-1)}else break}else break}}
 return {games,xp,level,levelProgress:Math.max(0,xp-levelStart),levelNeed:Math.max(1,next-levelStart),streak,totalCorrect,categories};
}
const BADGE_DEFS=[
 ['first-game','🎮','Första steget','Slutför 1 quiz',p=>p.games>=1,p=>Math.min(p.games,1),1],['five-games','⭐','Quizkompis','Spela 5 quiz',p=>p.games>=5,p=>Math.min(p.games,5),5],['ten-games','🏅','Quizvana','Spela 10 quiz',p=>p.games>=10,p=>Math.min(p.games,10),10],['twentyfive-games','🏆','Quizmästare','Spela 25 quiz',p=>p.games>=25,p=>Math.min(p.games,25),25],['fifty-games','👑','Veteran','Spela 50 quiz',p=>p.games>=50,p=>Math.min(p.games,50),50],['explorer','🧭','Utforskare','Spela 5 kategorier',p=>p.categories.length>=5,p=>Math.min(p.categories.length,5),5],['allrounder','🌟','Allround','Spela 10 kategorier',p=>p.categories.length>=10,p=>Math.min(p.categories.length,10),10],['level5','🚀','På väg upp','Nå nivå 5',p=>p.level>=5,p=>Math.min(p.level,5),5],['level10','💎','Quizproffs','Nå nivå 10',p=>p.level>=10,p=>Math.min(p.level,10),10],['streak3','🔥','På gång','3 dagars streak',p=>p.streak>=3,p=>Math.min(p.streak,3),3],['streak7','⚡','Ostoppbar','7 dagars streak',p=>p.streak>=7,p=>Math.min(p.streak,7),7]
];
function playerBadges(userId){const rs=results().filter(r=>r.userId===userId),p=playerProgress(userId);if(!rs.length)return [];const out=BADGE_DEFS.filter(x=>x[4](p)).map(x=>({id:x[0],icon:x[1],name:x[2],detail:x[3]}));if(Math.max(...rs.map(resultPct))===100)out.push({id:'perfect',icon:'💯',name:'Perfektion',detail:'100 % i ett quiz'});if(rs.some(r=>r.difficulty==='hard'&&resultPct(r)>=80))out.push({id:'hard-80',icon:'🧠',name:'Svårslagen',detail:'Minst 80 % på svår nivå'});for(const c of p.categories.filter(x=>x.games>=5&&x.average>=80).slice(0,6))out.push({id:'master-'+c.name,icon:'🎓',name:c.name+'-expert',detail:'Minst 80 % i '+c.name+' över 5 spel'});return out}
function badgeProgress(userId){const p=playerProgress(userId),owned=new Set(playerBadges(userId).map(x=>x.id));return BADGE_DEFS.filter(x=>!owned.has(x[0])).map(x=>({id:x[0],icon:x[1],name:x[2],detail:x[3],value:x[5](p),target:x[6],percent:Math.min(100,Math.round(x[5](p)/x[6]*100))})).sort((a,b)=>b.percent-a.percent).slice(0,4)}
app.post('/api/users/register',(req,res)=>{const username=normalizeUsername(req.body?.username),displayName=safe(req.body?.displayName||req.body?.username).slice(0,30),password=String(req.body?.password||'');if(username.length<3)return res.status(400).json({ok:false,error:'Användarnamnet måste vara minst 3 tecken.'});if(password.length<8)return res.status(400).json({ok:false,error:'Lösenordet måste vara minst 8 tecken.'});const all=users();if(all.some(u=>u.username===username))return res.status(409).json({ok:false,error:'Användarnamnet finns redan.'});const salt=crypto.randomBytes(16).toString('hex'),u={id:crypto.randomUUID(),username,displayName:displayName||username,passwordSalt:salt,passwordHash:hashPassword(password,salt),createdAt:new Date().toISOString()};all.push(u);writeJsonAtomic(USERS_FILE,all);const token=crypto.randomBytes(32).toString('base64url');userSessions.set(token,{userId:u.id,expiresAt:Date.now()+USER_SESSION_MS});res.status(201).json({ok:true,token,user:publicUser(u),badges:[]})});
app.post('/api/users/login',(req,res)=>{const username=normalizeUsername(req.body?.username),password=String(req.body?.password||''),u=users().find(x=>x.username===username);if(!u)return res.status(401).json({ok:false,error:'Fel användarnamn eller lösenord.'});const actual=hashPassword(password,u.passwordSalt);if(actual.length!==u.passwordHash.length||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(u.passwordHash)))return res.status(401).json({ok:false,error:'Fel användarnamn eller lösenord.'});const token=crypto.randomBytes(32).toString('base64url');userSessions.set(token,{userId:u.id,expiresAt:Date.now()+USER_SESSION_MS});res.json({ok:true,token,user:publicUser(u),badges:playerBadges(u.id)})});
app.post('/api/users/logout',(req,res)=>{const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();if(token)userSessions.delete(token);res.json({ok:true})});
app.get('/api/users/me',(req,res)=>{const u=userFromReq(req);if(!u)return res.status(401).json({ok:false,error:'Inte inloggad.'});const rs=results().filter(r=>r.userId===u.id),best=rs.length?Math.max(...rs.map(resultPct)):0,average=rs.length?Math.round(rs.reduce((a,r)=>a+resultPct(r),0)/rs.length):0;res.json({ok:true,user:publicUser(u),stats:{games:rs.length,best,average,categories:new Set(rs.map(r=>r.category).filter(Boolean)).size},progress:playerProgress(u.id),badges:playerBadges(u.id),nextBadges:badgeProgress(u.id),recent:rs.slice(-10).reverse()})});

const resultPct=r=>r.total?Math.round((Number(r.score)||0)/(Number(r.total)||1)*100):0;
function awardsForResult(candidate,history){
 const pct=resultPct(candidate),name=safe(candidate.name).toLocaleLowerCase('sv-SE'),cat=safe(candidate.category)||'Blandat';
 const priorPlayer=history.filter(r=>safe(r.name).toLocaleLowerCase('sv-SE')===name);
 const priorGlobal=history.length?Math.max(...history.map(resultPct)):-1;
 const priorCategory=history.filter(r=>(safe(r.category)||'Blandat')===cat);
 const awards=[];
 if(pct===100)awards.push({type:'perfect',icon:'💯',label:'Perfekt resultat'});
 if(!priorPlayer.length||pct>Math.max(...priorPlayer.map(resultPct)))awards.push({type:'personal_best',icon:'🥇',label:'Nytt personbästa',detail:`${pct}%`});
 if(pct>priorGlobal)awards.push({type:'global_record',icon:'👑',label:'Nytt Quiz-rekord',detail:`${pct}%`});
 if(candidate.category&&(!priorCategory.length||pct>Math.max(...priorCategory.map(resultPct))))awards.push({type:'category_record',icon:'🏆',label:'Nytt kategorirekord',detail:`${cat} · ${pct}%`});
 return awards;
}
function saveResult(candidate){const all=results();candidate.awards=awardsForResult(candidate,all);all.push(candidate);const kept=all.slice(-10000);writeJsonAtomic(RESULTS_FILE,kept);indexResults(quizDb,[candidate]);return candidate}
indexResults(quizDb,results());

// Quiz 21: daily quiz, question learning metrics, reports and filtered leaderboards.
const dayKey=()=>new Date().toISOString().slice(0,10);
const seededNumber=text=>{const h=crypto.createHash('sha256').update(String(text)).digest();return h.readUInt32BE(0)/0xffffffff};
function dailyQuestions(date=dayKey(),count=10){
 const pool=questions().filter(q=>q.verified||q.verification||q.source||q.sourceUrl||q.source_url);
 const source=pool.length>=count?pool:questions();
 return [...source].map(q=>({q,k:seededNumber(date+'|'+q.id)})).sort((a,b)=>a.k-b.k).slice(0,count).map(x=>x.q);
}
function recordQuestionMetric(questionId,correct){
 if(!quizDb||!questionId)return;
 try{quizDb.prepare(`INSERT INTO question_metrics(question_id,times_shown,times_correct,last_seen) VALUES(?,?,?,?) ON CONFLICT(question_id) DO UPDATE SET times_shown=times_shown+1,times_correct=times_correct+excluded.times_correct,last_seen=excluded.last_seen`).run(String(questionId),1,correct?1:0,new Date().toISOString())}catch{}
}
app.get('/api/daily',(req,res)=>{const date=dayKey(),qs=dailyQuestions(date,10);res.json({ok:true,date,count:qs.length,questions:qs.map(publicQuestion)})});
app.get('/api/daily/status',(req,res)=>{const date=dayKey(),u=userFromReq(req),rs=results().filter(r=>r.mode==='daily'&&String(r.at||'').slice(0,10)===date);const mine=u?rs.find(r=>r.userId===u.id):null;const leaders=[...rs].sort((a,b)=>resultPct(b)-resultPct(a)||new Date(a.at)-new Date(b.at)).slice(0,10).map(r=>({name:r.name,score:r.score,total:r.total,pct:resultPct(r),at:r.at}));res.json({ok:true,date,played:!!mine,result:mine||null,players:rs.length,leaders})});
app.post('/api/question-report',(req,res)=>{const b=req.body||{},qid=safe(b.questionId),reason=safe(b.reason).slice(0,120),comment=safe(b.comment).slice(0,500);if(!qid||![...questions(),...childQuestions()].some(q=>q.id===qid))return res.status(404).json({ok:false,error:'Frågan finns inte.'});const all=reports();const u=userFromReq(req);all.push({id:crypto.randomUUID(),questionId:qid,reason:reason||'other',comment,userId:u?.id||null,status:'open',createdAt:new Date().toISOString()});writeJsonAtomic(REPORTS_FILE,all.slice(-5000));if(quizDb)try{quizDb.prepare('INSERT INTO question_metrics(question_id,reported) VALUES(?,1) ON CONFLICT(question_id) DO UPDATE SET reported=reported+1').run(qid)}catch{}res.status(201).json({ok:true})});
app.get('/api/offline/status',(req,res)=>res.json({ok:true,version:VERSION,available:Math.min(600,questions().length)+childQuestions().length,regular:Math.min(600,questions().length),children:childQuestions().length,generatedAt:new Date().toISOString()}));
app.get('/health',(req,res)=>res.json({ok:true,version:VERSION,rooms:rooms.size,questions:questions().length,status:'healthy'}));
app.get('/api/meta',(req,res)=>{const qs=questions();const categories=[...new Set(qs.map(q=>q.category))].sort();if(!categories.includes('Barnquiz'))categories.unshift('Barnquiz');res.json({version:VERSION,categories,questionCount:qs.length,childQuestionCount:childQuestions().length,childAgeRange:{min:4,max:15},childTopics:CHILD_TOPICS,settings:settings()})});
app.get('/api/offline-pack',(req,res)=>{const count=Math.min(3000,Math.max(100,Number(req.query.count)||500)),cats=safe(req.query.categories).split(',').map(x=>x.trim()).filter(Boolean),includeKids=req.query.kids!=='0';let pool=questions();if(cats.length)pool=pool.filter(q=>cats.includes(q.category));res.json({version:VERSION,generatedAt:new Date().toISOString(),selectedCategories:cats,questions:shuffle(pool).slice(0,count).map(offlineQuestion),childQuestions:includeKids?childQuestions().map(offlineQuestion):[]})});
app.get('/api/questions',(req,res)=>{let qs=questions();if(req.query.category)qs=qs.filter(q=>q.category===req.query.category);res.json(qs.map(publicQuestion))});
app.post('/api/solo/start',(req,res)=>{const b=req.body||{},count=Math.min(40,Math.max(3,Number(b.count)||10)),u=userFromReq(req);let qs=b.category==='Barnquiz'?questionsForAge(b.age,b.topic):questions();if(b.category&&b.category!=='Barnquiz')qs=qs.filter(q=>q.category===b.category);if(['easy','medium','hard'].includes(b.difficulty))qs=qs.filter(q=>q.difficulty===b.difficulty);if(u&&b.adaptive!==false){const recentIds=new Set(results().filter(r=>r.userId===u.id).slice(-20).flatMap(r=>r.questionIds||[]));qs=[...qs.filter(q=>!recentIds.has(q.id)),...qs.filter(q=>recentIds.has(q.id))]}res.json({ok:true,category:b.category||'',age:b.category==='Barnquiz'?normalizeAge(b.age):null,topic:b.category==='Barnquiz'?normalizeTopic(b.topic):null,adaptive:!!u,questions:shuffle(qs.slice(0,Math.max(count*8,count))).slice(0,count).map(publicQuestion)})});
app.post('/api/solo/check',(req,res)=>{const q=[...questions(),...childQuestions()].find(x=>x.id===req.body?.questionId);if(!q)return res.status(404).json({ok:false,error:'Frågan finns inte'});const answerIndex=Number(req.body?.answerIndex),isCorrect=answerIndex===Number(q.correct);recordQuestionMetric(q.id,isCorrect);res.json({ok:true,correct:isCorrect,correctIndex:Number(q.correct),explanation:q.explanation||''})});
app.get('/api/results',(req,res)=>res.json(results().slice(-100).reverse()));
app.post('/api/results',(req,res)=>{const b=req.body||{},u=userFromReq(req),r=saveResult({id:crypto.randomUUID(),userId:u?.id||null,name:u?.displayName||safe(b.name)||'Gäst',score:Number(b.score)||0,total:Math.max(1,Number(b.total)||1),mode:safe(b.mode)||'solo',category:safe(b.category),topic:safe(b.topic),age:b.age?normalizeAge(b.age):null,difficulty:safe(b.difficulty)||'mixed',format:safe(b.format)||'standard',questionIds:Array.isArray(b.questionIds)?b.questionIds.map(safe).slice(0,40):[],at:new Date().toISOString()});res.status(201).json({ok:true,result:r,awards:r.awards,badges:u?playerBadges(u.id):[]})});
app.get('/api/stats',(req,res)=>{const rs=results(),played=rs.length,avg=played?rs.reduce((a,r)=>a+(r.score/r.total),0)/played:0,best=played?Math.max(...rs.map(r=>r.score/r.total)):0;res.json({played,average:Math.round(avg*100),best:Math.round(best*100),questions:questions().length})});
app.get('/api/highscores',(req,res)=>{let rs=results();const range=safe(req.query.range)||'all',category=safe(req.query.category),difficulty=safe(req.query.difficulty),format=safe(req.query.format);if(range!=='all'){const days=range==='today'?1:range==='week'?7:range==='month'?30:0;if(days){const cutoff=Date.now()-days*86400000;rs=rs.filter(r=>new Date(r.at).getTime()>=cutoff)}}if(category)rs=rs.filter(r=>r.category===category);if(difficulty)rs=rs.filter(r=>r.difficulty===difficulty);if(format)rs=rs.filter(r=>r.format===format);const players=new Map();for(const r of rs){const key=safe(r.name).toLocaleLowerCase('sv-SE')||'gäst',p=players.get(key)||{name:r.name||'Gäst',games:0,best:0,averageSum:0};const v=resultPct(r);p.games++;p.best=Math.max(p.best,v);p.averageSum+=v;players.set(key,p)}const leaders=[...players.values()].map(p=>({name:p.name,games:p.games,best:p.best,average:Math.round(p.averageSum/p.games)})).sort((a,b)=>b.best-a.best||b.average-a.average||b.games-a.games);const bestRow=rs.length?[...rs].sort((a,b)=>resultPct(b)-resultPct(a)||new Date(a.at)-new Date(b.at))[0]:null;const mostGames=leaders.length?[...leaders].sort((a,b)=>b.games-a.games||b.best-a.best)[0]:null;res.json({ok:true,leaders,filters:{range,category,difficulty,format},records:{globalBest:bestRow?{name:bestRow.name,value:resultPct(bestRow),at:bestRow.at}:null,mostGames:mostGames?{name:mostGames.name,games:mostGames.games}:null}})});

app.get('/api/admin/stats',requireAdmin,(req,res)=>{const rs=results(),qs=questions(),kids=childQuestions();const pct=r=>r.total?Math.round((Number(r.score)||0)/(Number(r.total)||1)*100):0;const players=new Map();for(const r of rs){const key=(r.name||'Gäst').trim().toLocaleLowerCase('sv-SE'),p=players.get(key)||{name:r.name||'Gäst',games:0,sum:0,best:0};const v=pct(r);p.games++;p.sum+=v;p.best=Math.max(p.best,v);players.set(key,p)}const top=[...players.values()].map(p=>({...p,average:Math.round(p.sum/p.games)})).sort((a,b)=>b.games-a.games||b.average-a.average).slice(0,10);const days={};for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days[d.toISOString().slice(0,10)]=0}for(const r of rs){const d=String(r.at||'').slice(0,10);if(d in days)days[d]++}const modes={solo:0,multiplayer:0,other:0};for(const r of rs){if(r.mode==='solo')modes.solo++;else if(r.mode==='multiplayer')modes.multiplayer++;else modes.other++}const cats={};for(const r of rs){const c=r.category||'Blandat';cats[c]=(cats[c]||0)+1}const imageQuestions=qs.filter(q=>qVisual(q)).length;res.json({ok:true,version:VERSION,totals:{games:rs.length,players:players.size,questions:qs.length,childQuestions:kids.length,imageQuestions,average:rs.length?Math.round(rs.reduce((a,r)=>a+pct(r),0)/rs.length):0,best:rs.length?Math.max(...rs.map(pct)):0},modes,days:Object.entries(days).map(([date,games])=>({date,games})),categories:Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,games])=>({name,games})),topPlayers:top,recent:rs.slice(-12).reverse()})});
function questionQuality(){const qs=questions(),issues=[],seen=new Map();for(const q of qs){const text=cleanQuestionText(q.question).toLocaleLowerCase('sv-SE').replace(/[^a-z0-9åäö ]/g,'').replace(/\s+/g,' ').trim();const reasons=[];if(!q.question||!Array.isArray(q.answers)||q.answers.length<2)reasons.push('ofullständig');if(new Set((q.answers||[]).map(x=>safe(x).toLocaleLowerCase('sv-SE'))).size!==(q.answers||[]).length)reasons.push('dubbla svar');if(Number(q.correct)<0||Number(q.correct)>=(q.answers||[]).length)reasons.push('ogiltigt rätt svar');if(qVisual(q)){const v=qVisual(q);if(!/^https?:/i.test(v)&&!fs.existsSync(path.join(__dirname,'public',v.replace(/^\//,''))))reasons.push('trasig bild')}if(!q.source&&!q.verified&&!q.verification)reasons.push('saknar verifieringsmetadata');if(text){if(seen.has(text))reasons.push('möjlig dubblett');else seen.set(text,q.id)}if(reasons.length)issues.push({id:q.id,question:q.question,category:q.category,reasons})}const score=qs.length?Math.max(0,Math.round(100-(issues.length/qs.length*100))):100;return {score,total:qs.length,ok:qs.length-issues.length,review:issues.length,issues:issues.slice(0,500)}}
app.get('/api/admin/quality',requireAdmin,(req,res)=>res.json({ok:true,...questionQuality()}));
app.get('/api/admin/reports',requireAdmin,(req,res)=>{const qs=new Map([...questions(),...childQuestions()].map(q=>[q.id,q]));res.json(reports().slice().reverse().map(r=>({...r,question:qs.get(r.questionId)?.question||'Borttagen fråga',category:qs.get(r.questionId)?.category||''}))) });
app.post('/api/admin/reports/:id/resolve',requireAdmin,(req,res)=>{const all=reports(),r=all.find(x=>x.id===req.params.id);if(!r)return res.sendStatus(404);r.status=safe(req.body?.status)||'resolved';r.resolvedAt=new Date().toISOString();writeJsonAtomic(REPORTS_FILE,all);res.json({ok:true})});
app.get('/api/admin/question-metrics',requireAdmin,(req,res)=>{if(!quizDb)return res.json({ok:true,rows:[]});try{const rows=quizDb.prepare('SELECT question_id,times_shown,times_correct,reported,last_seen FROM question_metrics ORDER BY reported DESC,times_shown DESC LIMIT 500').all().map(x=>({...x,correctRate:x.times_shown?Math.round(x.times_correct/x.times_shown*100):null}));res.json({ok:true,rows})}catch{res.json({ok:true,rows:[]})}});
app.get('/api/admin/questions',requireAdmin,(req,res)=>res.json(questions()));
app.post('/api/admin/questions',requireAdmin,(req,res)=>{const b=req.body||{};if(!b.question||!Array.isArray(b.answers)||b.answers.length<2||!Number.isInteger(Number(b.correct)))return res.status(400).json({ok:false,error:'Ogiltig fråga'});const qs=questions(),item={id:b.id||crypto.randomUUID(),category:safe(b.category)||'Övrigt',difficulty:['easy','medium','hard'].includes(b.difficulty)?b.difficulty:'medium',question:safe(b.question).slice(0,300),answers:b.answers.map(x=>safe(x).slice(0,160)).slice(0,6),correct:Number(b.correct),explanation:safe(b.explanation).slice(0,500),visual:safe(b.visual),subtype:safe(b.subtype)};const idx=qs.findIndex(q=>q.id===item.id);if(idx>=0)qs[idx]=item;else qs.push(item);writeJsonAtomic(QUESTIONS_FILE,qs);res.status(idx>=0?200:201).json({ok:true,question:item})});
app.delete('/api/admin/questions/:id',requireAdmin,(req,res)=>{const qs=questions(),next=qs.filter(q=>q.id!==req.params.id);if(next.length===qs.length)return res.sendStatus(404);writeJsonAtomic(QUESTIONS_FILE,next);res.json({ok:true})});

// Quiz 21.1: local, privacy-friendly QR code for room invitations.
app.get('/api/rooms/:code/qr.svg',async(req,res)=>{const code=safe(req.params.code);if(!/^\d{4}$/.test(code)||!rooms.has(code))return res.status(404).send('Room not found');try{const proto=safe(req.headers['x-forwarded-proto']).split(',')[0]||req.protocol||'https',host=safe(req.headers['x-forwarded-host']).split(',')[0]||req.get('host');const url=`${proto}://${host}/online.html?room=${code}`;const svg=await QRCode.toString(url,{type:'svg',errorCorrectionLevel:'M',margin:1,width:640});res.set({'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store'}).send(svg)}catch(e){res.status(500).send('QR generation failed')}});

io.on('connection',socket=>{
 socket.on('room:create',(payload={},ack=()=>{})=>{try{const code=String(Math.floor(1000+Math.random()*9000)),host={id:socket.id,name:safe(payload.name)||'Värd',avatar:'🙂',score:0,answered:false};const count=Math.min(40,Math.max(3,Number(payload.count)||10)),difficulty=['easy','medium','hard'].includes(payload.difficulty)?payload.difficulty:'mixed';let qs=payload.category==='Barnquiz'?questionsForAge(payload.age,payload.topic):questions();if(payload.category&&payload.category!=='Barnquiz')qs=qs.filter(q=>q.category===payload.category);if(difficulty!=='mixed')qs=qs.filter(q=>q.difficulty===difficulty);const r={code,hostId:socket.id,phase:'lobby',questionIndex:-1,seconds:Math.min(90,Math.max(10,Number(payload.seconds)||30)),category:safe(payload.category),age:payload.category==='Barnquiz'?normalizeAge(payload.age):null,topic:payload.category==='Barnquiz'?normalizeTopic(payload.topic):'',difficulty,format:safe(payload.format)||'standard',quiz:shuffle(qs).slice(0,count),players:new Map([[socket.id,host]]),answers:new Map(),timer:null,deadline:null};rooms.set(code,r);socket.join(code);ack({ok:true,room:publicRoom(r)});io.to(code).emit('room:update',publicRoom(r))}catch(e){ack({ok:false,error:e.message})}});
 socket.on('room:join',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});const p={id:socket.id,name:safe(payload.name)||'Gäst',avatar:'🙂',score:0,answered:false};r.players.set(socket.id,p);socket.join(r.code);ack({ok:true,room:publicRoom(r)});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:display',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});socket.join(r.code);ack({ok:true,room:publicRoom(r)});if(r.phase==='question'&&r.questionIndex>=0){const q=r.quiz[r.questionIndex];socket.emit('room:question',{room:publicRoom(r),question:publicQuestion(q),deadline:r.deadline})}});
 socket.on('room:start',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan starta'});ack({ok:true});nextQuestion(r)});
 socket.on('room:answer',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||'')),p=r?.players.get(socket.id);if(!r||!p||r.phase!=='question')return ack({ok:false,error:'Ingen aktiv fråga'});if(p.answered)return ack({ok:false,error:'Redan svarat'});const q=r.quiz[r.questionIndex],answer=Number(payload.answerIndex),correct=answer===q.correct;p.answered=true;const remaining=Math.max(0,(r.deadline-Date.now())/1000);if(correct)p.score+=100+Math.round(remaining*5);r.answers.set(socket.id,{answer,correct});ack({ok:true});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:next',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan fortsätta'});ack({ok:true});nextQuestion(r)});
 socket.on('disconnect',()=>{for(const [code,r] of rooms){if(!r.players.has(socket.id))continue;r.players.delete(socket.id);if(!r.players.size){clearTimeout(r.timer);rooms.delete(code);continue}if(r.hostId===socket.id)r.hostId=[...r.players.keys()][0];io.to(code).emit('room:update',publicRoom(r))}});
});
function nextQuestion(r){clearTimeout(r.timer);r.questionIndex++;if(r.questionIndex>=r.quiz.length){r.phase='finished';const awards={};for(const p of r.players.values()){const saved=saveResult({id:crypto.randomUUID(),name:p.name,score:p.score,total:r.quiz.length*250,mode:'multiplayer',category:r.category,topic:r.topic,age:r.age,difficulty:r.difficulty,format:r.format,at:new Date().toISOString()});awards[p.id]=saved.awards||[]}io.to(r.code).emit('room:finished',{room:publicRoom(r),awards});return}r.phase='question';r.answers.clear();for(const p of r.players.values())p.answered=false;r.deadline=Date.now()+r.seconds*1000;const q=r.quiz[r.questionIndex];io.to(r.code).emit('room:question',{room:publicRoom(r),question:publicQuestion(q),deadline:r.deadline});r.timer=setTimeout(()=>reveal(r),r.seconds*1000)}
function reveal(r){if(r.phase!=='question')return;clearTimeout(r.timer);r.phase='reveal';const q=r.quiz[r.questionIndex];io.to(r.code).emit('room:reveal',{room:publicRoom(r),correctIndex:q.correct,explanation:q.explanation||'',answers:[...r.answers.entries()]})}
server.listen(PORT,HOST,()=>console.log(`Quiz ${VERSION} listening on http://${HOST}:${PORT}`));
