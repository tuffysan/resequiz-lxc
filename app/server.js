'use strict';
const express=require('express');
const http=require('http');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const {execFileSync}=require('child_process');
const QRCode=require('qrcode');
const {Server}=require('socket.io');
const {readJson,writeJsonAtomic,ensureDir}=require('./storage');
const {openQuizDb,indexResults}=require('./database');
const {cleanQuestionText,normalizeText,similarity,deriveFactKey,answerQuality,wordingQuality}=require('./question-intelligence');

const VERSION='22.1.0',PORT=Number(process.env.PORT||3000),HOST=process.env.HOST||'0.0.0.0';
const DATA_DIR=process.env.RESEQUIZ_DATA_DIR||path.join(__dirname,'data');
const QUESTIONS_FILE=path.join(DATA_DIR,'questions.json'),RESULTS_FILE=path.join(DATA_DIR,'results.json'),SETTINGS_FILE=path.join(DATA_DIR,'settings.json'),USERS_FILE=path.join(DATA_DIR,'users.json'),REPORTS_FILE=path.join(DATA_DIR,'question-reports.json'),DUELS_FILE=path.join(DATA_DIR,'duels.json');
const CHILD_QUESTIONS_FILE=path.join(__dirname,'data','child-questions.json');
const ADMIN_AUTH_FILE=path.join(DATA_DIR,'admin-auth.json'),ADMIN_SETUP_KEY_FILE=path.join(DATA_DIR,'admin-setup-key');
const CHILD_TOPICS=['Blandat','Djur','Disney/barnfilm','Geografi','Fotboll','Natur','Matematik'];
ensureDir(DATA_DIR);
for(const [f,d] of [[QUESTIONS_FILE,[]],[RESULTS_FILE,[]],[USERS_FILE,[]],[REPORTS_FILE,[]],[DUELS_FILE,[]],[SETTINGS_FILE,{title:'Quiz',defaultQuestionCount:10,defaultSeconds:30,allowGuestAdmin:false}]])if(!fs.existsSync(f))writeJsonAtomic(f,d);
if(!fs.existsSync(ADMIN_SETUP_KEY_FILE))fs.writeFileSync(ADMIN_SETUP_KEY_FILE,crypto.randomBytes(9).toString('base64url').toUpperCase()+'\n',{mode:0o600});
if(!fs.existsSync(ADMIN_AUTH_FILE))writeJsonAtomic(ADMIN_AUTH_FILE,{passwordHash:'',passwordSalt:'',updatedAt:null});

const app=express(),server=http.createServer(app),io=new Server(server,{serveClient:true});
app.disable('x-powered-by');app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(__dirname,'public'),{extensions:['html']}));
const quizDb=openQuizDb(DATA_DIR);
const questions=()=>readJson(QUESTIONS_FILE,[]),results=()=>readJson(RESULTS_FILE,[]),users=()=>readJson(USERS_FILE,[]),reports=()=>readJson(REPORTS_FILE,[]),duels=()=>readJson(DUELS_FILE,[]),settings=()=>readJson(SETTINGS_FILE,{}),childQuestions=()=>readJson(CHILD_QUESTIONS_FILE,[]);
const safe=s=>String(s??'').trim(),shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const normalizeAge=a=>Math.min(15,Math.max(4,Number(a)||8));
const normalizeTopic=t=>CHILD_TOPICS.includes(t)?t:'Blandat';
const questionsForAge=(age,topic='Blandat')=>{age=normalizeAge(age);topic=normalizeTopic(topic);let pool=childQuestions().filter(q=>age>=q.ageMin&&age<=q.ageMax);if(topic!=='Blandat')pool=pool.filter(q=>q.topic===topic);return pool};
const qVisual=q=>safe(q.visual??q.image??q.imageUrl??q.image_url);
const publicQuestion=q=>({id:q.id,category:q.category,difficulty:q.difficulty,question:cleanQuestionText(q.question),answers:q.answers,visual:qVisual(q),mediaType:safe(q.mediaType||q.subtype||q.type||'image'),subtype:safe(q.subtype??q.type),source:safe(q.sourceUrl||q.source_url||q.source),verification:safe(q.verification||q.verificationLevel),verified:!!q.verified,factKey:safe(q.factKey||deriveFactKey(q))});
const offlineQuestion=q=>({...publicQuestion(q),correct:Number(q.correct),explanation:q.explanation||'',ageMin:q.ageMin??null,ageMax:q.ageMax??null,topic:q.topic||''});
const rooms=new Map();
const publicRoom=r=>({code:r.code,phase:r.phase,hostId:r.hostId,questionIndex:r.questionIndex,total:r.quiz.length,seconds:r.seconds,category:r.category||'',age:r.age||null,topic:r.topic||'',difficulty:r.difficulty||'mixed',format:r.format||'standard',locked:!!r.locked,paused:!!r.paused,party:!!r.party,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,answered:p.answered,userId:p.userId||null,team:p.team||''}))});

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
const userFromToken=token=>{token=safe(token);const ss=userSessions.get(token);if(!ss)return null;if(ss.expiresAt<Date.now()){userSessions.delete(token);return null}return users().find(u=>u.id===ss.userId)||null};
const userFromReq=req=>userFromToken((req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim());
function playerProgress(userId){
 const rs=results().filter(r=>r.userId===userId),games=rs.length,totalCorrect=rs.reduce((a,r)=>a+(Number(r.score)||0),0),xp=rs.reduce((a,r)=>a+Math.max(20,Math.round(resultPct(r)*2))+(resultPct(r)===100?100:0)+(r.difficulty==='hard'?50:0),0);
 const level=Math.max(1,Math.floor(Math.sqrt(xp/250))+1),levelStart=(level-1)*(level-1)*250,next=level*level*250;
 const byCategory={};for(const r of rs){const c=r.category||'Blandat',x=byCategory[c]||{games:0,sum:0,best:0};const v=resultPct(r);x.games++;x.sum+=v;x.best=Math.max(x.best,v);byCategory[c]=x}
 const categories=Object.entries(byCategory).map(([name,x])=>({name,games:x.games,average:Math.round(x.sum/x.games),best:x.best})).sort((a,b)=>b.average-a.average||b.games-a.games);
 let streak=0;const days=[...new Set(rs.map(r=>String(r.at||'').slice(0,10)))].sort().reverse();if(days.length){let d=new Date();for(const day of days){const want=d.toISOString().slice(0,10);if(day===want){streak++;d.setDate(d.getDate()-1)}else if(streak===0){d.setDate(d.getDate()-1);if(day===d.toISOString().slice(0,10)){streak++;d.setDate(d.getDate()-1)}else break}else break}}
 return {games,xp,level,levelProgress:Math.max(0,xp-levelStart),levelNeed:Math.max(1,next-levelStart),streak,totalCorrect,categories};
}
const BADGE_DEFS=[
 ['first-game','🎮','Första steget','Slutför 1 quiz',p=>p.games>=1,p=>Math.min(p.games,1),1],
 ['five-games','⭐','Quizkompis','Spela 5 quiz',p=>p.games>=5,p=>Math.min(p.games,5),5],
 ['ten-games','🏅','Quizvana','Spela 10 quiz',p=>p.games>=10,p=>Math.min(p.games,10),10],
 ['twentyfive-games','🏆','Quizmästare','Spela 25 quiz',p=>p.games>=25,p=>Math.min(p.games,25),25],
 ['fifty-games','👑','Veteran','Spela 50 quiz',p=>p.games>=50,p=>Math.min(p.games,50),50],
 ['hundred-games','💯','Hundraklubben','Spela 100 quiz',p=>p.games>=100,p=>Math.min(p.games,100),100],
 ['games-250','🛡️','Quizlegend','Spela 250 quiz',p=>p.games>=250,p=>Math.min(p.games,250),250],
 ['explorer','🧭','Utforskare','Spela 5 kategorier',p=>p.categories.length>=5,p=>Math.min(p.categories.length,5),5],
 ['allrounder','🌟','Allround','Spela 10 kategorier',p=>p.categories.length>=10,p=>Math.min(p.categories.length,10),10],
 ['category-15','🌍','Världsvan','Spela 15 kategorier',p=>p.categories.length>=15,p=>Math.min(p.categories.length,15),15],
 ['level3','🌱','På gång','Nå nivå 3',p=>p.level>=3,p=>Math.min(p.level,3),3],
 ['level5','🚀','På väg upp','Nå nivå 5',p=>p.level>=5,p=>Math.min(p.level,5),5],
 ['level10','💎','Quizproffs','Nå nivå 10',p=>p.level>=10,p=>Math.min(p.level,10),10],
 ['level15','🦾','Elitspelare','Nå nivå 15',p=>p.level>=15,p=>Math.min(p.level,15),15],
 ['level20','👑','Nivåmästare','Nå nivå 20',p=>p.level>=20,p=>Math.min(p.level,20),20],
 ['streak2','✨','Tillbaka igen','2 dagars streak',p=>p.streak>=2,p=>Math.min(p.streak,2),2],
 ['streak3','🔥','På gång','3 dagars streak',p=>p.streak>=3,p=>Math.min(p.streak,3),3],
 ['streak5','🔥','Het streak','5 dagars streak',p=>p.streak>=5,p=>Math.min(p.streak,5),5],
 ['streak7','⚡','Ostoppbar','7 dagars streak',p=>p.streak>=7,p=>Math.min(p.streak,7),7],
 ['streak14','🌋','Två veckor','14 dagars streak',p=>p.streak>=14,p=>Math.min(p.streak,14),14],
 ['xp1000','🪙','XP-jägare','Samla 1 000 XP',p=>p.xp>=1000,p=>Math.min(p.xp,1000),1000],
 ['xp5000','💰','XP-samlare','Samla 5 000 XP',p=>p.xp>=5000,p=>Math.min(p.xp,5000),5000],
 ['xp10000','💎','XP-mästare','Samla 10 000 XP',p=>p.xp>=10000,p=>Math.min(p.xp,10000),10000],
 ['cat3-70','🥉','Bronsbredd','70 % i 3 kategorier',p=>p.categories.filter(c=>c.average>=70&&c.games>=3).length>=3,p=>Math.min(p.categories.filter(c=>c.average>=70&&c.games>=3).length,3),3],
 ['cat5-75','🥈','Silverbred','75 % i 5 kategorier',p=>p.categories.filter(c=>c.average>=75&&c.games>=3).length>=5,p=>Math.min(p.categories.filter(c=>c.average>=75&&c.games>=3).length,5),5],
 ['cat5-85','🥇','Guldbred','85 % i 5 kategorier',p=>p.categories.filter(c=>c.average>=85&&c.games>=5).length>=5,p=>Math.min(p.categories.filter(c=>c.average>=85&&c.games>=5).length,5),5],
 ['cat10-games','📚','Kategorivana','10 spel i en kategori',p=>p.categories.some(c=>c.games>=10),p=>Math.min(Math.max(0,...p.categories.map(c=>c.games)),10),10],
 ['cat25-games','🎓','Specialist','25 spel i en kategori',p=>p.categories.some(c=>c.games>=25),p=>Math.min(Math.max(0,...p.categories.map(c=>c.games)),25),25],
 ['best70','👍','Stabil','Nå minst 70 % kategori-snitt',p=>p.categories.some(c=>c.average>=70),p=>Math.min(Math.max(0,...p.categories.map(c=>c.average)),70),70],
 ['best80','🧠','Kunnig','Nå minst 80 % kategori-snitt',p=>p.categories.some(c=>c.average>=80),p=>Math.min(Math.max(0,...p.categories.map(c=>c.average)),80),80],
 ['best90','🏅','Skärpt','Nå minst 90 % kategori-snitt',p=>p.categories.some(c=>c.average>=90),p=>Math.min(Math.max(0,...p.categories.map(c=>c.average)),90),90],
 ['games-week','📆','Veckospelare','Spela 7 quiz totalt',p=>p.games>=7,p=>Math.min(p.games,7),7],
 ['games-75','🎯','Träffsäker veteran','Spela 75 quiz',p=>p.games>=75,p=>Math.min(p.games,75),75],
 ['games-150','🏛️','Quizarkivarie','Spela 150 quiz',p=>p.games>=150,p=>Math.min(p.games,150),150],
 ['level25','🏔️','Toppspelare','Nå nivå 25',p=>p.level>=25,p=>Math.min(p.level,25),25],
 ['streak30','☄️','Månadssvit','30 dagars streak',p=>p.streak>=30,p=>Math.min(p.streak,30),30]
]
function playerBadges(userId){const rs=results().filter(r=>r.userId===userId),p=playerProgress(userId);if(!rs.length)return [];const out=BADGE_DEFS.filter(x=>x[4](p)).map(x=>({id:x[0],icon:x[1],name:x[2],detail:x[3]}));if(Math.max(...rs.map(resultPct))===100)out.push({id:'perfect',icon:'💯',name:'Perfektion',detail:'100 % i ett quiz'});if(rs.some(r=>r.difficulty==='hard'&&resultPct(r)>=80))out.push({id:'hard-80',icon:'🧠',name:'Svårslagen',detail:'Minst 80 % på svår nivå'});for(const c of p.categories.filter(x=>x.games>=5&&x.average>=80).slice(0,12))out.push({id:'master-'+c.name,icon:'🎓',name:c.name+'-expert',detail:'Minst 80 % i '+c.name+' över 5 spel'});const daily=rs.filter(r=>r.mode==='daily');if(daily.length>=3)out.push({id:'daily3',icon:'☀️',name:'Morgonpigg',detail:'Spela 3 Daily Quiz'});if(daily.length>=10)out.push({id:'daily10',icon:'🌅',name:'Daily-vana',detail:'Spela 10 Daily Quiz'});if(rs.some(r=>r.mode==='multiplayer'))out.push({id:'multiplayer',icon:'👥',name:'Sällskapsspelare',detail:'Spela multiplayer'});if(rs.some(r=>r.mode==='duel'))out.push({id:'duelist',icon:'⚔️',name:'Duellant',detail:'Slutför en Quiz Duel'});return out}
function badgeProgress(userId){const p=playerProgress(userId),owned=new Set(playerBadges(userId).map(x=>x.id));return BADGE_DEFS.filter(x=>!owned.has(x[0])).map(x=>({id:x[0],icon:x[1],name:x[2],detail:x[3],value:x[5](p),target:x[6],percent:Math.min(100,Math.round(x[5](p)/x[6]*100))})).sort((a,b)=>b.percent-a.percent).slice(0,4)}
app.post('/api/users/register',(req,res)=>{const username=normalizeUsername(req.body?.username),displayName=safe(req.body?.displayName||req.body?.username).slice(0,30),password=String(req.body?.password||'');if(username.length<3)return res.status(400).json({ok:false,error:'Användarnamnet måste vara minst 3 tecken.'});if(password.length<8)return res.status(400).json({ok:false,error:'Lösenordet måste vara minst 8 tecken.'});const all=users();if(all.some(u=>u.username===username))return res.status(409).json({ok:false,error:'Användarnamnet finns redan.'});const salt=crypto.randomBytes(16).toString('hex'),u={id:crypto.randomUUID(),username,displayName:displayName||username,passwordSalt:salt,passwordHash:hashPassword(password,salt),createdAt:new Date().toISOString()};all.push(u);writeJsonAtomic(USERS_FILE,all);const token=crypto.randomBytes(32).toString('base64url');userSessions.set(token,{userId:u.id,expiresAt:Date.now()+USER_SESSION_MS});res.status(201).json({ok:true,token,user:publicUser(u),badges:[]})});
app.post('/api/users/login',(req,res)=>{const username=normalizeUsername(req.body?.username),password=String(req.body?.password||''),u=users().find(x=>x.username===username);if(!u)return res.status(401).json({ok:false,error:'Fel användarnamn eller lösenord.'});const actual=hashPassword(password,u.passwordSalt);if(actual.length!==u.passwordHash.length||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(u.passwordHash)))return res.status(401).json({ok:false,error:'Fel användarnamn eller lösenord.'});const token=crypto.randomBytes(32).toString('base64url');userSessions.set(token,{userId:u.id,expiresAt:Date.now()+USER_SESSION_MS});res.json({ok:true,token,user:publicUser(u),badges:playerBadges(u.id)})});
app.post('/api/users/logout',(req,res)=>{const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();if(token)userSessions.delete(token);res.json({ok:true})});
app.get('/api/users/me',(req,res)=>{const u=userFromReq(req);if(!u)return res.status(401).json({ok:false,error:'Inte inloggad.'});const rs=results().filter(r=>r.userId===u.id),best=rs.length?Math.max(...rs.map(resultPct)):0,average=rs.length?Math.round(rs.reduce((a,r)=>a+resultPct(r),0)/rs.length):0;res.json({ok:true,user:publicUser(u),stats:{games:rs.length,best,average,categories:new Set(rs.map(r=>r.category).filter(Boolean)).size},progress:playerProgress(u.id),badges:playerBadges(u.id),nextBadges:badgeProgress(u.id),mastery:masteryFor(u.id),weeklyChallenges:weeklyChallenges(u.id),dailyStreak:dailyStreak(u.id),recent:rs.slice(-10).reverse()})});

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

// Quiz 22: daily quiz, question learning metrics, reports and filtered leaderboards.
function masteryFor(userId){
 const rs=results().filter(r=>r.userId===userId),by={};
 for(const r of rs){const c=safe(r.category)||'Blandat',x=by[c]||{games:0,sum:0,best:0};const pct=resultPct(r);x.games++;x.sum+=pct;x.best=Math.max(x.best,pct);by[c]=x}
 const levels=[['Nybörjare','🌱',0],['Brons','🥉',40],['Silver','🥈',60],['Guld','🥇',75],['Expert','🎓',85],['Mästare','👑',93]];
 return Object.entries(by).map(([category,x])=>{const average=Math.round(x.sum/x.games),effective=Math.min(100,Math.round(average*Math.min(1,x.games/5))),rank=[...levels].reverse().find(y=>effective>=y[2])||levels[0];return {category,games:x.games,average,best:x.best,mastery:effective,rank:rank[0],icon:rank[1]}}).sort((a,b)=>b.mastery-a.mastery||b.games-a.games)
}
function weeklyChallenges(userId){
 const start=Date.now()-7*86400000,rs=results().filter(r=>r.userId===userId&&new Date(r.at).getTime()>=start);const hist=quizDb?(()=>{try{return quizDb.prepare('SELECT correct FROM question_history WHERE user_id=? AND played_at>=?').all(userId,new Date(start).toISOString())}catch{return []}})():[];
 const cats=new Set(rs.map(r=>r.category).filter(Boolean));const correct=hist.reduce((a,x)=>a+(x.correct?1:0),0);const hard=rs.filter(r=>r.difficulty==='hard').length;
 return [
  {id:'week-games',icon:'🎮',name:'Veckospelaren',detail:'Spela 5 quiz denna vecka',value:Math.min(rs.length,5),target:5},
  {id:'week-categories',icon:'🧭',name:'Upptäckaren',detail:'Spela 3 olika kategorier',value:Math.min(cats.size,3),target:3},
  {id:'week-correct',icon:'🎯',name:'Träffsäker',detail:'Svara rätt på 30 frågor',value:Math.min(correct,30),target:30},
  {id:'week-hard',icon:'🧠',name:'Våga svårt',detail:'Spela 2 quiz på svår nivå',value:Math.min(hard,2),target:2}
 ].map(x=>({...x,percent:Math.min(100,Math.round(x.value/x.target*100)),done:x.value>=x.target}))
}
function dailyStreak(userId){
 const days=[...new Set(results().filter(r=>r.userId===userId&&r.mode==='daily').map(r=>String(r.at||'').slice(0,10)))].sort().reverse();let streak=0,d=new Date();for(let i=0;i<days.length;i++){const want=d.toISOString().slice(0,10);if(days[i]===want){streak++;d.setUTCDate(d.getUTCDate()-1)}else if(i===0){d.setUTCDate(d.getUTCDate()-1);if(days[i]===d.toISOString().slice(0,10)){streak++;d.setUTCDate(d.getUTCDate()-1)}else break}else break}return streak
}
function trainingQuestions(userId,count=10,category=''){
 let pool=questions();if(category)pool=pool.filter(q=>q.category===category);if(!quizDb)return shuffle(pool).slice(0,count);
 try{
  const rows=quizDb.prepare(`SELECT question_id,SUM(CASE WHEN correct=0 THEN 1 ELSE 0 END) wrong,SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) right,COUNT(*) seen,MAX(played_at) last_seen FROM question_history WHERE user_id=? GROUP BY question_id`).all(userId);
  const now=Date.now(),state=new Map(rows.map(r=>[r.question_id,r]));
  const due=[],later=[],unseen=[];
  for(const q of pool){const h=state.get(q.id);if(!h){unseen.push(q);continue}const last=Date.parse(h.last_seen)||0,days=(now-last)/86400000;const wrong=Number(h.wrong)||0,right=Number(h.right)||0;const interval=wrong>right?2:Math.min(120,7*Math.pow(2,Math.max(0,right-wrong-1)));(days>=interval?due:later).push({q,priority:(wrong*4-right)+(days/Math.max(1,interval))})}
  due.sort((a,b)=>b.priority-a.priority);later.sort((a,b)=>b.priority-a.priority);
  return [...due.map(x=>x.q),...shuffle(unseen),...later.map(x=>x.q)].slice(0,count)
 }catch{return shuffle(pool).slice(0,count)}
}
function adaptiveQuestions(userId,pool,count){
 if(!quizDb)return shuffle(pool).slice(0,count);
 try{
  const rows=quizDb.prepare(`SELECT question_id,correct,played_at FROM question_history WHERE user_id=? ORDER BY played_at DESC`).all(userId),latest=new Map();for(const r of rows)if(!latest.has(r.question_id))latest.set(r.question_id,r);
  const unseen=[],dueWrong=[],oldCorrect=[],recent=[];const now=Date.now();
  for(const q of pool){const h=latest.get(q.id);if(!h){unseen.push(q);continue}const days=(now-(Date.parse(h.played_at)||now))/86400000;if(!h.correct&&days>=2)dueWrong.push(q);else if(h.correct&&days>=45)oldCorrect.push(q);else recent.push(q)}
  return [...shuffle(dueWrong),...shuffle(unseen),...shuffle(oldCorrect),...shuffle(recent)].slice(0,count)
 }catch{return shuffle(pool).slice(0,count)}
}
function qualityAnomalies(){if(!quizDb)return [];try{return quizDb.prepare(`SELECT question_id,times_shown,times_correct,reported,total_response_ms,last_seen,answer_0,answer_1,answer_2,answer_3,answer_4,answer_5,ROUND(times_correct*100.0/NULLIF(times_shown,0),1) correct_rate,ROUND(total_response_ms*1.0/NULLIF(times_shown,0)) avg_response_ms FROM question_metrics WHERE times_shown>=5 AND (times_correct*1.0/times_shown<0.15 OR times_correct*1.0/times_shown>0.98 OR reported>=2) ORDER BY reported DESC,times_shown DESC LIMIT 200`).all()}catch{return []}}
const dayKey=()=>new Date().toISOString().slice(0,10);
const seededNumber=text=>{const h=crypto.createHash('sha256').update(String(text)).digest();return h.readUInt32BE(0)/0xffffffff};
function dailyQuestions(date=dayKey(),count=10){
 const pool=questions().filter(q=>q.verified||q.verification||q.source||q.sourceUrl||q.source_url);
 const source=pool.length>=count?pool:questions();
 return [...source].map(q=>({q,k:seededNumber(date+'|'+q.id)})).sort((a,b)=>a.k-b.k).slice(0,count).map(x=>x.q);
}
function recordQuestionMetric(questionId,correct,responseMs=0,answerIndex=-1){
 if(!quizDb||!questionId)return;
 try{
  const ai=Number(answerIndex),counts=[0,0,0,0,0,0];if(Number.isInteger(ai)&&ai>=0&&ai<6)counts[ai]=1;
  quizDb.prepare(`INSERT INTO question_metrics(question_id,times_shown,times_correct,total_response_ms,last_seen,answer_0,answer_1,answer_2,answer_3,answer_4,answer_5) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(question_id) DO UPDATE SET times_shown=times_shown+1,times_correct=times_correct+excluded.times_correct,total_response_ms=total_response_ms+excluded.total_response_ms,last_seen=excluded.last_seen,answer_0=answer_0+excluded.answer_0,answer_1=answer_1+excluded.answer_1,answer_2=answer_2+excluded.answer_2,answer_3=answer_3+excluded.answer_3,answer_4=answer_4+excluded.answer_4,answer_5=answer_5+excluded.answer_5`).run(String(questionId),1,correct?1:0,Number(responseMs)||0,new Date().toISOString(),...counts)
 }catch{}
}
app.get('/api/daily',(req,res)=>{const date=dayKey(),qs=dailyQuestions(date,10);res.json({ok:true,date,count:qs.length,questions:qs.map(publicQuestion)})});
app.get('/api/daily/status',(req,res)=>{const date=dayKey(),u=userFromReq(req),rs=results().filter(r=>r.mode==='daily'&&String(r.at||'').slice(0,10)===date&&r.leaderboardEligible!==false);const mine=u?rs.find(r=>r.userId===u.id):null;const sorted=[...rs].sort((a,b)=>resultPct(b)-resultPct(a)||new Date(a.at)-new Date(b.at)),leaders=sorted.slice(0,20).map((r,i)=>({rank:i+1,name:r.name,score:r.score,total:r.total,pct:resultPct(r),at:r.at,userId:r.userId||null}));let rank=null,percentile=null;if(mine){rank=sorted.findIndex(r=>r.id===mine.id)+1;percentile=rs.length?Math.max(1,Math.round((1-(rank-1)/rs.length)*100)):100}res.json({ok:true,date,played:!!mine,result:mine||null,players:rs.length,leaders,rank,percentile,dailyStreak:u?dailyStreak(u.id):0,bonusXp:mine?50:0})});
app.get('/api/training/status',(req,res)=>{const u=userFromReq(req);if(!u)return res.status(401).json({ok:false,error:'Logga in för träningsläge.'});const mastery=masteryFor(u.id);res.json({ok:true,mastery,weakest:mastery.slice().sort((a,b)=>a.mastery-b.mastery).slice(0,4),historyCount:quizDb?(()=>{try{return quizDb.prepare('SELECT COUNT(*) n FROM question_history WHERE user_id=?').get(u.id).n}catch{return 0}})():0})});
app.get('/api/challenges/weekly',(req,res)=>{const u=userFromReq(req);if(!u)return res.json({ok:true,guest:true,challenges:[]});res.json({ok:true,guest:false,challenges:weeklyChallenges(u.id)})});
app.post('/api/duels',(req,res)=>{const u=userFromReq(req),b=req.body||{},category=safe(b.category),difficulty=['easy','medium','hard'].includes(b.difficulty)?b.difficulty:'mixed',count=Math.min(20,Math.max(5,Number(b.count)||10));let pool=questions();if(category)pool=pool.filter(q=>q.category===category);if(difficulty!=='mixed')pool=pool.filter(q=>q.difficulty===difficulty);if(pool.length<count)return res.status(400).json({ok:false,error:'För få frågor för denna duell.'});const id=crypto.randomBytes(6).toString('base64url'),item={id,creatorUserId:u?.id||null,creatorName:u?.displayName||safe(b.name)||'Utmanare',category,difficulty,format:safe(b.format)||'standard',questionIds:shuffle(pool).slice(0,count).map(q=>q.id),attempts:[],createdAt:new Date().toISOString(),status:'open'};const all=duels();all.push(item);writeJsonAtomic(DUELS_FILE,all.slice(-3000));if(quizDb)try{quizDb.prepare('INSERT OR REPLACE INTO duel_index(id,creator_user_id,category,difficulty,format,created_at,status) VALUES(?,?,?,?,?,?,?)').run(id,item.creatorUserId,category,difficulty,item.format,item.createdAt,'open')}catch{}res.status(201).json({ok:true,duel:{id,creatorName:item.creatorName,category,difficulty,count,shareUrl:`/duel.html?id=${id}`}})});
app.get('/api/duels/:id',(req,res)=>{const d=duels().find(x=>x.id===req.params.id);if(!d)return res.status(404).json({ok:false,error:'Duellen finns inte.'});const qmap=new Map(questions().map(q=>[q.id,q])),u=userFromReq(req);res.json({ok:true,duel:{id:d.id,creatorName:d.creatorName,category:d.category,difficulty:d.difficulty,format:d.format,count:d.questionIds.length,status:d.status,questions:d.questionIds.map(id=>qmap.get(id)).filter(Boolean).map(publicQuestion),attempts:d.attempts.map(a=>({name:a.name,score:a.score,total:a.total,pct:Math.round(a.score/a.total*100),at:a.at,userId:a.userId||null})),alreadyPlayed:u?d.attempts.some(a=>a.userId===u.id):false}})});
app.post('/api/duels/:id/check',(req,res)=>{const d=duels().find(x=>x.id===req.params.id),q=questions().find(x=>x.id===req.body?.questionId);if(!d||!q||!d.questionIds.includes(q.id))return res.status(404).json({ok:false,error:'Frågan finns inte i duellen.'});const answerIndex=Number(req.body?.answerIndex),correct=answerIndex===Number(q.correct);recordQuestionMetric(q.id,correct,Number(req.body?.responseMs)||0);res.json({ok:true,correct,correctIndex:Number(q.correct),explanation:q.explanation||'',source:safe(q.sourceUrl||q.source_url||q.source)})});
app.post('/api/duels/:id/submit',(req,res)=>{const all=duels(),d=all.find(x=>x.id===req.params.id);if(!d)return res.status(404).json({ok:false,error:'Duellen finns inte.'});const u=userFromReq(req),b=req.body||{};if(u&&d.attempts.some(a=>a.userId===u.id))return res.status(409).json({ok:false,error:'Du har redan spelat denna duell.'});const attempt={id:crypto.randomUUID(),userId:u?.id||null,name:u?.displayName||safe(b.name)||'Gäst',score:Math.max(0,Number(b.score)||0),total:d.questionIds.length,elapsedMs:Math.max(0,Number(b.elapsedMs)||0),at:new Date().toISOString()};d.attempts.push(attempt);if(d.attempts.length>=2)d.status='finished';writeJsonAtomic(DUELS_FILE,all);const saved=saveResult({id:crypto.randomUUID(),userId:attempt.userId,name:attempt.name,score:attempt.score,total:attempt.total,mode:'duel',category:d.category,difficulty:d.difficulty,format:d.format,questionIds:d.questionIds,at:attempt.at});const ranking=[...d.attempts].sort((a,b)=>b.score-a.score||a.elapsedMs-b.elapsedMs);res.status(201).json({ok:true,attempt,ranking:ranking.map((a,i)=>({rank:i+1,name:a.name,score:a.score,total:a.total,elapsedMs:a.elapsedMs})),awards:saved.awards||[],progress:u?playerProgress(u.id):null})});
app.post('/api/question-report',(req,res)=>{const b=req.body||{},qid=safe(b.questionId),reason=safe(b.reason).slice(0,120),comment=safe(b.comment).slice(0,500);if(!qid||![...questions(),...childQuestions()].some(q=>q.id===qid))return res.status(404).json({ok:false,error:'Frågan finns inte.'});const all=reports();const u=userFromReq(req);all.push({id:crypto.randomUUID(),questionId:qid,reason:reason||'other',comment,userId:u?.id||null,status:'open',createdAt:new Date().toISOString()});writeJsonAtomic(REPORTS_FILE,all.slice(-5000));if(quizDb)try{quizDb.prepare('INSERT INTO question_metrics(question_id,reported) VALUES(?,1) ON CONFLICT(question_id) DO UPDATE SET reported=reported+1').run(qid)}catch{}res.status(201).json({ok:true})});
app.get('/api/offline/status',(req,res)=>res.json({ok:true,version:VERSION,available:Math.min(600,questions().length)+childQuestions().length,regular:Math.min(600,questions().length),children:childQuestions().length,generatedAt:new Date().toISOString()}));
app.get('/health',(req,res)=>res.json({ok:true,version:VERSION,rooms:rooms.size,questions:questions().length,status:'healthy'}));
app.get('/api/meta',(req,res)=>{const qs=questions();const categories=[...new Set(qs.map(q=>q.category))].sort();if(!categories.includes('Barnquiz'))categories.unshift('Barnquiz');res.json({version:VERSION,categories,questionCount:qs.length,childQuestionCount:childQuestions().length,childAgeRange:{min:4,max:15},childTopics:CHILD_TOPICS,settings:settings()})});
app.get('/api/offline-pack',(req,res)=>{const count=Math.min(3000,Math.max(100,Number(req.query.count)||500)),cats=safe(req.query.categories).split(',').map(x=>x.trim()).filter(Boolean),includeKids=req.query.kids!=='0';let pool=questions();if(cats.length)pool=pool.filter(q=>cats.includes(q.category));res.json({version:VERSION,generatedAt:new Date().toISOString(),selectedCategories:cats,questions:shuffle(pool).slice(0,count).map(offlineQuestion),childQuestions:includeKids?childQuestions().map(offlineQuestion):[]})});
app.get('/api/questions',(req,res)=>{let qs=questions();if(req.query.category)qs=qs.filter(q=>q.category===req.query.category);res.json(qs.map(publicQuestion))});
app.post('/api/solo/start',(req,res)=>{const b=req.body||{},count=Math.min(40,Math.max(3,Number(b.count)||10)),u=userFromReq(req);let qs=b.category==='Barnquiz'?questionsForAge(b.age,b.topic):questions();if(b.category&&b.category!=='Barnquiz')qs=qs.filter(q=>q.category===b.category);if(['easy','medium','hard'].includes(b.difficulty))qs=qs.filter(q=>q.difficulty===b.difficulty);if(u&&b.training===true)qs=trainingQuestions(u.id,Math.max(count*4,count),b.category==='Barnquiz'?'':safe(b.category));else if(u&&b.adaptive!==false){qs=adaptiveQuestions(u.id,qs,count*4)}else qs=shuffle(qs);res.json({ok:true,category:b.category||'',age:b.category==='Barnquiz'?normalizeAge(b.age):null,topic:b.category==='Barnquiz'?normalizeTopic(b.topic):null,adaptive:!!u,training:!!(u&&b.training),questions:qs.slice(0,count).map(publicQuestion)})});
app.post('/api/solo/check',(req,res)=>{const q=[...questions(),...childQuestions()].find(x=>x.id===req.body?.questionId);if(!q)return res.status(404).json({ok:false,error:'Frågan finns inte'});const answerIndex=Number(req.body?.answerIndex),isCorrect=answerIndex===Number(q.correct),responseMs=Math.max(0,Math.min(120000,Number(req.body?.responseMs)||0)),u=userFromReq(req);recordQuestionMetric(q.id,isCorrect,responseMs,answerIndex);if(quizDb&&u)try{quizDb.prepare('INSERT INTO question_history(user_id,question_id,category,correct,answer_index,response_ms,played_at) VALUES(?,?,?,?,?,?,?)').run(u.id,q.id,q.category||'',isCorrect?1:0,answerIndex,responseMs,new Date().toISOString())}catch{}res.json({ok:true,correct:isCorrect,correctIndex:Number(q.correct),explanation:q.explanation||'',source:safe(q.sourceUrl||q.source_url||q.source),verification:safe(q.verification||q.verificationLevel)})});
app.get('/api/results',(req,res)=>res.json(results().slice(-100).reverse()));
app.post('/api/results',(req,res)=>{const b=req.body||{},u=userFromReq(req),mode=safe(b.mode)||'solo',date=dayKey();let leaderboardEligible=true;if(mode==='daily'&&u)leaderboardEligible=!results().some(x=>x.mode==='daily'&&x.userId===u.id&&String(x.at||'').slice(0,10)===date);const r=saveResult({id:crypto.randomUUID(),userId:u?.id||null,name:u?.displayName||safe(b.name)||'Gäst',score:Number(b.score)||0,total:Math.max(1,Number(b.total)||1),mode,category:safe(b.category),topic:safe(b.topic),age:b.age?normalizeAge(b.age):null,difficulty:safe(b.difficulty)||'mixed',format:safe(b.format)||'standard',questionIds:Array.isArray(b.questionIds)?b.questionIds.map(safe).slice(0,40):[],leaderboardEligible,at:new Date().toISOString()});if(mode==='daily'&&u&&leaderboardEligible&&quizDb)try{quizDb.prepare('INSERT OR REPLACE INTO daily_attempts(user_id,day_key,result_id,score,total,played_at) VALUES(?,?,?,?,?,?)').run(u.id,date,r.id,r.score,r.total,r.at)}catch{}const progress=u?playerProgress(u.id):null;res.status(201).json({ok:true,result:r,awards:r.awards,badges:u?playerBadges(u.id):[],progress,mastery:u?masteryFor(u.id):[],weeklyChallenges:u?weeklyChallenges(u.id):[],leaderboardEligible})});
app.get('/api/stats',(req,res)=>{const rs=results(),played=rs.length,avg=played?rs.reduce((a,r)=>a+(r.score/r.total),0)/played:0,best=played?Math.max(...rs.map(r=>r.score/r.total)):0;res.json({played,average:Math.round(avg*100),best:Math.round(best*100),questions:questions().length})});
app.get('/api/highscores',(req,res)=>{let rs=results();const range=safe(req.query.range)||'all',category=safe(req.query.category),difficulty=safe(req.query.difficulty),format=safe(req.query.format);if(range!=='all'){const days=range==='today'?1:range==='week'?7:range==='month'?30:0;if(days){const cutoff=Date.now()-days*86400000;rs=rs.filter(r=>new Date(r.at).getTime()>=cutoff)}}if(category)rs=rs.filter(r=>r.category===category);if(difficulty)rs=rs.filter(r=>r.difficulty===difficulty);if(format)rs=rs.filter(r=>r.format===format);const players=new Map();for(const r of rs){const key=safe(r.name).toLocaleLowerCase('sv-SE')||'gäst',p=players.get(key)||{name:r.name||'Gäst',games:0,best:0,averageSum:0};const v=resultPct(r);p.games++;p.best=Math.max(p.best,v);p.averageSum+=v;players.set(key,p)}const leaders=[...players.values()].map(p=>({name:p.name,games:p.games,best:p.best,average:Math.round(p.averageSum/p.games)})).sort((a,b)=>b.best-a.best||b.average-a.average||b.games-a.games);const bestRow=rs.length?[...rs].sort((a,b)=>resultPct(b)-resultPct(a)||new Date(a.at)-new Date(b.at))[0]:null;const mostGames=leaders.length?[...leaders].sort((a,b)=>b.games-a.games||b.best-a.best)[0]:null;res.json({ok:true,leaders,filters:{range,category,difficulty,format},records:{globalBest:bestRow?{name:bestRow.name,value:resultPct(bestRow),at:bestRow.at}:null,mostGames:mostGames?{name:mostGames.name,games:mostGames.games}:null}})});

app.get('/api/admin/stats',requireAdmin,(req,res)=>{const rs=results(),qs=questions(),kids=childQuestions();const pct=r=>r.total?Math.round((Number(r.score)||0)/(Number(r.total)||1)*100):0;const players=new Map();for(const r of rs){const key=(r.name||'Gäst').trim().toLocaleLowerCase('sv-SE'),p=players.get(key)||{name:r.name||'Gäst',games:0,sum:0,best:0};const v=pct(r);p.games++;p.sum+=v;p.best=Math.max(p.best,v);players.set(key,p)}const top=[...players.values()].map(p=>({...p,average:Math.round(p.sum/p.games)})).sort((a,b)=>b.games-a.games||b.average-a.average).slice(0,10);const days={};for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days[d.toISOString().slice(0,10)]=0}for(const r of rs){const d=String(r.at||'').slice(0,10);if(d in days)days[d]++}const modes={solo:0,multiplayer:0,other:0};for(const r of rs){if(r.mode==='solo')modes.solo++;else if(r.mode==='multiplayer')modes.multiplayer++;else modes.other++}const cats={};for(const r of rs){const c=r.category||'Blandat';cats[c]=(cats[c]||0)+1}const imageQuestions=qs.filter(q=>qVisual(q)).length;res.json({ok:true,version:VERSION,totals:{games:rs.length,players:players.size,questions:qs.length,childQuestions:kids.length,imageQuestions,average:rs.length?Math.round(rs.reduce((a,r)=>a+pct(r),0)/rs.length):0,best:rs.length?Math.max(...rs.map(pct)):0},modes,days:Object.entries(days).map(([date,games])=>({date,games})),categories:Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,games])=>({name,games})),topPlayers:top,recent:rs.slice(-12).reverse()})});
function questionQuality(){
 const qs=questions(),issues=[],exact=new Map(),facts=new Map(),candidates=[];
 for(const q of qs){
  const text=normalizeText(q.question),reasons=[];
  if(!q.question||!Array.isArray(q.answers)||q.answers.length<2)reasons.push('ofullständig');
  reasons.push(...answerQuality(q),...wordingQuality(q));
  if(qVisual(q)){const v=qVisual(q);if(!/^https?:/i.test(v)&&!fs.existsSync(path.join(__dirname,'public',v.replace(/^\//,''))))reasons.push('trasig bild')}
  if(!q.source&&!q.verified&&!q.verification)reasons.push('saknar verifieringsmetadata');
  if(text){if(exact.has(text))reasons.push('exakt dubblett');else exact.set(text,q.id)}
  const fk=safe(q.factKey||deriveFactKey(q));if(fk){if(facts.has(fk))reasons.push('samma factKey som annan fråga');else facts.set(fk,q.id)}
  if(reasons.length)issues.push({id:q.id,question:q.question,category:q.category,factKey:fk,reasons:[...new Set(reasons)]});
  candidates.push({id:q.id,question:q.question,category:q.category,factKey:fk,text});
 }
 // Local semantic near-duplicate heuristic: compare within category and similar length.
 const semantic=[];const byCat=new Map();for(const q of candidates){const a=byCat.get(q.category)||[];a.push(q);byCat.set(q.category,a)}
 for(const arr of byCat.values()){
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<Math.min(arr.length,i+80);j++){
   const a=arr[i],b=arr[j];if(a.factKey&&a.factKey===b.factKey)continue;
   if(Math.abs(a.text.length-b.text.length)>80)continue;
   const sim=similarity(a.question,b.question);if(sim>=0.82){semantic.push({a:a.id,b:b.id,similarity:Math.round(sim*100),questionA:a.question,questionB:b.question,category:a.category});if(semantic.length>=300)break}
  }
  if(semantic.length>=300)break;
 }
 const anomaly=qualityAnomalies();
 const score=qs.length?Math.max(0,Math.round(100-(issues.length/qs.length*100))):100;
 return {score,total:qs.length,ok:qs.length-issues.length,review:issues.length,semanticDuplicates:semantic.length,statisticalWarnings:anomaly.length,issues:issues.slice(0,800),semantic:semantic.slice(0,300)}
}
function questionHealth(){const q=questionQuality(),openReports=reports().filter(x=>x.status==='open').length;return {ok:true,total:q.total,approved:q.ok,review:q.review,possibleDuplicates:q.semanticDuplicates,statisticalWarnings:q.statisticalWarnings,reported:openReports,score:q.score}}
app.get('/api/admin/question-health',requireAdmin,(req,res)=>res.json(questionHealth()));
app.post('/api/admin/question-intelligence/migrate',requireAdmin,(req,res)=>{try{const qs=questions();let cleaned=0,factKeys=0;for(const q of qs){const before=q.question,after=cleanQuestionText(before);if(after&&after!==before){q.question=after;cleaned++}if(!q.factKey){q.factKey=deriveFactKey(q);factKeys++}}writeJsonAtomic(QUESTIONS_FILE,qs);res.json({ok:true,total:qs.length,cleaned,factKeys})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.get('/api/admin/quality' ,requireAdmin,(req,res)=>res.json({ok:true,...questionQuality()}));
app.get('/api/admin/reports',requireAdmin,(req,res)=>{const qs=new Map([...questions(),...childQuestions()].map(q=>[q.id,q]));res.json(reports().slice().reverse().map(r=>({...r,question:qs.get(r.questionId)?.question||'Borttagen fråga',category:qs.get(r.questionId)?.category||''}))) });
app.post('/api/admin/reports/:id/resolve',requireAdmin,(req,res)=>{const all=reports(),r=all.find(x=>x.id===req.params.id);if(!r)return res.sendStatus(404);r.status=safe(req.body?.status)||'resolved';r.resolvedAt=new Date().toISOString();writeJsonAtomic(REPORTS_FILE,all);res.json({ok:true})});
app.get('/api/admin/question-metrics',requireAdmin,(req,res)=>{if(!quizDb)return res.json({ok:true,rows:[]});try{const qmap=new Map(questions().map(q=>[q.id,q]));const rows=quizDb.prepare('SELECT question_id,times_shown,times_correct,reported,last_seen,answer_0,answer_1,answer_2,answer_3,answer_4,answer_5,total_response_ms FROM question_metrics ORDER BY reported DESC,times_shown DESC LIMIT 500').all().map(x=>({...x,question:qmap.get(x.question_id)?.question||'',category:qmap.get(x.question_id)?.category||'',correctRate:x.times_shown?Math.round(x.times_correct/x.times_shown*100):null,avgResponseMs:x.times_shown?Math.round(x.total_response_ms/x.times_shown):null,answers:[x.answer_0,x.answer_1,x.answer_2,x.answer_3,x.answer_4,x.answer_5]}));res.json({ok:true,rows})}catch{res.json({ok:true,rows:[]})}});
app.get('/api/admin/quality/anomalies',requireAdmin,(req,res)=>{const qmap=new Map(questions().map(q=>[q.id,q]));res.json({ok:true,rows:qualityAnomalies().map(x=>({...x,question:qmap.get(x.question_id)?.question||'',category:qmap.get(x.question_id)?.category||''}))})});
app.get('/api/admin/system',requireAdmin,(req,res)=>{let dbSize=0;try{dbSize=fs.statSync(path.join(DATA_DIR,'quiz.db')).size}catch{}let backups=[];const dir='/var/backups/resequiz';try{backups=fs.readdirSync(dir).filter(x=>x.endsWith('.tgz')).sort().reverse().slice(0,10).map(name=>({name,size:fs.statSync(path.join(dir,name)).size}))}catch{}res.json({ok:true,version:VERSION,node:process.version,dataDir:DATA_DIR,database:{enabled:!!quizDb,size:dbSize},counts:{questions:questions().length,users:users().length,results:results().length,reports:reports().filter(x=>x.status==='open').length,duels:duels().length},backups})});
app.post('/api/admin/backup',requireAdmin,(req,res)=>{try{const dir='/var/backups/resequiz';fs.mkdirSync(dir,{recursive:true});const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\..+/,'').replace('T','-'),name=`manual-${stamp}.tgz`,file=path.join(dir,name);execFileSync('tar',['-czf',file,'-C',DATA_DIR,'.'],{timeout:120000});res.status(201).json({ok:true,name,size:fs.statSync(file).size})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.get('/api/admin/backup/:name',requireAdmin,(req,res)=>{const name=path.basename(req.params.name);if(!/^[-A-Za-z0-9_.]+\.tgz$/.test(name))return res.sendStatus(400);const file=path.join('/var/backups/resequiz',name);if(!fs.existsSync(file))return res.sendStatus(404);res.download(file,name)});
app.get('/api/admin/questions',requireAdmin,(req,res)=>res.json(questions()));
app.post('/api/admin/questions',requireAdmin,(req,res)=>{const b=req.body||{};if(!b.question||!Array.isArray(b.answers)||b.answers.length<2||!Number.isInteger(Number(b.correct)))return res.status(400).json({ok:false,error:'Ogiltig fråga'});const qs=questions(),previous=qs.find(q=>q.id===b.id)||{},item={...previous,id:b.id||crypto.randomUUID(),category:safe(b.category)||'Övrigt',difficulty:['easy','medium','hard'].includes(b.difficulty)?b.difficulty:'medium',question:safe(b.question).slice(0,300),answers:b.answers.map(x=>safe(x).slice(0,160)).slice(0,6),correct:Number(b.correct),explanation:safe(b.explanation).slice(0,500),visual:safe(b.visual),subtype:safe(b.subtype||previous.subtype),mediaType:safe(b.mediaType||previous.mediaType||b.subtype||previous.subtype),source:safe(b.source||previous.source),sourceUrl:safe(b.sourceUrl||previous.sourceUrl),verification:safe(b.verification||previous.verification),verificationLevel:safe(b.verificationLevel||previous.verificationLevel),verified:b.verified===undefined?!!previous.verified:!!b.verified,factKey:safe(b.factKey||previous.factKey||deriveFactKey({...previous,...b}))};const idx=qs.findIndex(q=>q.id===item.id);if(idx>=0)qs[idx]=item;else qs.push(item);writeJsonAtomic(QUESTIONS_FILE,qs);res.status(idx>=0?200:201).json({ok:true,question:item})});
app.delete('/api/admin/questions/:id',requireAdmin,(req,res)=>{const qs=questions(),next=qs.filter(q=>q.id!==req.params.id);if(next.length===qs.length)return res.sendStatus(404);writeJsonAtomic(QUESTIONS_FILE,next);res.json({ok:true})});

// Quiz 22.0: local, privacy-friendly QR code for room invitations.
app.get('/api/rooms/:code/qr.svg',async(req,res)=>{const code=safe(req.params.code);if(!/^\d{4}$/.test(code)||!rooms.has(code))return res.status(404).send('Room not found');try{const proto=safe(req.headers['x-forwarded-proto']).split(',')[0]||req.protocol||'https',host=safe(req.headers['x-forwarded-host']).split(',')[0]||req.get('host');const url=`${proto}://${host}/online.html?room=${code}`;const svg=await QRCode.toString(url,{type:'svg',errorCorrectionLevel:'M',margin:1,width:640});res.set({'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store'}).send(svg)}catch(e){res.status(500).send('QR generation failed')}});

io.on('connection',socket=>{
 socket.on('room:create',(payload={},ack=()=>{})=>{try{const code=String(Math.floor(1000+Math.random()*9000)),account=userFromToken(payload.userToken),host={id:socket.id,userId:account?.id||null,name:account?.displayName||safe(payload.name)||'Värd',avatar:'🙂',score:0,answered:false,team:safe(payload.team)};const count=Math.min(40,Math.max(3,Number(payload.count)||10)),difficulty=['easy','medium','hard'].includes(payload.difficulty)?payload.difficulty:'mixed';let qs=payload.category==='Barnquiz'?questionsForAge(payload.age,payload.topic):questions();if(payload.category&&payload.category!=='Barnquiz')qs=qs.filter(q=>q.category===payload.category);if(difficulty!=='mixed')qs=qs.filter(q=>q.difficulty===difficulty);const r={code,hostId:socket.id,phase:'lobby',questionIndex:-1,seconds:Math.min(90,Math.max(10,Number(payload.seconds)||30)),category:safe(payload.category),age:payload.category==='Barnquiz'?normalizeAge(payload.age):null,topic:payload.category==='Barnquiz'?normalizeTopic(payload.topic):'',difficulty,format:safe(payload.format)||'standard',locked:false,paused:false,party:!!payload.party,quiz:shuffle(qs).slice(0,count),players:new Map([[socket.id,host]]),answers:new Map(),timer:null,deadline:null};rooms.set(code,r);socket.join(code);ack({ok:true,room:publicRoom(r)});io.to(code).emit('room:update',publicRoom(r))}catch(e){ack({ok:false,error:e.message})}});
 socket.on('room:join',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});if(r.locked)return ack({ok:false,error:'Rummet är låst'});const account=userFromToken(payload.userToken),p={id:socket.id,userId:account?.id||null,name:account?.displayName||safe(payload.name)||'Gäst',avatar:'🙂',score:0,answered:false,team:safe(payload.team)};r.players.set(socket.id,p);socket.join(r.code);ack({ok:true,room:publicRoom(r)});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:display',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});socket.join(r.code);ack({ok:true,room:publicRoom(r)});if(r.phase==='question'&&r.questionIndex>=0){const q=r.quiz[r.questionIndex];socket.emit('room:question',{room:publicRoom(r),question:publicQuestion(q),deadline:r.deadline})}});
 socket.on('room:lock',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan låsa rummet'});r.locked=payload.locked!==false;ack({ok:true,room:publicRoom(r)});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:kick',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan ta bort spelare'});const id=safe(payload.playerId);if(id===r.hostId)return ack({ok:false,error:'Värden kan inte ta bort sig själv'});r.players.delete(id);io.sockets.sockets.get(id)?.leave(r.code);io.to(id).emit('room:kicked');ack({ok:true});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:pause',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan pausa'});r.paused=payload.paused!==false;ack({ok:true,room:publicRoom(r)});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:start',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan starta'});ack({ok:true});nextQuestion(r)});
 socket.on('room:answer',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||'')),p=r?.players.get(socket.id);if(!r||!p||r.phase!=='question')return ack({ok:false,error:'Ingen aktiv fråga'});if(p.answered)return ack({ok:false,error:'Redan svarat'});const q=r.quiz[r.questionIndex],answer=Number(payload.answerIndex),correct=answer===q.correct;p.answered=true;const remaining=Math.max(0,(r.deadline-Date.now())/1000);if(correct)p.score+=100+Math.round(remaining*5);r.answers.set(socket.id,{answer,correct});ack({ok:true});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:restart',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan starta om'});clearTimeout(r.timer);r.phase='lobby';r.questionIndex=-1;r.answers.clear();r.quiz=shuffle(r.quiz);for(const p of r.players.values()){p.score=0;p.answered=false}ack({ok:true,room:publicRoom(r)});io.to(r.code).emit('room:update',publicRoom(r))});
 socket.on('room:next',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r||r.hostId!==socket.id)return ack({ok:false,error:'Endast värden kan fortsätta'});ack({ok:true});nextQuestion(r)});
 socket.on('disconnect',()=>{for(const [code,r] of rooms){if(!r.players.has(socket.id))continue;r.players.delete(socket.id);if(!r.players.size){clearTimeout(r.timer);rooms.delete(code);continue}if(r.hostId===socket.id)r.hostId=[...r.players.keys()][0];io.to(code).emit('room:update',publicRoom(r))}});
});
function nextQuestion(r){clearTimeout(r.timer);r.questionIndex++;if(r.questionIndex>=r.quiz.length){r.phase='finished';const awards={};for(const p of r.players.values()){const saved=saveResult({id:crypto.randomUUID(),userId:p.userId||null,name:p.name,score:p.score,total:r.quiz.length*250,mode:'multiplayer',category:r.category,topic:r.topic,age:r.age,difficulty:r.difficulty,format:r.format,at:new Date().toISOString()});awards[p.id]=saved.awards||[]}io.to(r.code).emit('room:finished',{room:publicRoom(r),awards});return}r.phase='question';r.answers.clear();for(const p of r.players.values())p.answered=false;r.deadline=Date.now()+r.seconds*1000;const q=r.quiz[r.questionIndex];io.to(r.code).emit('room:question',{room:publicRoom(r),question:publicQuestion(q),deadline:r.deadline});r.timer=setTimeout(()=>reveal(r),r.seconds*1000)}
function reveal(r){if(r.phase!=='question')return;clearTimeout(r.timer);r.phase='reveal';const q=r.quiz[r.questionIndex];io.to(r.code).emit('room:reveal',{room:publicRoom(r),correctIndex:q.correct,explanation:q.explanation||'',answers:[...r.answers.entries()]})}
server.listen(PORT,HOST,()=>console.log(`Quiz ${VERSION} listening on http://${HOST}:${PORT}`));
