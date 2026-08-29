const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const crypto=require('crypto');
const ExcelJS=require('exceljs');

const app=express();
app.use(express.json({limit:'8mb'}));
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors 'self'");next()});
const rateBuckets=new Map();
function rateLimit(bucket,max,windowMs){return (req,res,next)=>{const now=Date.now(),ip=String(req.ip||req.socket.remoteAddress||'unknown'),k=bucket+':'+ip,x=rateBuckets.get(k)||{n:0,until:now+windowMs};if(now>x.until){x.n=0;x.until=now+windowMs}x.n++;rateBuckets.set(k,x);if(x.n>max)return res.status(429).json({ok:false,error:'För många försök. Vänta en stund.'});next()}}
setInterval(()=>{const now=Date.now();for(const [k,v] of rateBuckets)if(v.until<now)rateBuckets.delete(k)},10*60*1000).unref();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:true,credentials:true},pingTimeout:20000,pingInterval:25000});
const PORT=process.env.PORT||3000;
const PUBLIC=path.join(__dirname,'public');
const DATA_DIR=process.env.RESEQUIZ_DATA_DIR||'/var/lib/resequiz';
const HIGHSCORE_FILE=path.join(DATA_DIR,'highscores.json');
const CUSTOM_FILE=path.join(DATA_DIR,'custom-questions.json');
const PACK_FILE=path.join(DATA_DIR,'custom-packs.json');
const OVERRIDE_FILE=path.join(DATA_DIR,'question-overrides.json');
const MEDIA_DIR=path.join(DATA_DIR,'media');
const GAMES_FILE=path.join(DATA_DIR,'games.json');
const LEAGUE_FILE=path.join(DATA_DIR,'league.json');
const PLAN_FILE=path.join(DATA_DIR,'game-plans.json');
const TOURNAMENT_FILE=path.join(DATA_DIR,'tournaments.json');
const TITLES_FILE=path.join(DATA_DIR,'player-titles.json');
const QUESTION_METRICS_FILE=path.join(DATA_DIR,'question-metrics.json');
const ADMIN_KEY=String(process.env.RESEQUIZ_ADMIN_KEY||'').trim();

function ensureDataDir(){try{fs.mkdirSync(DATA_DIR,{recursive:true});fs.mkdirSync(MEDIA_DIR,{recursive:true})}catch{}}
function readJson(file,fallback){ensureDataDir();try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJson(file,data){ensureDataDir();const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file)}
function clean(s,n=40){return String(s||'').replace(/[<>]/g,'').trim().slice(0,n)}
function cleanId(s){return String(s||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)}
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const roomCode=()=>String(Math.floor(1000+Math.random()*9000));
const token=()=>crypto.randomBytes(24).toString('hex');
const AVATARS=['😀','😎','🤩','🥳','🤠','🦊','🐼','🐯','🦁','🐸','🦄','🤖','👻','🚀','⚽','🎸'];
const cleanAvatar=a=>AVATARS.includes(String(a||''))?String(a):'😀';

function loadBaseQuestions(){return JSON.parse(fs.readFileSync(path.join(__dirname,'data','questions.json'),'utf8'))}
function normalizeQuestion(q,i=0){
  const a=Array.isArray(q.a)?q.a.map(x=>String(x).slice(0,160)).slice(0,6):[];
  const r=Math.max(0,Math.min(a.length-1,Number(q.r)||0));
  return {
    id:cleanId(q.id)||`custom-${Date.now()}-${i}-${crypto.randomBytes(3).toString('hex')}`,
    c:clean(q.c||'Allmänbildning',50),q:clean(q.q,500),a,r,f:clean(q.f,700),
    d:['easy','medium','hard'].includes(q.d)?q.d:'medium',
    visual:clean(q.visual,300),audio:clean(q.audio,300),enabled:q.enabled!==false,specialType:clean(q.specialType,30),specialData:q.specialData&&typeof q.specialData==='object'?q.specialData:null,audioStart:Math.max(0,Number(q.audioStart)||0),audioDuration:Math.max(0,Math.min(120,Number(q.audioDuration)||0))
  };
}
const BASE_QUESTIONS=loadBaseQuestions();
function baseWithOverrides(includeDisabled=false){
  const overrides=readJson(OVERRIDE_FILE,{});
  return BASE_QUESTIONS.map((raw,i)=>normalizeQuestion({...raw,...(overrides[raw.id]||{}),id:raw.id},i)).filter(q=>includeDisabled||q.enabled!==false);
}
function allQuestions(){
  const base=baseWithOverrides(false);
  const custom=readJson(CUSTOM_FILE,[]).map((q,i)=>normalizeQuestion(q,i)).filter(x=>x.enabled!==false);
  const ids=new Set();
  return [...base,...custom].filter(q=>q.q&&q.a.length>=2&&!ids.has(q.id)&&ids.add(q.id));
}
function categoryCounts(qs=allQuestions()){return qs.reduce((m,q)=>{m[q.c]=(m[q.c]||0)+1;return m},{})}
function questionMetrics(){const x=readJson(QUESTION_METRICS_FILE,{});return x&&typeof x==='object'?x:{}}
function questionQuality(q,metrics=questionMetrics()){
 const m=metrics[q.id];if(!m||!m.plays)return 72;
 const accuracy=pct(m.correct,m.total),balance=100-Math.min(100,Math.abs(55-accuracy)*1.6),confidence=Math.min(100,m.plays*10),skipPenalty=Math.min(25,(m.skips||0)*3);
 return Math.max(0,Math.min(100,Math.round(balance*.65+confidence*.35-skipPenalty)));
}
function smartPick(pool,count,r){
 const metrics=questionMetrics(),safe=pool.filter(q=>!metrics[q.id]||metrics[q.id].plays<5||questionQuality(q,metrics)>=30),source=safe.length>=count?safe:pool;
 const byCat=new Map();
 for(const q of source){if(!byCat.has(q.c))byCat.set(q.c,[]);byCat.get(q.c).push({q,quality:questionQuality(q,metrics),rand:Math.random()})}
 for(const arr of byCat.values())arr.sort((a,b)=>(b.quality+b.rand*12)-(a.quality+a.rand*12));
 const cats=shuffle([...byCat.keys()]),chosen=[];let cursor=0,lastCat='';
 while(chosen.length<count&&cats.length){
   let found=-1;
   for(let step=0;step<cats.length;step++){const i=(cursor+step)%cats.length,c=cats[i];if(byCat.get(c)?.length&&(cats.length===1||c!==lastCat)){found=i;break}}
   if(found<0)found=cats.findIndex(c=>byCat.get(c)?.length);
   if(found<0)break;
   const c=cats[found],x=byCat.get(c).shift();chosen.push(x.q);lastCat=c;cursor=(found+1)%cats.length;
   if(!byCat.get(c).length){cats.splice(found,1);if(cats.length)cursor%=cats.length}
 }
 return chosen;
}
function updateQuestionMetrics(r){
 const m=questionMetrics();for(const q of r.questionStats||[]){const x=m[q.id]||(m[q.id]={plays:0,correct:0,total:0,skips:0,responseMs:0,responseCount:0,lastPlayedAt:null});x.plays++;x.correct+=q.correct||0;x.total+=q.total||0;x.skips+=q.skipped?1:0;if(q.avgResponseMs){x.responseMs+=q.avgResponseMs;x.responseCount++}x.lastPlayedAt=new Date().toISOString()}writeJson(QUESTION_METRICS_FILE,m)
}
function profileStrength(sessionId,name){const h=readHistory().filter(x=>(sessionId&&x.sessionId===sessionId)||(!sessionId&&x.name===name));if(!h.length)return 50;let c=0,t=0,w=0;for(const x of h){c+=x.correct||0;t+=x.total||0;w+=x.win?1:0}return Math.round((t?c/t*70:35)+Math.min(30,w*3))}
function balanceTeams(r){const names=r.teamNames.slice(0,Math.min(4,Math.max(2,r.teamNames.length))),scores=Object.fromEntries(names.map(n=>[n,0]));const ranked=r.players.map(p=>({p,strength:profileStrength(p.sessionId,p.name)})).sort((a,b)=>b.strength-a.strength);for(const x of ranked){const team=names.slice().sort((a,b)=>scores[a]-scores[b])[0];x.p.team=team;scores[team]+=x.strength}return scores}
function uniqueNickname(r,name,sid){const used=new Set(r.players.filter(p=>p.sessionId!==sid).map(p=>p.name.toLocaleLowerCase('sv-SE')));if(!used.has(name.toLocaleLowerCase('sv-SE')))return name;let i=2;while(used.has(`${name} ${i}`.toLocaleLowerCase('sv-SE')))i++;return `${name} ${i}`.slice(0,20)}


const BUILTIN_PACKS=[
 {id:'fredagsquiz',name:'Fredagsquiz',description:'Blandad allmänbildning för AW och fest.',categories:['Allmänbildning','Världen','Sverige','Film & TV','Musik','Sport'],difficulty:'mixed'},
 {id:'resor',name:'Resequiz',description:'Länder, huvudstäder, flaggor och resor.',categories:['Resor','Världen'],difficulty:'mixed'},
 {id:'fotboll',name:'Fotbollskväll',description:'Fotboll och sport.',categories:['Fotboll','Sport'],difficulty:'mixed'},
 {id:'nostalgi',name:'80/90/00-talet',description:'Nostalgi, musik, film och TV.',categories:['80/90/00-talet','Musik','Film & TV'],difficulty:'mixed'},
 {id:'onodigt',name:'Onödigt vetande',description:'Perfekt för skratt och chansningar.',categories:['Onödigt vetande'],difficulty:'mixed'},
 {id:'familj',name:'Familjequiz',description:'Lättare blandning för flera åldrar.',categories:['Allmänbildning','Djur & natur','Sverige','Världen'],difficulty:'easy'},
 {id:'bildrundan',name:'Bildrundan',description:'120 lokala bildfrågor med unika motiv.',categories:['Bildrunda'],difficulty:'mixed'},
 {id:'musikquiz',name:'Musik & melodier',description:'24 egenproducerade ljudklipp av public-domain melodier.',categories:['Musikquiz'],difficulty:'mixed'},
 {id:'game-night-mix',name:'Game Night Mix',description:'Blandning av allmänbildning, bilder och musik.',categories:['Allmänbildning','Världen','Sverige','Film & TV','Musik','Sport','Bildrunda','Musikquiz'],difficulty:'mixed'}
];

function allPacks(){return [...BUILTIN_PACKS,...readJson(PACK_FILE,[])]}
const BUILTIN_GAME_PLANS=[
 {id:'classic-night',name:'Klassisk quizkväll',description:'20 varierade frågor på cirka 30 minuter. Director sköter tempot.',rounds:[
  {name:'Uppvärmning',type:'classic',count:5,categories:['Allmänbildning','Sverige','Världen']},
  {name:'Bild & ljud',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'Blandat',type:'speed',count:5,categories:['Film & TV','Musik','Sport','Onödigt vetande']},
  {name:'Final',type:'buzzer',count:5,categories:['Allmänbildning','Världen','Historia','Vetenskap & teknik']}
 ]},
  {id:'ultimate',name:'Ultimate Quiz Show',description:'Full TV-show med bild, musik, mystery, risk, kartor, connections, sortering, duell och buzzer.',rounds:[
  {name:'Opening Round',type:'classic',count:5,categories:['Allmänbildning','Världen','Sverige','Film & TV','Sport']},
  {name:'Bildzoom',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'Music Live',type:'classic',count:4,categories:['Musikquiz']},
  {name:'Mystery Round',type:'mystery',count:4,categories:['Allmänbildning','Historia','Sport','Film & TV']},
  {name:'Connections',type:'connections',count:3,categories:[]},
  {name:'Sortera!',type:'sort',count:3,categories:[]},
  {name:'Var i världen?',type:'map',count:4,categories:[]},
  {name:'Prickskytten',type:'pin',count:3,categories:[]},
  {name:'Jackpot',type:'jackpot',count:4,categories:['Allmänbildning','Historia','Vetenskap & teknik','Resor']},
  {name:'Duellen',type:'duel',count:3,categories:['Allmänbildning','Världen','Sport']},
  {name:'Buzzerfinal',type:'buzzer',count:5,categories:['Allmänbildning','Världen','Sport','Film & TV','Musik']}
 ]},
 {id:'resequiz-night',name:'Rese quiz',description:'En resa runt världen med resmål, geografi, kartor, risk och buzzerfinal.',rounds:[
  {name:'Packa väskan',type:'classic',count:5,categories:['Resor','Världen']},
  {name:'Jorden runt',type:'speed',count:5,categories:['Resor','Världen']},
  {name:'Var i världen?',type:'map',count:4,categories:[]},
  {name:'Våga resa',type:'risk',count:4,categories:['Resor','Världen']},
  {name:'Buzzerfinal',type:'buzzer',count:4,categories:['Resor','Världen']}
 ]},
 {id:'journey-night',name:'På väg',description:'Lugnt och pausvänligt för tåg, buss, flyg och bilpassagerare. 30 varierade frågor, ingen TV behövs.',journey:true,rounds:[
  {name:'Rulla iväg',type:'classic',count:5,categories:['Allmänbildning','Sverige','Världen']},
  {name:'Ut genom fönstret',type:'classic',count:5,categories:['Resor','Världen','Djur & natur']},
  {name:'Bildpaus',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'Tänk tillsammans',type:'connections',count:3,categories:[]},
  {name:'Klura på vägen',type:'clue',count:5,categories:['Historia','Vetenskap & teknik','Onödigt vetande']},
  {name:'Sista sträckan',type:'classic',count:7,categories:['Allmänbildning','Film & TV','Musik','Sport','Resor']}
 ]},
 {id:'family-night',name:'Familjekväll',description:'Lugnare tempo, lättare frågor och utan minuspoäng.',family:true,rounds:[
  {name:'Blandat',type:'classic',count:5,categories:['Allmänbildning','Djur & natur','Sverige','Världen']},
  {name:'Bildzoom',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'Musik',type:'classic',count:5,categories:['Musikquiz']}
 ]},
 {id:'quick-night',name:'Snabbquiz',description:'Kortare quizkväll med tempo, risk och buzzer.',rounds:[
  {name:'Quickfire',type:'speed',count:5,categories:['Allmänbildning','Onödigt vetande','Film & TV','Musik']},
  {name:'Risk',type:'risk',count:3,categories:['Världen','Historia','Sport']},
  {name:'Buzzer',type:'buzzer',count:2,categories:['Allmänbildning','Fotboll','Musik','Film & TV']}
 ]}
];

function allGamePlans(){return [...BUILTIN_GAME_PLANS,...readJson(PLAN_FILE,[])]}
const CONNECTION_QUESTIONS=[
 {id:'conn-1',c:'Connections',q:'Vad har ABBA, IKEA, Volvo och Spotify gemensamt?',a:['De är svenska','De grundades på 1800-talet','De är bilmärken','De är banker'],r:0,f:'Alla fyra har svenskt ursprung.'},
 {id:'conn-2',c:'Connections',q:'Vad förenar Madrid, Rom, Paris och Berlin?',a:['Europeiska huvudstäder','Alla ligger vid havet','Alla har euro','Alla ligger norr om Sverige'],r:0,f:'Alla är huvudstäder i Europa.'},
 {id:'conn-3',c:'Connections',q:'Vad förenar Mercury, Venus, Earth och Mars?',a:['De fyra innersta planeterna','Jupiters månar','Stjärnor','Grundämnen'],r:0,f:'Det är solsystemets fyra innersta planeter.'},
 {id:'conn-4',c:'Connections',q:'Vad förenar Wimbledon, Roland-Garros, US Open och Australian Open?',a:['Tennisens Grand Slam-turneringar','Golfmajors','Formel 1-lopp','Fotbollscuper'],r:0,f:'De är de fyra Grand Slam-turneringarna i tennis.'},
 {id:'conn-5',c:'Connections',q:'Vad förenar Nile, Amazon, Yangtze och Mississippi?',a:['Stora floder','Öknar','Bergskedjor','Hav'],r:0,f:'Alla är stora floder.'}
].map(q=>({...q,d:'medium',visual:'',audio:'',enabled:true,specialType:'connections'}));
const SORT_QUESTIONS=[
 {id:'sort-1',c:'Historia',q:'Sortera händelserna från äldst till nyast.',specialData:{items:['Månlandningen Apollo 11','Berlinmurens fall','Spotify lanseras','ChatGPT lanseras'],correct:['Månlandningen Apollo 11','Berlinmurens fall','Spotify lanseras','ChatGPT lanseras']},a:['Klar'],r:0,f:'1969 → 1989 → 2008 → 2022'},
 {id:'sort-2',c:'Historia',q:'Sortera från äldst till nyast.',specialData:{items:['Franska revolutionen','Första världskriget','Andra världskriget','Euro introduceras'],correct:['Franska revolutionen','Första världskriget','Andra världskriget','Euro introduceras']},a:['Klar'],r:0,f:'1789 → 1914 → 1939 → 1999'},
 {id:'sort-3',c:'Teknik',q:'Sortera teknikerna från äldst till nyast.',specialData:{items:['Telefon','Radio','TV','Internet'],correct:['Telefon','Radio','TV','Internet']},a:['Klar'],r:0,f:'Telefon → radio → TV → internet'}
].map(q=>({...q,d:'medium',visual:'',audio:'',enabled:true,specialType:'sort'}));
const MAP_QUESTIONS=[
 ['Stockholm',59.3293,18.0686],['London',51.5074,-0.1278],['Paris',48.8566,2.3522],['Madrid',40.4168,-3.7038],['Rome',41.9028,12.4964],
 ['Tokyo',35.6762,139.6503],['New York',40.7128,-74.0060],['Buenos Aires',-34.6037,-58.3816],['Sydney',-33.8688,151.2093],['Cape Town',-33.9249,18.4241],
 ['Cairo',30.0444,31.2357],['Bangkok',13.7563,100.5018],['Reykjavik',64.1466,-21.9426],['Mexico City',19.4326,-99.1332],['Nairobi',-1.2921,36.8219]
].map((x,i)=>({id:`map-${i+1}`,c:'Världen',q:`Peka på kartan: Var ligger ${x[0]}?`,a:['Klar'],r:0,f:`${x[0]} ligger ungefär vid ${x[1].toFixed(1)}°, ${x[2].toFixed(1)}°.`,d:'medium',visual:'',audio:'',enabled:true,specialType:'map',specialData:{name:x[0],lat:x[1],lon:x[2]}}));
const PIN_QUESTIONS=[{"id":"pin-1","c":"Bildrunda","q":"Markera den röda stjärnan i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den röda stjärnan.","d":"medium","visual":"media-packs/pin/red-star.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.72,"y":0.28}},{"id":"pin-2","c":"Bildrunda","q":"Markera den blå cirkeln i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den blå cirkeln.","d":"medium","visual":"media-packs/pin/blue-circle.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.22,"y":0.68}},{"id":"pin-3","c":"Bildrunda","q":"Markera den gula triangeln i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den gula triangeln.","d":"medium","visual":"media-packs/pin/yellow-triangle.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.55,"y":0.6}},{"id":"pin-4","c":"Bildrunda","q":"Markera den gröna kvadraten i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den gröna kvadraten.","d":"medium","visual":"media-packs/pin/green-square.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.35,"y":0.3}},{"id":"pin-5","c":"Bildrunda","q":"Markera den lila diamanten i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den lila diamanten.","d":"medium","visual":"media-packs/pin/purple-diamond.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.8,"y":0.72}},{"id":"pin-6","c":"Bildrunda","q":"Markera den orange ringen i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den orange ringen.","d":"medium","visual":"media-packs/pin/orange-ring.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.18,"y":0.22}},{"id":"pin-7","c":"Bildrunda","q":"Markera det vita korset i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var det vita korset.","d":"medium","visual":"media-packs/pin/white-cross.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.62,"y":0.18}},{"id":"pin-8","c":"Bildrunda","q":"Markera den turkosa pilen i bilden.","a":["Klar"],"r":0,"f":"Rätt markering var den turkosa pilen.","d":"medium","visual":"media-packs/pin/cyan-arrow.png","audio":"","enabled":true,"specialType":"pin","specialData":{"x":0.45,"y":0.78}}];
function specialPool(type){if(type==='connections')return CONNECTION_QUESTIONS;if(type==='sort')return SORT_QUESTIONS;if(type==='map')return MAP_QUESTIONS;if(type==='pin')return PIN_QUESTIONS;return []}



function freshStats(){return {correct:0,total:0,streak:0,bestStreak:0,visualCorrect:0,visualTotal:0,uselessCorrect:0,uselessTotal:0,responseTotalMs:0,responseCount:0,riskWon:0,riskLost:0,buzzWins:0,powerupsUsed:0,categories:{}}}
function pct(n,d){return d?Math.round(n/d*100):0}
function readHistory(){const x=readJson(HIGHSCORE_FILE,[]);return Array.isArray(x)?x:[]}
function writeHistory(h){writeJson(HIGHSCORE_FILE,h.slice(-10000))}
function hallOfFame(){
 const h=readHistory(),by={};
 for(const e of h){const k=(e.sessionId||e.name||'').toLowerCase();const a=by[k]||(by[k]={sessionId:e.sessionId,name:e.name,avatar:e.avatar||'😀',games:0,wins:0,totalScore:0,bestScore:0,correct:0,total:0,bestStreak:0,visualCorrect:0,visualTotal:0,responseTotalMs:0,responseCount:0,categories:{}});a.games++;a.wins+=e.win?1:0;a.totalScore+=e.score||0;a.bestScore=Math.max(a.bestScore,e.score||0);a.correct+=e.correct||0;a.total+=e.total||0;a.bestStreak=Math.max(a.bestStreak,e.bestStreak||0);a.visualCorrect+=e.visualCorrect||0;a.visualTotal+=e.visualTotal||0;a.responseTotalMs+=e.responseTotalMs||0;a.responseCount+=e.responseCount||0;for(const [c,v] of Object.entries(e.categories||{})){const z=a.categories[c]||(a.categories[c]={correct:0,total:0});z.correct+=v.correct||0;z.total+=v.total||0}}
 const all=Object.values(by).map(a=>({...a,accuracy:pct(a.correct,a.total),avgResponseMs:a.responseCount?Math.round(a.responseTotalMs/a.responseCount):null}));
 const best=(arr,cmp)=>arr.slice().sort(cmp).slice(0,10);
 return {games:new Set(h.map(x=>x.gameId)).size,players:all.length,highestScores:best(all,(a,b)=>b.bestScore-a.bestScore),mostWins:best(all,(a,b)=>b.wins-a.wins),bestAccuracy:best(all.filter(a=>a.total>=10),(a,b)=>b.accuracy-a.accuracy),bestStreak:best(all,(a,b)=>b.bestStreak-a.bestStreak),fastest:best(all.filter(a=>a.responseCount>=5),(a,b)=>a.avgResponseMs-b.avgResponseMs),lastGames:h.slice(-20).reverse()};
}

function achievementsFor(r,p){
 const a=[],acc=p.stats.total?Math.round(p.stats.correct/p.stats.total*100):0,avg=p.stats.responseCount?Math.round(p.stats.responseTotalMs/p.stats.responseCount):999999;
 if(p.stats.bestStreak>=10)a.push({id:'on-fire',icon:'🔥',name:'On Fire',text:'10+ rätt i rad'});
 if(p.stats.bestStreak>=5)a.push({id:'streak',icon:'⚡',name:'Streak Master',text:'5+ rätt i rad'});
 if(acc===100&&p.stats.total>=5)a.push({id:'perfect',icon:'💯',name:'Perfekt',text:'100 % rätt'});
 if(avg<3500&&p.stats.responseCount>=5)a.push({id:'lightning',icon:'🚀',name:'Blixten',text:'Supersnabba svar'});
 if(p.stats.visualTotal>=3&&p.stats.visualCorrect===p.stats.visualTotal)a.push({id:'eagle-eye',icon:'🖼️',name:'Örnögat',text:'Alla bildfrågor rätt'});
 if(p.stats.riskWon>=2)a.push({id:'high-roller',icon:'🎲',name:'High Roller',text:'Lyckades med flera riskfrågor'});
 if(p.stats.buzzWins>=2)a.push({id:'buzzer',icon:'🔔',name:'Buzzer Boss',text:'Vann flera buzzerfrågor'});
 if(p.stats.categories?.Fotboll?.correct>=5)a.push({id:'football-nerd',icon:'⚽',name:'Fotbollsnörden',text:'5 rätt i Fotboll'});if((p.stats.categories?.Musik?.correct||0)+(p.stats.categories?.Musikquiz?.correct||0)>=5)a.push({id:'music-guru',icon:'🎵',name:'Musikgurun',text:'5 musikrätt'});if(p.stats.powerupsUsed>=2)a.push({id:'tactician',icon:'🧠',name:'Taktikern',text:'Använde power-ups smart'});
 return a;
}
function updateLeague(r){
 const table=readJson(LEAGUE_FILE,{});
 const winnerTeam=r.mode==='teams'?(teamStandings(r)[0]?.name||''):'';
 const top=Math.max(...r.players.map(p=>p.score));
 for(const p of r.players){const k=p.sessionId||p.name.toLowerCase(),x=table[k]||(table[k]={name:p.name,avatar:p.avatar,games:0,wins:0,points:0,correct:0,total:0});x.name=p.name;x.avatar=p.avatar;x.games++;x.wins+=(r.mode==='teams'?p.team===winnerTeam:p.score===top)?1:0;x.points+=p.score;x.correct+=p.stats.correct;x.total+=p.stats.total}
 writeJson(LEAGUE_FILE,table);
}
function updateTournament(r){
 const id=cleanId(r.settings?.tournament);if(!id)return;
 const all=readJson(TOURNAMENT_FILE,[]),t=all.find(x=>x.id===id);if(!t)return;
 t.standings=t.standings||{};const top=Math.max(...r.players.map(p=>p.score)),winningTeam=r.mode==='teams'?(teamStandings(r)[0]?.name||''):'';
 for(const p of r.players){const k=p.sessionId||p.name.toLowerCase(),x=t.standings[k]||(t.standings[k]={name:p.name,avatar:p.avatar,games:0,wins:0,points:0});x.name=p.name;x.avatar=p.avatar;x.games++;x.points+=p.score;x.wins+=(r.mode==='teams'?p.team===winningTeam:p.score===top)?1:0}
 t.updatedAt=new Date().toISOString();writeJson(TOURNAMENT_FILE,all);
}
function gameHighlights(r){
 const ev=(r.events||[]),byGain=ev.slice().sort((a,b)=>b.gain-a.gain)[0],byLoss=ev.slice().sort((a,b)=>a.gain-b.gain)[0],players=Object.fromEntries(r.players.map(p=>[p.sessionId,p]));
 return {biggestWin:byGain?{name:players[byGain.sessionId]?.name||'',gain:byGain.gain,type:byGain.type}:null,biggestLoss:byLoss&&byLoss.gain<0?{name:players[byLoss.sessionId]?.name||'',gain:byLoss.gain,type:byLoss.type}:null,secretBonus:ev.find(x=>x.secretBonus)?true:false,comeback:gameInsights(r).comeback||null};
}
function persistDetailedGame(r,gameId){
 const games=readJson(GAMES_FILE,[]);
 games.push({gameId,at:new Date().toISOString(),code:r.code,mode:r.mode,settings:r.settings,players:r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar,team:p.team,score:p.score,stats:p.stats,achievements:achievementsFor(r,p)})),teams:teamStandings(r),questionStats:r.questionStats,events:r.events||[],insights:gameInsights(r),highlights:gameHighlights(r)});
 writeJson(GAMES_FILE,games.slice(-300));updateLeague(r);updateTournament(r);
}
function persistGame(r){
 const h=readHistory(), top=Math.max(...r.players.map(p=>p.score)), winningTeam=r.mode==='teams'?(teamStandings(r)[0]?.name||''):'' ,gameId=`${Date.now()}-${r.code}`;
 for(const p of r.players)h.push({gameId,at:new Date().toISOString(),sessionId:p.sessionId,name:p.name,avatar:p.avatar,score:p.score,win:r.mode==='teams'?p.team===winningTeam:p.score===top,correct:p.stats.correct,total:p.stats.total,bestStreak:p.stats.bestStreak,visualCorrect:p.stats.visualCorrect,visualTotal:p.stats.visualTotal,responseTotalMs:p.stats.responseTotalMs,responseCount:p.stats.responseCount,categories:p.stats.categories});
 writeHistory(h);persistDetailedGame(r,gameId);updateQuestionMetrics(r);
}

const rooms=new Map(),timers=new Map(),directorTimers=new Map();

function findPlayer(r,sid){return r.players.find(p=>p.sessionId===sid)}
function clearTimer(r){const t=timers.get(r.code);if(t){clearTimeout(t);timers.delete(r.code)}const d=directorTimers.get(r.code);if(d){clearTimeout(d);directorTimers.delete(r.code)}}
function teamStandings(r){const m=new Map();for(const p of r.players){if(!p.team)continue;const x=m.get(p.team)||{name:p.team,totalScore:0,score:0,players:0};x.totalScore+=p.score;x.players++;m.set(p.team,x)}for(const x of m.values())x.score=r.settings?.teamScoring==='sum'?x.totalScore:Math.round(x.totalScore/Math.max(1,x.players));return [...m.values()].sort((a,b)=>b.score-a.score||b.totalScore-a.totalScore||a.name.localeCompare(b.name))}
function roomPublic(r){return {code:r.code,phase:r.phase,hostSessionId:r.hostSessionId,mode:r.mode,teamNames:r.teamNames,teams:teamStandings(r),buzzerWinner:r.buzzerWinner||'',players:r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar,team:p.team||'',score:p.score,connected:p.connected,powerups:p.powerups||{},stats:{correct:p.stats.correct,total:p.stats.total,bestStreak:p.stats.bestStreak},captain:!!p.captain,profileStrength:profileStrength(p.sessionId,p.name)})),teamPowerups:r.teamPowerups||{},settings:r.settings,currentQuestion:['question','paused'].includes(r.phase)?r.currentPublic:null,round:r.round,rounds:r.rounds,questionStats:r.questionStats,paused:r.paused,meta:{questions:allQuestions().length,categories:categoryCounts(),maxPlayers:100,packs:allPacks(),gamePlans:allGamePlans(),tournaments:readJson(TOURNAMENT_FILE,[]).filter(t=>t.active!==false).map(t=>({id:t.id,name:t.name}))}}}
function emitRoom(r){io.to(r.code).emit('roomState',roomPublic(r))}
function makeRoom(name,sid){let c;do c=roomCode();while(rooms.has(c));const r={code:c,hostToken:token(),hostSessionId:sid,phase:'lobby',mode:'individual',teamNames:['Lag 1','Lag 2'],players:[{sessionId:sid,name,avatar:'😀',team:'',score:0,connected:true,socketId:null,stats:freshStats(),roundScores:[],powerups:{fifty:1,double:1,shield:1}}],deck:[],index:0,answers:new Map(),seen:new Set(),settings:{count:20,timer:15,difficulty:'mixed',categories:[],roundSize:5,finalBonusCount:5,pack:'',screenMode:'all',gamePlan:'',profile:'ultimate',powerups:true,teamScoring:'average',director:true,drama:true,autoTeams:true,teamPowerups:true},round:1,rounds:4,current:null,currentPublic:null,questionStartedAt:0,questionStats:[],paused:false,persisted:false,tiebreak:false,lastResult:null,lastGameOver:null,buzzerWinner:'',roundName:'',midRanks:null,events:[]};rooms.set(c,r);return r}

function selectDeck(r,s){
 const qs=allQuestions(),plan=allGamePlans().find(x=>x.id===s.gamePlan);
 if(plan){
   const deck=[];let roundIndex=0;
   for(const round of plan.rounds||[]){roundIndex++;let pool=specialPool(round.type).filter(q=>!r.seen.has(q.id));if(!pool.length)pool=qs.filter(q=>!r.seen.has(q.id));if(round.categories?.length)pool=pool.filter(q=>round.categories.includes(q.c));if(round.difficulty&&round.difficulty!=='mixed')pool=pool.filter(q=>q.d===round.difficulty);for(const q of smartPick(pool,Math.max(1,+round.count||5),r))deck.push({...q,_forcedType:round.type||q.specialType||'classic',_roundName:round.name||`Runda ${roundIndex}`,_roundIndex:roundIndex})}
   return deck.slice(0,200);
 }
 let pool=qs;
 const pack=allPacks().find(p=>p.id===s.pack);
 let cats=Array.isArray(s.categories)?s.categories:[],diff=s.difficulty;
 if(pack){if(!cats.length)cats=pack.categories||[];if(!diff||diff==='mixed')diff=pack.difficulty||'mixed'}
 if(cats.length)pool=pool.filter(q=>cats.includes(q.c));
 if(diff&&diff!=='mixed')pool=pool.filter(q=>q.d===diff);
 const fresh=pool.filter(q=>!r.seen.has(q.id));
 const count=Math.min(Math.max(5,+s.count||20),200,fresh.length);
 return smartPick(fresh,count,r);
}
function questionTypeFor(r,q){
 if(r.tiebreak)return r.settings?.soloMode?'speed':'buzzer';
 if(r.settings.profile==='family')return 'classic';
 if(q._forcedType==='mystery'){const a=['truefalse','speed','risk','classic'];return a[Math.floor(Math.random()*a.length)]}
 if(q._forcedType){if(r.settings?.soloMode&&['duel','buzzer'].includes(q._forcedType))return 'speed';return q._forcedType;}
 if(r.settings.profile!=='ultimate')return 'classic';
 const n=r.index+1;
 if(n%11===0)return 'buzzer';
 if(n%7===0)return 'risk';
 if(n%9===0)return 'speed';
 if(n%5===0)return 'truefalse';
 return 'classic';
}
function publicQuestion(r,q,opts){
 const finalStart=Math.max(0,r.deck.length-(r.settings.finalBonusCount||0)),multiplier=r.index>=finalStart?2:1,type=r.currentType||'classic';
 const correct=String(q.a[q.r]??'');const clues=type==='clue'?[`Kategori: ${q.c}`,`Svaret har ${correct.length} tecken`,`Första bokstaven är ${correct.charAt(0).toUpperCase()}`]:[];
 return {id:q.id,number:r.index+1,total:r.deck.length,round:r.round,rounds:r.rounds,roundName:r.roundName||q._roundName||`Runda ${r.round}`,category:q.c,difficulty:q.d==='easy'?'Lätt':q.d==='hard'?'Svår':'Medel',timer:r.settings.timer,visual:q.visual||'',audio:q.audio||'',text:r.displayText||q.q,options:['text','estimate','clue','sort','map','pin'].includes(type)?[]:opts.map(o=>o.label),multiplier,tiebreak:r.tiebreak,type,riskOptions:[100,250,500],clues,specialData:q.specialData||null,audioStart:q.audioStart||0,audioDuration:q.audioDuration||0,duelists:r.duelists||[],jackpot:r.jackpot||0,mystery:q._forcedType==='mystery',recordNote:(()=>{const leader=r.players.slice().sort((a,b)=>b.score-a.score)[0],streak=r.players.slice().sort((a,b)=>b.stats.bestStreak-a.stats.bestStreak)[0];if(streak?.stats?.streak>=5)return `🔥 ${streak.name} har ${streak.stats.streak} rätt i rad!`;if(leader&&r.index>0)return `👑 ${leader.name} leder med ${leader.score} poäng`;return ''})(),buzzerWinner:r.buzzerWinner||''};
}
function startRoundQuestion(r){
 clearTimer(r);
 if(r.index>=r.deck.length)return finishGame(r);
 r.answers=new Map();r.predictions=new Map();r.buzzerTried=new Set();r.phase='question';r.paused=false;r.buzzerWinner='';r.jackpot=(r.jackpot||0)+100;
 const q=r.deck[r.index];r.currentType=questionTypeFor(r,q);const candidates=r.players.filter(p=>p.connected);r.duelists=r.currentType==='duel'?shuffle(candidates).slice(0,Math.min(2,candidates.length)).map(p=>p.sessionId):[];r.round=q._roundIndex||r.round;r.roundName=q._roundName||`Runda ${r.round}`;
 let opts,displayText=q.q;
 if(r.currentType==='truefalse'){
   const proposeCorrect=Math.random()<.5,idx=proposeCorrect?q.r:q.a.map((_,i)=>i).filter(i=>i!==q.r)[Math.floor(Math.random()*(q.a.length-1))];
   const proposition=q.a[idx];displayText=`Är detta rätt svar på frågan "${q.q}"? — ${proposition}`;opts=[{label:'Sant',correct:idx===q.r},{label:'Falskt',correct:idx!==q.r}];
 }else opts=shuffle(q.a.map((label,i)=>({label,correct:i===q.r})));
 r.displayText=displayText;r.current={...q,opts};r.currentPublic=publicQuestion(r,q,opts);r.questionStartedAt=Date.now();
 emitRoom(r);io.to(r.code).emit('question',r.currentPublic);
 if(r.settings.timer>0)timers.set(r.code,setTimeout(()=>settleQuestion(r),r.settings.timer*1000+900));
}
function dramaMoment(r,results,correctCount){
 if(!r.settings?.drama)return null;const active=Math.max(1,results.filter(x=>!x.spectator).length),pctRight=Math.round(correctCount/active*100),rank=r.players.slice().sort((a,b)=>b.score-a.score),lead=rank[0],second=rank[1];
 let d=null;if(r.settings?.soloMode){const p=rank[0];if(p?.stats?.streak>=5)d={icon:'🔥',title:`${p.stats.streak} rätt i rad!`,text:'Du är inne i ett riktigt bra flyt.'};else if(correctCount===0)d={icon:'💪',title:'Nästa tar du!',text:'Director fortsätter med nästa utmaning.'};if(d){d.at=Date.now();r.events.push({at:d.at,type:'drama',...d});io.to(r.code).emit('drama',d)}return d;}const previousLeader=r.lastLeader||'';const newLeader=lead?.sessionId||'';if(previousLeader&&newLeader&&previousLeader!==newLeader)d={icon:'👑',title:'Ny ledare!',text:`${lead.name} har tagit över förstaplatsen.`};else if(correctCount===0)d={icon:'💀',title:'Ingen klarade den!',text:'Brutal fråga.'};else if(correctCount===1){const one=results.find(x=>x.correct),p=findPlayer(r,one?.sessionId);d={icon:'🎯',title:'Ensam om rätt svar!',text:p?`${p.name} var den enda som klarade frågan.`:''}}else if(pctRight===100)d={icon:'🧠',title:'Full pott!',text:'Alla svarade rätt.'};else if(lead&&second&&lead.score-second.score<=100)d={icon:'⚔️',title:'Det är extremt jämnt!',text:`Bara ${lead.score-second.score} poäng skiljer ettan och tvåan.`};else{const hot=rank.find(p=>p.stats.streak>=5);if(hot)d={icon:'🔥',title:`${hot.stats.streak} rätt i rad!`,text:`${hot.name} är glödhet.`}}
 r.lastLeader=newLeader;if(d){d.at=Date.now();r.events.push({at:d.at,type:'drama',...d});io.to(r.code).emit('drama',d)}return d
}
function directorSchedule(r,phase){if(!r.settings?.director)return;const old=directorTimers.get(r.code);if(old)clearTimeout(old);const close=(()=>{const rank=r.players.slice().sort((a,b)=>b.score-a.score);return rank[1]&&rank[0].score-rank[1].score<=150})();const ms=phase==='result'?(close?6500:5200):phase==='roundBreak'?8000:0;if(!ms)return;directorTimers.set(r.code,setTimeout(()=>{directorTimers.delete(r.code);if(phase==='result'&&r.phase==='result')advance(r);else if(phase==='roundBreak'&&r.phase==='roundBreak')startRoundQuestion(r)},ms))}
function settleQuestion(r,{skipped=false}={}){
 if(!['question','paused'].includes(r.phase)||!r.current)return;
 clearTimer(r);const q=r.current,correctIndex=q.opts.findIndex(o=>o.correct),results=[],secretBonus=r.secretBonusIndex===r.index,mult=(r.currentPublic.multiplier||1)*(secretBonus?3:1),jackpotValue=r.jackpot||0;
 let correctCount=0,responseSum=0,responseCount=0;
 const norm=x=>String(x??'').trim().toLocaleLowerCase('sv-SE').replace(/[.!?]/g,'');
 const correctText=String(q.a[q.r]??''),correctNumber=parseFloat(correctText.replace(',','.'));
 const estimateDistances=r.currentType==='estimate'&&Number.isFinite(correctNumber)?r.players.map(p=>{const a=r.answers.get(p.sessionId),n=parseFloat(String(a?.numericAnswer??'').replace(',','.'));return Number.isFinite(n)?Math.abs(n-correctNumber):Infinity}):[];
 const estimateMin=estimateDistances.length?Math.min(...estimateDistances):Infinity;
 for(const p of r.players){
   const eligible=(!r.tiebreak||!r.tiebreakEligible||r.tiebreakEligible.has(p.sessionId))&&(r.currentType!=='duel'||r.duelists.includes(p.sessionId));
   const ans=r.answers.get(p.sessionId);let ok=eligible&&!skipped&&!!ans;
   if(ok&&r.currentType==='text')ok=norm(ans.textAnswer)===norm(correctText);
   else if(ok&&r.currentType==='clue')ok=norm(ans.textAnswer)===norm(correctText);
   else if(ok&&r.currentType==='estimate'){const n=parseFloat(String(ans.numericAnswer??'').replace(',','.'));ok=Number.isFinite(n)&&Math.abs(n-correctNumber)===estimateMin}
   else if(ok&&r.currentType==='sort'){ok=JSON.stringify(ans.order||[])===JSON.stringify(q.specialData?.correct||[])}
   else if(ok&&r.currentType==='map'){const lat=+ans.mapLat,lon=+ans.mapLon,tlat=+q.specialData?.lat,tlon=+q.specialData?.lon;const dlat=(lat-tlat)*Math.PI/180,dlon=(lon-tlon)*Math.PI/180,a=Math.sin(dlat/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(tlat*Math.PI/180)*Math.sin(dlon/2)**2;ans.distanceKm=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));ok=Number.isFinite(ans.distanceKm)}
   else if(ok&&r.currentType==='pin'){const dx=(+ans.pinX-(+q.specialData?.x)),dy=(+ans.pinY-(+q.specialData?.y));ans.pinDistance=Math.sqrt(dx*dx+dy*dy);ok=Number.isFinite(ans.pinDistance)}
   else if(ok&&r.currentType==='duel'){ok=r.duelists.includes(p.sessionId)&&ans.answerIndex===correctIndex}
   else if(ok)ok=ans.answerIndex===correctIndex;
   let gain=0;
   const st=p.stats||(p.stats=freshStats());const cs=st.categories[q.c]||(st.categories[q.c]={correct:0,total:0});
   if(!eligible||(r.currentType==='buzzer'&&!ans)){results.push({sessionId:p.sessionId,correct:false,gain:0,responseMs:null,spectator:true});continue}
   if(!skipped){st.total++;cs.total++;if(q.visual)st.visualTotal++;if(q.c==='Onödigt vetande')st.uselessTotal++}
   if(ans?.responseMs>=0){st.responseTotalMs+=ans.responseMs;st.responseCount++;responseSum+=ans.responseMs;responseCount++}
   if(ok){
     const base=q.d==='hard'?200:q.d==='medium'?150:100;
     if(r.currentType==='risk'){gain=Math.max(100,Math.min(500,+ans?.stake||100));st.riskWon++}
     else if(r.currentType==='buzzer'){gain=300;st.buzzWins++}
     else if(r.currentType==='speed'){gain=base+Math.max(0,100-Math.floor((ans?.responseMs||10000)/100))}
     else if(r.currentType==='estimate'){gain=250}
     else if(r.currentType==='clue'){gain=Math.max(75,300-(+ans?.cluesUsed||0)*75)}
     else if(r.currentType==='text'){gain=200}
     else if(r.currentType==='sort'){gain=300}
     else if(r.currentType==='map'){gain=Math.max(50,Math.round(350-Math.min(300,(ans.distanceKm||3000)/5)))}
     else if(r.currentType==='pin'){gain=Math.max(50,Math.round(350-Math.min(300,(ans.pinDistance||1)*500)))}
     else if(r.currentType==='duel'){gain=350}
     else if(r.currentType==='jackpot'){gain=Math.max(500,jackpotValue||500)}
     else gain=base;
     if(ans?.double){gain*=2}
     gain*=mult;p.score+=gain;st.correct++;cs.correct++;st.streak++;st.bestStreak=Math.max(st.bestStreak,st.streak);if(q.visual)st.visualCorrect++;correctCount++;
   }else if(!skipped){
     st.streak=0;
     if(r.currentType==='risk'){const loss=Math.max(100,Math.min(500,+ans?.stake||100));if(ans?.shield){}else{gain=-loss;p.score+=gain;st.riskLost++}}
     else if(r.currentType==='buzzer'&&ans){gain=-100;p.score+=gain}
   }
   results.push({sessionId:p.sessionId,correct:ok,gain,responseMs:ans?.responseMs??null,mapLat:Number.isFinite(ans?.mapLat)?ans.mapLat:null,mapLon:Number.isFinite(ans?.mapLon)?ans.mapLon:null,distanceKm:Number.isFinite(ans?.distanceKm)?Math.round(ans.distanceKm):null,pinX:Number.isFinite(ans?.pinX)?ans.pinX:null,pinY:Number.isFinite(ans?.pinY)?ans.pinY:null,pinDistance:Number.isFinite(ans?.pinDistance)?ans.pinDistance:null});
 }
 if(r.currentType==='jackpot'&&correctCount>0)r.jackpot=0;const actualPct=pct(correctCount,Math.max(1,r.currentType==='duel'?r.duelists.length:r.players.length));for(const p of r.players){const pred=r.settings?.soloMode?null:r.predictions?.get(p.sessionId);if(Number.isFinite(pred)&&Math.abs(pred-actualPct)<=15){p.score+=50;const rr=results.find(x=>x.sessionId===p.sessionId);if(rr){rr.predictionBonus=50;rr.gain+=50}}}
 r.events.push(...results.filter(x=>x.gain).map(x=>({at:Date.now(),questionId:q.id,type:r.currentType,sessionId:x.sessionId,gain:x.gain,secretBonus})));r.questionStats.push({id:q.id,text:q.q,type:r.currentType,round:r.round,correct:correctCount,total:r.players.length,accuracy:pct(correctCount,r.players.length),avgResponseMs:responseCount?Math.round(responseSum/responseCount):null,skipped});
 if(!r.tiebreak&&r.index+1===Math.ceil(r.deck.length/2)){r.midRanks={};r.players.slice().sort((a,b)=>b.score-a.score).forEach((p,i)=>{r.midRanks[p.sessionId]={rank:i+1,score:p.score}})}
 r.phase='result';emitRoom(r);
 const correctAnswer=skipped?'Frågan hoppades över':r.currentType==='sort'?(q.specialData?.correct||[]).join(' → '):r.currentType==='map'?(q.specialData?.name||q.f):r.currentType==='pin'?q.f:q.opts[correctIndex]?.label;
 r.lastResult={correctAnswer,explanation:q.f,results,room:roomPublic(r),hostSessionId:r.hostSessionId,skipped,secretBonus,type:r.currentType,specialData:q.specialData||null,visual:q.visual||''};
 io.to(r.code).emit('roundResult',r.lastResult);dramaMoment(r,results,correctCount);directorSchedule(r,'result');
}
function smartRebalanceNext(r){
 if(!r.settings?.smartDifficulty||r.index<3||r.index>=r.deck.length-1)return;
 const recent=r.questionStats.slice(-3),avg=recent.reduce((a,x)=>a+(x.accuracy||0),0)/Math.max(1,recent.length),want=avg<35?'easy':avg>80?'hard':'medium';
 const j=r.deck.findIndex((q,i)=>i>r.index&&q.d===want&&!q._forcedType);if(j>r.index){const tmp=r.deck[r.index+1];r.deck[r.index+1]=r.deck[j];r.deck[j]=tmp}
}
function advance(r){
 smartRebalanceNext(r);const prev=r.deck[r.index],next=r.deck[r.index+1];r.index++;
 if(r.index>=r.deck.length)return finishGame(r);
 if(next?._roundIndex&&prev?._roundIndex!==next._roundIndex){r.round=next._roundIndex;r.roundName=next._roundName||`Runda ${r.round}`;r.phase='roundBreak';emitRoom(r);io.to(r.code).emit('roundBreak',{room:roomPublic(r),round:r.round,rounds:r.rounds,roundName:r.roundName});directorSchedule(r,'roundBreak');return}
 const rs=Math.max(1,r.settings.roundSize||5);
 if(!next?._roundIndex&&r.index%rs===0){r.round=Math.floor(r.index/rs)+1;r.phase='roundBreak';emitRoom(r);io.to(r.code).emit('roundBreak',{room:roomPublic(r),round:r.round,rounds:r.rounds});directorSchedule(r,'roundBreak');return}
 startRoundQuestion(r);
}
function gameInsights(r){
 const qs=r.questionStats.filter(x=>!x.skipped);
 const hardest=qs.slice().sort((a,b)=>a.accuracy-b.accuracy)[0]||null;
 const fastest=r.players.filter(p=>p.stats.responseCount).map(p=>({name:p.name,avatar:p.avatar,avgResponseMs:Math.round(p.stats.responseTotalMs/p.stats.responseCount)})).sort((a,b)=>a.avgResponseMs-b.avgResponseMs)[0]||null;
 const streakP=r.players.slice().sort((a,b)=>b.stats.bestStreak-a.stats.bestStreak)[0]||null;
 const imageP=r.players.filter(p=>p.stats.visualTotal>=2).map(p=>({name:p.name,avatar:p.avatar,correct:p.stats.visualCorrect,total:p.stats.visualTotal,rate:p.stats.visualCorrect/p.stats.visualTotal})).sort((a,b)=>b.rate-a.rate||b.correct-a.correct)[0]||null;
 let categoryExpert=null;
 for(const p of r.players)for(const [c,v] of Object.entries(p.stats.categories||{}))if(v.total>=2){const x={name:p.name,avatar:p.avatar,category:c,correct:v.correct,total:v.total,rate:v.correct/v.total};if(!categoryExpert||x.rate>categoryExpert.rate||(x.rate===categoryExpert.rate&&x.correct>categoryExpert.correct))categoryExpert=x}
 let comeback=null;
 if(r.midRanks){const final=r.players.slice().sort((a,b)=>b.score-a.score);for(let i=0;i<final.length;i++){const p=final[i],mid=r.midRanks[p.sessionId];if(!mid)continue;const improvement=mid.rank-(i+1);if(improvement>0&&(!comeback||improvement>comeback.places))comeback={name:p.name,avatar:p.avatar,places:improvement,from:mid.rank,to:i+1}}}
 return {hardest,fastest,bestStreak:streakP?{name:streakP.name,avatar:streakP.avatar,value:streakP.stats.bestStreak}:null,imageMaster:imageP,categoryExpert,comeback};
}
function topTie(r){
 if(r.mode==='teams'){const t=teamStandings(r);return t.length>1&&t[0].score===t[1].score?t.filter(x=>x.score===t[0].score).map(x=>x.name):[]}
 const s=r.players.slice().sort((a,b)=>b.score-a.score);return s.length>1&&s[0].score===s[1].score?s.filter(x=>x.score===s[0].score).map(x=>x.sessionId):[]
}
function finishGame(r){
 clearTimer(r);const tied=topTie(r),isTie=tied.length>1;
 r.phase='finished';if(!isTie&&!r.persisted){persistGame(r);r.persisted=true}
 r.lastGameOver={room:roomPublic(r),hostSessionId:r.hostSessionId,hall:hallOfFame(),insights:gameInsights(r),achievements:Object.fromEntries(r.players.map(p=>[p.sessionId,achievementsFor(r,p)])),tie:isTie,tied};
 io.to(r.code).emit('gameOver',r.lastGameOver);if(isTie&&r.settings?.director){const old=directorTimers.get(r.code);if(old)clearTimeout(old);directorTimers.set(r.code,setTimeout(()=>{directorTimers.delete(r.code);if(r.phase==='finished'&&topTie(r).length>1)startTiebreak(r)},6500))}
}
function startTiebreak(r){
 const tied=topTie(r);if(tied.length<2)return finishGame(r);
 const pool=shuffle(allQuestions().filter(q=>!r.seen.has(q.id)));if(!pool.length)return finishGame(r);
 const q=pool[0];r.seen.add(q.id);r.tiebreakEligible=r.mode==='teams'?new Set(r.players.filter(p=>tied.includes(p.team)).map(p=>p.sessionId)):new Set(tied);r.deck=[q];r.index=0;r.round=1;r.rounds=1;r.settings={...r.settings,count:1,roundSize:1,finalBonusCount:0};r.tiebreak=true;r.persisted=false;
 // reset only scoring delta logic by preserving scores; all players may answer, tie resolves by correctness
 startRoundQuestion(r);
}
function closeIfEmpty(r){if(r.players.length===0){clearTimer(r);rooms.delete(r.code);return true}return false}

function adminAllowed(req){
 if(ADMIN_KEY)return String(req.query.key||req.headers['x-admin-key']||'')===ADMIN_KEY;
 const ip=String(req.ip||req.socket.remoteAddress||'');return ip.includes('127.1.0.1')||ip.includes('::1');
}
function requireAdmin(req,res,next){if(!adminAllowed(req))return res.status(403).json({ok:false,error:ADMIN_KEY?'Fel adminnyckel.':'Adminnyckel är inte konfigurerad för fjärråtkomst.'});next()}

ensureDataDir();
app.use('/media',express.static(MEDIA_DIR,{maxAge:'7d'}));
app.use(express.static(PUBLIC,{maxAge:'1h'}));
app.get('/health',(req,res)=>res.json({ok:true,version:'7.1.0',rooms:rooms.size,questions:allQuestions().length,categories:categoryCounts(),packs:allPacks().length}));
app.get('/api/questions/meta',(req,res)=>res.json({version:'7.1.0',questions:allQuestions().length,categories:categoryCounts(),difficulties:['easy','medium','hard'],packs:allPacks()}));
app.get('/api/highscores',(req,res)=>res.json(hallOfFame()));
app.get('/api/profiles',(req,res)=>{const h=readHistory(),by={};for(const e of h){const k=e.sessionId||e.name.toLowerCase(),x=by[k]||(by[k]={sessionId:e.sessionId,name:e.name,avatar:e.avatar,games:0,wins:0,points:0,correct:0,total:0,bestStreak:0,categories:{}});x.games++;x.wins+=e.win?1:0;x.points+=e.score||0;x.correct+=e.correct||0;x.total+=e.total||0;x.bestStreak=Math.max(x.bestStreak,e.bestStreak||0);for(const [c,v] of Object.entries(e.categories||{})){const z=x.categories[c]||(x.categories[c]={correct:0,total:0});z.correct+=v.correct||0;z.total+=v.total||0}}const titles=readJson(TITLES_FILE,{});res.json(Object.values(by).map(x=>{const cats=Object.entries(x.categories).map(([c,v])=>({c,rate:v.total?v.correct/v.total:0,total:v.total})).filter(z=>z.total>=3).sort((a,b)=>b.rate-a.rate);const best= cats[0]?.c||'',auto=best==='Fotboll'?'⚽ Fotbollsnörden':best==='Musik'||best==='Musikquiz'?'🎵 Musikgurun':best==='Världen'||best==='Resor'?'🌍 Världsmästaren':x.bestStreak>=10?'🔥 Streakmästaren':x.wins>=5?'🏆 Quizmästaren':'🧠 Utmanaren';return {...x,accuracy:pct(x.correct,x.total),bestCategory:best,weakestCategory:cats.at(-1)?.c||'',title:titles[x.sessionId]||auto}}).sort((a,b)=>b.wins-a.wins||b.points-a.points))});
app.get('/api/rivalries',(req,res)=>{const games=readJson(GAMES_FILE,[]),pairs={};for(const g of games){const ps=(g.players||[]).slice().sort((a,b)=>b.score-a.score);for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j],ids=[a.sessionId||a.name,b.sessionId||b.name].sort(),k=ids.join('|'),x=pairs[k]||(pairs[k]={a:ids[0],b:ids[1],names:{},games:0,wins:{}});x.names[a.sessionId||a.name]=a.name;x.names[b.sessionId||b.name]=b.name;x.games++;const w=a.score===b.score?'tie':a.score>b.score?(a.sessionId||a.name):(b.sessionId||b.name);x.wins[w]=(x.wins[w]||0)+1}}res.json(Object.values(pairs).filter(x=>x.games>=2).sort((a,b)=>b.games-a.games).slice(0,50))});
app.get('/api/games',(req,res)=>{const g=readJson(GAMES_FILE,[]);res.json(g.slice(-50).reverse().map(x=>({gameId:x.gameId,at:x.at,mode:x.mode,players:x.players?.length||0,winner:x.mode==='teams'?x.teams?.[0]:x.players?.slice().sort((a,b)=>b.score-a.score)[0],settings:x.settings,insights:x.insights})))});
app.get('/api/games/:id',(req,res)=>{const x=readJson(GAMES_FILE,[]).find(g=>g.gameId===req.params.id);if(!x)return res.status(404).json({error:'Spelet hittades inte.'});res.json(x)});
app.get('/api/league',(req,res)=>{const t=Object.values(readJson(LEAGUE_FILE,{})).map(x=>({...x,accuracy:pct(x.correct,x.total)})).sort((a,b)=>b.wins-a.wins||b.points-a.points);res.json(t)});
app.get('/api/game-plans',(req,res)=>res.json(allGamePlans()));
app.get('/api/tournaments',(req,res)=>res.json(readJson(TOURNAMENT_FILE,[]).map(t=>({id:t.id,name:t.name,active:t.active!==false,createdAt:t.createdAt,updatedAt:t.updatedAt,players:Object.keys(t.standings||{}).length}))));
app.get('/api/tournaments/:id',(req,res)=>{const t=readJson(TOURNAMENT_FILE,[]).find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'Turneringen hittades inte.'});const standings=Object.values(t.standings||{}).sort((a,b)=>b.wins-a.wins||b.points-a.points);res.json({...t,standings})});
app.get('/api/qr',(req,res)=>{const text=String(req.query.text||'').slice(0,500);if(!text)return res.status(400).send('text required');res.type('png');const q=spawn('qrencode',['-t','PNG','-o','-','-s','7','-m','2',text]);q.stdout.pipe(res);q.on('error',()=>res.status(500).end())});

// Admin/editor
app.get('/api/admin/status',(req,res)=>res.json({keyRequired:!!ADMIN_KEY,remoteAllowed:!!ADMIN_KEY,version:'7.1.0'}));
app.get('/api/admin/search',requireAdmin,(req,res)=>{const term=String(req.query.q||'').trim().toLocaleLowerCase('sv-SE'),cat=String(req.query.category||'').trim(),limit=Math.min(250,Math.max(1,+req.query.limit||100));const custom=readJson(CUSTOM_FILE,[]).map((q,i)=>({...normalizeQuestion(q,i),source:'custom'}));const base=baseWithOverrides(true).map(q=>({...q,source:'base'}));let all=[...base,...custom];if(term)all=all.filter(q=>q.id.toLocaleLowerCase('sv-SE').includes(term)||q.q.toLocaleLowerCase('sv-SE').includes(term)||q.a.some(a=>a.toLocaleLowerCase('sv-SE').includes(term)));if(cat)all=all.filter(q=>q.c===cat);res.json({total:all.length,items:all.slice(0,limit)})});
app.put('/api/admin/base/:id',requireAdmin,(req,res)=>{const id=cleanId(req.params.id);const raw=BASE_QUESTIONS.find(q=>q.id===id);if(!raw)return res.status(404).json({ok:false,error:'Basfrågan finns inte.'});const overrides=readJson(OVERRIDE_FILE,{}),merged=normalizeQuestion({...raw,...(overrides[id]||{}),...req.body,id},0);overrides[id]={c:merged.c,q:merged.q,a:merged.a,r:merged.r,f:merged.f,d:merged.d,visual:merged.visual,audio:merged.audio,enabled:merged.enabled};writeJson(OVERRIDE_FILE,overrides);res.json({ok:true,question:{...merged,source:'base'}})});
app.delete('/api/admin/base/:id',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),overrides=readJson(OVERRIDE_FILE,{});overrides[id]={...(overrides[id]||{}),enabled:false};writeJson(OVERRIDE_FILE,overrides);res.json({ok:true})});
app.post('/api/admin/base/:id/restore',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),overrides=readJson(OVERRIDE_FILE,{});delete overrides[id];writeJson(OVERRIDE_FILE,overrides);res.json({ok:true})});

app.get('/api/admin/dashboard',requireAdmin,(req,res)=>{const games=readJson(GAMES_FILE,[]),metrics=questionMetrics(),qs=allQuestions();const items=qs.map(q=>({id:q.id,q:q.q,c:q.c,quality:questionQuality(q,metrics),plays:metrics[q.id]?.plays||0,accuracy:metrics[q.id]?.total?pct(metrics[q.id].correct,metrics[q.id].total):null}));res.json({version:'7.1.0',questions:qs.length,categories:Object.keys(categoryCounts()).length,games:games.length,profiles:hallOfFame().players,rooms:rooms.size,review:items.filter(x=>x.plays>=3&&x.quality<45).length,tooEasy:items.filter(x=>x.plays>=3&&x.accuracy>=90).length,tooHard:items.filter(x=>x.plays>=3&&x.accuracy<=20).length,topReview:items.filter(x=>x.plays>=3).sort((a,b)=>a.quality-b.quality).slice(0,12)});});
app.get('/api/admin/backup',requireAdmin,(req,res)=>{ensureDataDir();const files=[HIGHSCORE_FILE,CUSTOM_FILE,PACK_FILE,OVERRIDE_FILE,GAMES_FILE,LEAGUE_FILE,PLAN_FILE,TOURNAMENT_FILE,TITLES_FILE,QUESTION_METRICS_FILE];const data={format:'resequiz-backup',version:1,appVersion:'7.1.0',createdAt:new Date().toISOString(),files:{}};for(const f of files)if(fs.existsSync(f))data.files[path.basename(f)]=readJson(f,null);res.setHeader('Content-Disposition',`attachment; filename=resequiz-backup-${new Date().toISOString().slice(0,10)}.json`);res.json(data)});
app.post('/api/admin/restore',rateLimit('restore',5,10*60*1000),requireAdmin,(req,res)=>{const b=req.body;if(!b||b.format!=='resequiz-backup'||!b.files||typeof b.files!=='object')return res.status(400).json({ok:false,error:'Ogiltig Resequiz-backup.'});const allowed=new Set(['highscores.json','custom-questions.json','custom-packs.json','question-overrides.json','games.json','league.json','game-plans.json','tournaments.json','player-titles.json','question-metrics.json']);let restored=0;for(const [name,data] of Object.entries(b.files)){if(!allowed.has(name)||data===null)continue;writeJson(path.join(DATA_DIR,name),data);restored++}res.json({ok:true,restored})});

app.get('/api/admin/questions',rateLimit('admin',120,60*1000),requireAdmin,(req,res)=>res.json(readJson(CUSTOM_FILE,[])));
app.post('/api/admin/questions',requireAdmin,(req,res)=>{const arr=readJson(CUSTOM_FILE,[]),q=normalizeQuestion({...req.body,id:`custom-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`});if(!q.q||q.a.length<2)return res.status(400).json({ok:false,error:'Fråga och minst två svar krävs.'});arr.push(q);writeJson(CUSTOM_FILE,arr);res.json({ok:true,question:q})});
app.put('/api/admin/questions/:id',requireAdmin,(req,res)=>{const arr=readJson(CUSTOM_FILE,[]),i=arr.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({ok:false});arr[i]=normalizeQuestion({...arr[i],...req.body,id:arr[i].id});writeJson(CUSTOM_FILE,arr);res.json({ok:true,question:arr[i]})});
app.delete('/api/admin/questions/:id',requireAdmin,(req,res)=>{let arr=readJson(CUSTOM_FILE,[]);const n=arr.length;arr=arr.filter(x=>x.id!==req.params.id);writeJson(CUSTOM_FILE,arr);res.json({ok:arr.length<n})});
app.post('/api/admin/import',requireAdmin,(req,res)=>{if(!Array.isArray(req.body))return res.status(400).json({ok:false,error:'Skicka en JSON-array.'});const arr=readJson(CUSTOM_FILE,[]);let n=0;for(const raw of req.body.slice(0,5000)){const q=normalizeQuestion({...raw,id:`custom-${Date.now()}-${n}-${crypto.randomBytes(3).toString('hex')}`},n);if(q.q&&q.a.length>=2){arr.push(q);n++}}writeJson(CUSTOM_FILE,arr);res.json({ok:true,imported:n})});
app.post('/api/admin/media',requireAdmin,(req,res)=>{try{const raw=String(req.body?.data||''),m=raw.match(/^data:([^;]+);base64,(.+)$/);if(!m)return res.status(400).json({ok:false,error:'Ogiltig fil.'});const mime=m[1],buf=Buffer.from(m[2],'base64');if(buf.length>6*1024*1024)return res.status(400).json({ok:false,error:'Max 6 MB.'});const ext=mime.includes('png')?'png':mime.includes('jpeg')?'jpg':mime.includes('webp')?'webp':mime.includes('mpeg')?'mp3':mime.includes('ogg')?'ogg':mime.includes('wav')?'wav':'bin';const name=`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;fs.writeFileSync(path.join(MEDIA_DIR,name),buf);res.json({ok:true,url:'/media/'+name,mime,size:buf.length})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/admin/import-excel',requireAdmin,async(req,res)=>{try{const raw=String(req.body?.data||''),m=raw.match(/^data:.*?;base64,(.+)$/);if(!m)return res.status(400).json({ok:false,error:'Ogiltig Excel-fil.'});const buf=Buffer.from(m[1],'base64');if(buf.length>8*1024*1024)return res.status(400).json({ok:false,error:'Max 8 MB.'});const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);const ws=wb.worksheets[0];if(!ws)return res.status(400).json({ok:false,error:'Arbetsblad saknas.'});const headers={};ws.getRow(1).eachCell((cell,col)=>headers[String(cell.value||'').trim().toLowerCase()]=col);const get=(row,names)=>{for(const n of names){const col=headers[n];if(col)return String(row.getCell(col).text||'').trim()}return ''};const arr=readJson(CUSTOM_FILE,[]);let n=0;for(let ri=2;ri<=ws.rowCount;ri++){const row=ws.getRow(ri),question=get(row,['fråga','question','q']);if(!question)continue;const correct=get(row,['rätt svar','correct','answer','a0']);const wrong=[get(row,['fel svar 1','wrong1','a1']),get(row,['fel svar 2','wrong2','a2']),get(row,['fel svar 3','wrong3','a3'])].filter(Boolean);if(!correct||!wrong.length)continue;const q=normalizeQuestion({id:`custom-${Date.now()}-${n}-${crypto.randomBytes(3).toString('hex')}`,c:get(row,['kategori','category','c'])||'Allmänbildning',q:question,a:[correct,...wrong],r:0,f:get(row,['förklaring','explanation','f']),d:get(row,['svårighet','difficulty','d'])||'medium',visual:get(row,['bild','visual','image']),audio:get(row,['ljud','audio'])},n);arr.push(q);n++}writeJson(CUSTOM_FILE,arr);res.json({ok:true,imported:n})}catch(e){res.status(400).json({ok:false,error:'Kunde inte läsa Excel-filen: '+e.message})}});
app.post('/api/admin/tournaments',requireAdmin,(req,res)=>{const all=readJson(TOURNAMENT_FILE,[]),t={id:cleanId(req.body.id)||`tournament-${Date.now()}`,name:clean(req.body.name||'Turnering',80),active:true,createdAt:new Date().toISOString(),standings:{}};all.push(t);writeJson(TOURNAMENT_FILE,all);res.json({ok:true,tournament:t})});
app.post('/api/admin/tournaments/:id/close',requireAdmin,(req,res)=>{const all=readJson(TOURNAMENT_FILE,[]),t=all.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({ok:false});t.active=false;t.updatedAt=new Date().toISOString();writeJson(TOURNAMENT_FILE,all);res.json({ok:true})});
app.get('/api/admin/suggest-distractors',requireAdmin,(req,res)=>{const category=String(req.query.category||''),correct=String(req.query.correct||'').trim().toLocaleLowerCase('sv-SE');let pool=allQuestions().filter(q=>!category||q.c===category).flatMap(q=>q.a).map(String).filter(x=>x.trim()&&x.trim().toLocaleLowerCase('sv-SE')!==correct);pool=[...new Set(pool)];res.json(shuffle(pool).slice(0,12))});
app.post('/api/admin/rebalance-difficulty',requireAdmin,(req,res)=>{const games=readJson(GAMES_FILE,[]),agg={};for(const g of games)for(const q of g.questionStats||[]){const x=agg[q.id]||(agg[q.id]={correct:0,total:0,plays:0});x.correct+=q.correct||0;x.total+=q.total||0;x.plays++}const overrides=readJson(OVERRIDE_FILE,{});let changed=0;for(const [id,x] of Object.entries(agg)){if(x.plays<3||!BASE_QUESTIONS.some(q=>q.id===id))continue;const a=pct(x.correct,x.total),d=a<35?'hard':a>75?'easy':'medium';overrides[id]={...(overrides[id]||{}),d};changed++}writeJson(OVERRIDE_FILE,overrides);res.json({ok:true,changed})});
app.post('/api/admin/league/reset',requireAdmin,(req,res)=>{writeJson(LEAGUE_FILE,{});res.json({ok:true})});
app.get('/api/admin/analytics',requireAdmin,(req,res)=>{const games=readJson(GAMES_FILE,[]),m={};for(const g of games)for(const q of g.questionStats||[]){const x=m[q.id]||(m[q.id]={id:q.id,text:q.text,plays:0,correct:0,total:0,responseMs:0,responseCount:0,type:q.type||'classic'});x.plays++;x.correct+=q.correct||0;x.total+=q.total||0;if(q.avgResponseMs){x.responseMs+=q.avgResponseMs;x.responseCount++}}const items=Object.values(m).map(x=>{const accuracy=pct(x.correct,x.total),avgResponseMs=x.responseCount?Math.round(x.responseMs/x.responseCount):null,balance=100-Math.min(100,Math.abs(55-accuracy)*1.8),confidence=Math.min(100,x.plays*12),qualityScore=Math.round(balance*.7+confidence*.3);return {...x,accuracy,avgResponseMs,qualityScore,review:x.plays>=3&&(accuracy<15||accuracy>95||qualityScore<45)}}).sort((a,b)=>b.plays-a.plays);res.json({games:games.length,items})});
app.get('/api/admin/game-plans',requireAdmin,(req,res)=>res.json(readJson(PLAN_FILE,[])));
app.post('/api/admin/game-plans',requireAdmin,(req,res)=>{const arr=readJson(PLAN_FILE,[]),rounds=Array.isArray(req.body.rounds)?req.body.rounds.slice(0,20).map((r,i)=>({name:clean(r.name||`Runda ${i+1}`,60),type:['classic','risk','buzzer','speed','truefalse','text','estimate','clue','zoom','mystery','connections','sort','map','pin','duel','jackpot'].includes(r.type)?r.type:'classic',count:Math.min(30,Math.max(1,+r.count||5)),categories:Array.isArray(r.categories)?r.categories.map(x=>clean(x,50)):[],difficulty:['easy','medium','hard','mixed'].includes(r.difficulty)?r.difficulty:'mixed'})):[];const plan={id:cleanId(req.body.id)||`plan-${Date.now()}`,name:clean(req.body.name||'Eget upplägg',80),description:clean(req.body.description,240),family:!!req.body.family,rounds};const i=arr.findIndex(x=>x.id===plan.id);if(i>=0)arr[i]=plan;else arr.push(plan);writeJson(PLAN_FILE,arr);res.json({ok:true,plan})});
app.delete('/api/admin/game-plans/:id',requireAdmin,(req,res)=>{const arr=readJson(PLAN_FILE,[]).filter(x=>x.id!==req.params.id);writeJson(PLAN_FILE,arr);res.json({ok:true})});
app.get('/api/admin/packs',requireAdmin,(req,res)=>res.json(readJson(PACK_FILE,[])));
app.post('/api/admin/packs',requireAdmin,(req,res)=>{const arr=readJson(PACK_FILE,[]),p={id:cleanId(req.body.id)||`pack-${Date.now()}`,name:clean(req.body.name,60),description:clean(req.body.description,200),categories:Array.isArray(req.body.categories)?req.body.categories.map(x=>clean(x,50)):[],difficulty:['easy','medium','hard','mixed'].includes(req.body.difficulty)?req.body.difficulty:'mixed'};arr.push(p);writeJson(PACK_FILE,arr);res.json({ok:true,pack:p})});

io.on('connection',socket=>{
 socket.on('createRoom',(d,cb=()=>{})=>{const name=clean(d?.name,20),sid=cleanId(d?.sessionId),avatar=cleanAvatar(d?.avatar);if(!name||!sid)return cb({ok:false,error:'Namn saknas.'});const r=makeRoom(name,sid);r.players[0].name=uniqueNickname(r,name,sid);r.players[0].avatar=avatar;r.players[0].socketId=socket.id;socket.join(r.code);cb({ok:true,code:r.code,hostToken:r.hostToken,room:roomPublic(r)});emitRoom(r)});
 socket.on('joinRoom',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||'')),name=clean(d?.name,20),sid=cleanId(d?.sessionId),avatar=cleanAvatar(d?.avatar);if(!r)return cb({ok:false,error:'Rummet finns inte.'});if(r.phase!=='lobby')return cb({ok:false,error:'Spelet har redan startat.'});if(r.players.length>=100)return cb({ok:false,error:'Rummet är fullt (max 100).'});const safeName=uniqueNickname(r,name,sid);let p=findPlayer(r,sid);if(!p){p={sessionId:sid,name:safeName,avatar,team:clean(d?.team,20),score:0,connected:true,socketId:socket.id,stats:freshStats(),roundScores:[],powerups:{fifty:1,double:1,shield:1}};r.players.push(p)}else{p.name=safeName;p.avatar=avatar;p.connected=true;p.socketId=socket.id}socket.join(r.code);cb({ok:true,room:roomPublic(r)});emitRoom(r)});
 socket.on('joinDisplay',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r)return cb({ok:false,error:'Rummet finns inte.'});socket.join(r.code);cb({ok:true,room:roomPublic(r)});if(['question','paused'].includes(r.phase)&&r.currentPublic)socket.emit('question',r.currentPublic);else if(r.phase==='result'&&r.lastResult)socket.emit('roundResult',r.lastResult);else if(r.phase==='roundBreak')socket.emit('roundBreak',{room:roomPublic(r),round:r.round,rounds:r.rounds});else if(r.phase==='finished'&&r.lastGameOver)socket.emit('gameOver',r.lastGameOver)});
 socket.on('rejoin',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r)return cb({ok:false});const p=findPlayer(r,cleanId(d?.sessionId));if(!p)return cb({ok:false});p.connected=true;p.socketId=socket.id;socket.join(r.code);cb({ok:true,room:roomPublic(r)});if(r.currentPublic&&['question','paused'].includes(r.phase))socket.emit('question',r.currentPublic);else if(r.phase==='result'&&r.lastResult)socket.emit('roundResult',r.lastResult);else if(r.phase==='roundBreak')socket.emit('roundBreak',{room:roomPublic(r),round:r.round,rounds:r.rounds});else if(r.phase==='finished'&&r.lastGameOver)socket.emit('gameOver',r.lastGameOver);emitRoom(r)});
 socket.on('setLobbyConfig',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d?.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden kan ändra.'});r.mode=d?.mode==='teams'?'teams':'individual';const names=Array.isArray(d.teamNames)?d.teamNames.map(x=>clean(x,20)).filter(Boolean).slice(0,4):[];r.teamNames=names.length>=2?names:['Lag 1','Lag 2'];if(r.mode==='teams')r.players.forEach((p,i)=>{if(!r.teamNames.includes(p.team))p.team=r.teamNames[i%r.teamNames.length]});else r.players.forEach(p=>p.team='');emitRoom(r);cb({ok:true,room:roomPublic(r)})});
 socket.on('setTeam',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||r.phase!=='lobby')return cb({ok:false});const sid=cleanId(d.sessionId);if(sid!==cleanId(d.requesterSessionId)&&d.hostToken!==r.hostToken)return cb({ok:false,error:'Inte tillåtet.'});const p=findPlayer(r,sid);if(!p)return cb({ok:false});p.team=clean(d.team,20);emitRoom(r);cb({ok:true})});
 socket.on('startGame',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden kan starta.'});if(r.players.length<1)return cb({ok:false,error:'Ingen spelare finns i rummet.'});const s=d.settings||{};r.mode=s.mode==='teams'?'teams':'individual';if(r.players.length===1&&r.mode==='teams')r.mode='individual';r.teamNames=Array.isArray(s.teamNames)?s.teamNames.map(x=>clean(x,20)).filter(Boolean).slice(0,4):r.teamNames;if(r.mode==='teams'&&s.autoTeams===false&&new Set(r.players.map(p=>p.team).filter(Boolean)).size<2)return cb({ok:false,error:'Minst två lag med deltagare krävs.'});const selectedPlan=allGamePlans().find(x=>x.id===cleanId(s.gamePlan));const family=selectedPlan?.family||s.profile==='family',journey=!!selectedPlan?.journey;r.settings={count:Math.min(200,Math.max(5,+s.count||20)),timer:journey?45:(family?Math.max(30,+s.timer||30):([0,10,15,20,30,45,60].includes(+s.timer)?+s.timer:15)),difficulty:family?'easy':(['easy','medium','hard','mixed'].includes(s.difficulty)?s.difficulty:'mixed'),categories:Array.isArray(s.categories)?s.categories:[],roundSize:Math.min(20,Math.max(1,+s.roundSize||5)),finalBonusCount:(family||journey)?0:Math.min(10,Math.max(0,+s.finalBonusCount||5)),pack:cleanId(s.pack),screenMode:journey?'all':(s.screenMode==='display'?'display':'all'),gamePlan:cleanId(s.gamePlan),profile:family?'family':(journey?'classic':(s.profile==='classic'?'classic':'ultimate')),powerups:journey?false:s.powerups!==false,teamScoring:s.teamScoring==='sum'?'sum':'average',tournament:cleanId(s.tournament),smartDifficulty:s.smartDifficulty!==false,director:journey?true:s.director!==false,drama:s.drama!==false,autoTeams:s.autoTeams!==false,teamPowerups:journey?false:s.teamPowerups!==false,journeyMode:journey,soloMode:r.players.length===1};r.deck=selectDeck(r,r.settings);if(r.deck.length<2)return cb({ok:false,error:'För få nya frågor i urvalet.'});r.deck.forEach(q=>r.seen.add(q.id));r.index=0;r.round=1;r.rounds=(selectedPlan?.rounds?.length)||Math.ceil(r.deck.length/r.settings.roundSize);r.questionStats=[];r.tiebreak=false;r.secretBonusIndex=family?-1:Math.floor(Math.random()*r.deck.length);if(r.mode==='teams'&&r.settings.autoTeams)balanceTeams(r);r.teamPowerups={};if(r.mode==='teams')for(const n of r.teamNames)r.teamPowerups[n]={double:1,shield:1};r.players.forEach(p=>{p.score=0;p.stats=freshStats();p.roundScores=[];p.powerups={fifty:1,double:1,shield:1};p.powerState={};p.captain=false});if(r.mode==='teams')for(const n of r.teamNames){const m=r.players.filter(p=>p.team===n);if(m[0])m[0].captain=true}r.persisted=false;cb({ok:true});startRoundQuestion(r)});
 socket.on('submitAnswer',(d,cb=()=>{})=>{
   const r=rooms.get(String(d?.code||''));if(!r||r.phase!=='question'||r.currentPublic?.id!==d.questionId)return cb({ok:false,error:'Frågan är inte aktiv.'});
   const p=findPlayer(r,cleanId(d.sessionId));if(!p||r.answers.has(p.sessionId))return cb({ok:false,error:'Redan besvarad.'});
   if(r.currentType==='duel'&&!r.duelists.includes(p.sessionId))return cb({ok:false,error:'Den här frågan är en duell mellan två andra spelare.'});
   if(r.currentType==='buzzer'&&r.buzzerWinner!==p.sessionId)return cb({ok:false,error:'Du måste vinna buzzern för att svara.'});
   const responseMs=Math.max(0,Date.now()-r.questionStartedAt),stake=r.currentType==='risk'?Math.max(100,Math.min(500,+d.stake||100)):0;
   if(r.currentType==='buzzer'){
     const correctIndex=r.current.opts.findIndex(o=>o.correct);
     if(+d.answerIndex!==correctIndex){
       r.buzzerTried=r.buzzerTried||new Set();r.buzzerTried.add(p.sessionId);p.score-=100;const st=p.stats||(p.stats=freshStats());st.total++;st.streak=0;
       r.events=r.events||[];r.events.push({at:Date.now(),questionId:r.current.id,type:'buzzer',sessionId:p.sessionId,gain:-100});
       r.buzzerWinner='';r.currentPublic.buzzerWinner='';cb({ok:true,responseMs,wrongBuzz:true});io.to(r.code).emit('buzzWrong',{sessionId:p.sessionId,name:p.name,avatar:p.avatar,penalty:-100});emitRoom(r);
       const available=r.players.filter(x=>x.connected&&!r.buzzerTried.has(x.sessionId));if(!available.length){settleQuestion(r);return}io.to(r.code).emit('buzzerReopened',{tried:[...r.buzzerTried]});return;
     }
   }
   r.answers.set(p.sessionId,{answerIndex:+d.answerIndex,responseMs,stake,textAnswer:clean(d.textAnswer,200),numericAnswer:clean(d.numericAnswer,60),cluesUsed:Math.max(0,Math.min(3,+d.cluesUsed||0)),order:Array.isArray(d.order)?d.order.map(x=>clean(x,100)):[],mapLat:Number(d.mapLat),mapLon:Number(d.mapLon),pinX:Number(d.pinX),pinY:Number(d.pinY),double:!!p.powerState?.double,shield:!!p.powerState?.shield});
   p.powerState={};cb({ok:true,responseMs});
   io.to(r.code).emit('answerProgress',{answered:r.answers.size,total:r.currentType==='buzzer'?1:r.currentType==='duel'?r.duelists.length:r.players.filter(x=>x.connected).length});
   const needed=r.currentType==='duel'?r.duelists.length:r.players.filter(x=>x.connected).length;if(r.currentType==='buzzer'||r.answers.size>=needed)settleQuestion(r);
 });
 socket.on('buzz',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||r.phase!=='question'||r.currentType!=='buzzer')return cb({ok:false,error:'Ingen buzzerfråga är aktiv.'});const p=findPlayer(r,cleanId(d.sessionId));if(!p)return cb({ok:false});if(r.buzzerTried?.has(p.sessionId))return cb({ok:false,error:'Du har redan försökt på den här frågan.'});if(r.buzzerWinner)return cb({ok:false,error:'Någon hann före.'});r.buzzerWinner=p.sessionId;r.currentPublic.buzzerWinner=p.sessionId;io.to(r.code).emit('buzzed',{sessionId:p.sessionId,name:p.name,avatar:p.avatar});emitRoom(r);cb({ok:true})});
 socket.on('usePowerup',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||'')),p=r&&findPlayer(r,cleanId(d.sessionId)),type=String(d.type||'');if(!r||!p||r.phase!=='question'||!r.settings.powerups)return cb({ok:false,error:'Power-up kan inte användas nu.'});if(!['fifty','double','shield'].includes(type)||!(p.powerups?.[type]>0))return cb({ok:false,error:'Power-up saknas.'});p.powerups[type]--;p.stats.powerupsUsed++;p.powerState=p.powerState||{};if(type==='double')p.powerState.double=true;if(type==='shield')p.powerState.shield=true;if(type==='fifty'){const wrong=r.current.opts.map((o,i)=>!o.correct?i:null).filter(i=>i!==null);const hide=shuffle(wrong).slice(0,Math.max(1,wrong.length-1));emitRoom(r);return cb({ok:true,hide})}emitRoom(r);cb({ok:true})});

 socket.on('useTeamPowerup',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||'')),p=r&&findPlayer(r,cleanId(d.sessionId)),type=String(d.type||'');if(!r||!p||r.phase!=='question'||r.mode!=='teams'||!r.settings.teamPowerups)return cb({ok:false,error:'Lag-power-up kan inte användas nu.'});if(!p.captain)return cb({ok:false,error:'Endast lagkaptenen kan använda lagets power-up.'});const u=r.teamPowerups?.[p.team];if(!u||!['double','shield'].includes(type)||!u[type])return cb({ok:false,error:'Power-up saknas.'});u[type]--;for(const m of r.players.filter(x=>x.team===p.team)){m.powerState=m.powerState||{};m.powerState[type]=true}emitRoom(r);io.to(r.code).emit('teamPowerup',{team:p.team,type,captain:p.name});cb({ok:true})});
 socket.on('prediction',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||'')),p=r&&findPlayer(r,cleanId(d.sessionId));if(!r||!p||r.phase!=='question')return cb({ok:false});const v=Math.max(0,Math.min(100,+d.value||0));r.predictions=r.predictions||new Map();if(r.predictions.has(p.sessionId))return cb({ok:false,error:'Prediction redan låst.'});r.predictions.set(p.sessionId,v);cb({ok:true})});
 socket.on('reaction',d=>{const r=rooms.get(String(d?.code||'')),p=r&&findPlayer(r,cleanId(d.sessionId));if(!r||!p)return;const emoji=['😂','😱','👏','🔥','❤️','🤯'].includes(d.emoji)?d.emoji:'';if(!emoji)return;const now=Date.now();if(socket._lastReaction&&now-socket._lastReaction<700)return;socket._lastReaction=now;io.to(r.code).emit('reaction',{emoji,name:p.name,avatar:p.avatar})});
 socket.on('joinRemote',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Ogiltig värdlänk.'});socket.join(r.code);cb({ok:true,room:roomPublic(r)})});
 socket.on('nextQuestion',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false});if(r.phase!=='result')return cb({ok:false,error:'Rundan är inte klar.'});clearTimer(r);cb({ok:true});advance(r)});
 socket.on('continueRound',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken||r.phase!=='roundBreak')return cb({ok:false});clearTimer(r);cb({ok:true});startRoundQuestion(r)});
 socket.on('hostAction',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden.'});const action=d.action;
   if(action==='skip'&&['question','paused'].includes(r.phase)){settleQuestion(r,{skipped:true});return cb({ok:true})}
   if(action==='restartQuestion'&&['question','paused'].includes(r.phase)&&r.current){clearTimer(r);r.answers=new Map();r.predictions=new Map();r.phase='question';r.paused=false;r.questionStartedAt=Date.now();r.lastResult=null;emitRoom(r);io.to(r.code).emit('question',r.currentPublic);if(r.settings.timer>0)timers.set(r.code,setTimeout(()=>settleQuestion(r),r.settings.timer*1000+900));return cb({ok:true})}
   if(action==='endGame'&&['question','paused','result','roundBreak'].includes(r.phase)){finishGame(r);return cb({ok:true})}
   if(action==='pause'&&r.phase==='question'){clearTimer(r);r.phase='paused';r.paused=true;emitRoom(r);io.to(r.code).emit('paused',{paused:true});return cb({ok:true})}
   if(action==='resume'&&r.phase==='paused'){r.phase='question';r.paused=false;r.questionStartedAt=Date.now();emitRoom(r);io.to(r.code).emit('paused',{paused:false});if(r.settings.timer>0)timers.set(r.code,setTimeout(()=>settleQuestion(r),r.settings.timer*1000));return cb({ok:true})}
   if(action==='adjustScore'){const p=findPlayer(r,cleanId(d.sessionId));if(!p)return cb({ok:false});p.score+=Math.max(-1000,Math.min(1000,+d.delta||0));emitRoom(r);return cb({ok:true})}
   if(action==='kick'){const sid=cleanId(d.sessionId);if(sid===r.hostSessionId)return cb({ok:false,error:'Värden kan inte sparka sig själv.'});const p=findPlayer(r,sid);if(p?.socketId)io.to(p.socketId).emit('kicked');r.players=r.players.filter(x=>x.sessionId!==sid);emitRoom(r);return cb({ok:true})}
   if(action==='randomTeams'&&r.mode==='teams'){balanceTeams(r);emitRoom(r);return cb({ok:true})}
   cb({ok:false,error:'Okänd åtgärd.'})
 });
 socket.on('startTiebreaker',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false});cb({ok:true});startTiebreak(r)});
 socket.on('replaySame',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken||r.phase!=='finished')return cb({ok:false,error:'Kan inte starta om nu.'});clearTimer(r);r.deck=selectDeck(r,r.settings);if(r.deck.length<2)return cb({ok:false,error:'För få nya frågor kvar i urvalet.'});r.deck.forEach(q=>r.seen.add(q.id));r.index=0;r.round=1;const selectedPlan=allGamePlans().find(x=>x.id===r.settings.gamePlan);r.rounds=(selectedPlan?.rounds?.length)||Math.ceil(r.deck.length/r.settings.roundSize);r.questionStats=[];r.lastResult=null;r.lastGameOver=null;r.tiebreak=false;r.persisted=false;r.events=[];r.midRanks=null;r.lastLeader='';r.secretBonusIndex=r.settings.profile==='family'?-1:Math.floor(Math.random()*r.deck.length);if(r.mode==='teams'&&r.settings.autoTeams)balanceTeams(r);r.players.forEach(p=>{p.score=0;p.stats=freshStats();p.roundScores=[];p.powerups={fifty:1,double:1,shield:1};p.powerState={};p.captain=false});if(r.mode==='teams')for(const n of r.teamNames){const m=r.players.filter(p=>p.team===n);if(m[0])m[0].captain=true}cb({ok:true});startRoundQuestion(r)});
 socket.on('resetRoom',(d)=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return;r.phase='lobby';r.deck=[];r.index=0;r.current=null;r.currentPublic=null;r.answers=new Map();r.questionStats=[];r.lastResult=null;r.lastGameOver=null;r.players.forEach(p=>{p.score=0;p.stats=freshStats();p.powerups={fifty:1,double:1,shield:1};p.powerState={}});r.persisted=false;r.tiebreak=false;emitRoom(r)});
 socket.on('leaveRoom',d=>{const r=rooms.get(String(d?.code||''));if(!r)return;const sid=cleanId(d.sessionId),wasHost=r.hostSessionId===sid;r.players=r.players.filter(p=>p.sessionId!==sid);socket.leave(r.code);if(closeIfEmpty(r))return;if(wasHost){const np=r.players[0];r.hostSessionId=np.sessionId;r.hostToken=token();io.to(np.socketId).emit('hostPromoted',{hostToken:r.hostToken})}emitRoom(r)});
 socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.players.find(x=>x.socketId===socket.id);if(p){p.connected=false;p.socketId=null;emitRoom(r)}}});
});

setInterval(()=>{for(const [c,r] of rooms){if(r.players.length&&!r.players.some(p=>p.connected)&&r.phase==='lobby'){clearTimer(r);rooms.delete(c)}}},15*60*1000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Resequiz 7.1.0 listening on ${PORT}`));
