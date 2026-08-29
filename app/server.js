const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const crypto=require('crypto');
const https=require('https');
const ExcelJS=require('exceljs');
const {createStorage}=require('./storage');

const app=express();
app.use(express.json({limit:'8mb'}));
app.disable('x-powered-by');
app.use((req,res,next)=>{const started=process.hrtime.bigint();res.on('finish',()=>{const ms=Number(process.hrtime.bigint()-started)/1e6;if(ms>2000)console.warn(`[slow-request] ${req.method} ${req.originalUrl} ${Math.round(ms)}ms ${res.statusCode}`)});next()});
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
const LEAGUES_FILE=path.join(DATA_DIR,'leagues.json');
const PLAN_FILE=path.join(DATA_DIR,'game-plans.json');
const TOURNAMENT_FILE=path.join(DATA_DIR,'tournaments.json');
const TITLES_FILE=path.join(DATA_DIR,'player-titles.json');
const QUESTION_METRICS_FILE=path.join(DATA_DIR,'question-metrics.json');
const QUESTION_RATINGS_FILE=path.join(DATA_DIR,'question-ratings.json');
const QUESTION_VERIFICATION_FILE=path.join(DATA_DIR,'question-verification.json');
const QUESTION_VERIFICATION_SEED_FILE=path.join(__dirname,'data','question-verification-seed.json');
const FACT_VERIFICATION_REPORT_FILE=path.join(__dirname,'data','fact-verification-report.json');
const SEASONS_FILE=path.join(DATA_DIR,'seasons.json');
const ACTIVE_ROOMS_FILE=path.join(DATA_DIR,'active-rooms.json');
const QUARANTINE_FILE=path.join(DATA_DIR,'question-quarantine.json');
const GROUPS_FILE=path.join(DATA_DIR,'groups.json');
const ADMIN_AUTH_FILE=path.join(DATA_DIR,'admin-auth.json');
const APP_VERSION = '18.0.1';
const ADMIN_KEY=String(process.env.RESEQUIZ_ADMIN_KEY||'').trim();
const storage=createStorage(DATA_DIR);

function ensureDataDir(){try{fs.mkdirSync(DATA_DIR,{recursive:true});fs.mkdirSync(MEDIA_DIR,{recursive:true})}catch{}}
function readJson(file,fallback){ensureDataDir();return storage.readJson(file,fallback)}
function writeJson(file,data){ensureDataDir();return storage.writeJson(file,data)}
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
    visual:clean(q.visual,300),audio:clean(q.audio,300),enabled:q.enabled!==false,specialType:clean(q.specialType,30),specialData:q.specialData&&typeof q.specialData==='object'?q.specialData:null,audioStart:Math.max(0,Number(q.audioStart)||0),audioDuration:Math.max(0,Math.min(120,Number(q.audioDuration)||0)),factKey:clean(q.factKey||'',120),family:clean(q.family||'',120),subtype:clean(q.subtype||'',40)
  };
}
const BASE_QUESTIONS=loadBaseQuestions();
// Keep the health path intentionally cheap. The full 22k+ question catalogue is
// never rebuilt just to answer a liveness probe.
const BASE_CATEGORY_COUNTS=Object.freeze(BASE_QUESTIONS.reduce((m,q)=>{const c=String(q.c||'Allmänbildning');m[c]=(m[c]||0)+1;return m},{}));
const BASE_QUESTION_COUNT=BASE_QUESTIONS.length;
let catalogueCache={at:0,questions:BASE_QUESTION_COUNT,categories:{...BASE_CATEGORY_COUNTS},packs:0};
function catalogueSummary(force=false){
  const now=Date.now();
  if(!force&&now-catalogueCache.at<30000)return catalogueCache;
  const qs=allQuestions();
  catalogueCache={at:now,questions:qs.length,categories:categoryCounts(qs),packs:allPacks().length};
  return catalogueCache;
}
function invalidateCatalogueCache(){catalogueCache.at=0}
function httpsJson(url,timeoutMs=8000){
 return new Promise((resolve,reject)=>{let done=false;const req=https.get(url,{headers:{'User-Agent':'Resequiz/18.0.1 (verified-question-research)','Accept':'application/json'}},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>{body+=c;if(body.length>3*1024*1024){req.destroy(new Error('Svar från källan var för stort.'))}});res.on('end',()=>{if(done)return;done=true;if(res.statusCode<200||res.statusCode>=300)return reject(new Error(`Källan svarade HTTP ${res.statusCode}.`));try{resolve(JSON.parse(body))}catch{reject(new Error('Källan returnerade ogiltig JSON.'))}})});req.setTimeout(timeoutMs,()=>req.destroy(new Error('Källan svarade inte i tid.')));req.on('error',e=>{if(done)return;done=true;reject(e)})})
}
const researchCache=new Map();
function wdClaimValue(entity,prop){const claims=entity?.claims?.[prop];if(!Array.isArray(claims))return null;for(const c of claims){const v=c?.mainsnak?.datavalue?.value;if(v!==undefined&&v!==null)return v}return null}
function wdEntityId(v){return v&&typeof v==='object'&&/^Q\d+$/.test(String(v.id||''))?String(v.id):''}
function wdYear(v){const t=v&&typeof v==='object'?String(v.time||''):'';const m=t.match(/^([+-])(\d{4,})-/);if(!m)return '';const y=String(Number(m[2]));return m[1]==='-'?`${y} f.Kr.`:y}
async function wikidataResearch(query,category='Allmänbildning',lang='sv',limit=12){
 const safeLang=['sv','en','de','es'].includes(lang)?lang:'sv',q=String(query||'').trim().slice(0,120),cat=clean(category||'Allmänbildning',50),max=Math.max(3,Math.min(24,+limit||12));if(q.length<2)throw new Error('Ange minst två tecken i sökordet.');
 const cacheKey=`${safeLang}|${cat}|${q.toLocaleLowerCase('sv-SE')}|${max}`,cached=researchCache.get(cacheKey);if(cached&&Date.now()-cached.at<10*60*1000)return cached.data;
 const api='https://www.wikidata.org/w/api.php',searchUrl=`${api}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=${safeLang}&uselang=${safeLang}&format=json&limit=${Math.min(12,max)}&origin=*`,search=await httpsJson(searchUrl),ids=(search.search||[]).map(x=>x.id).filter(x=>/^Q\d+$/.test(x));if(!ids.length)return {query:q,category:cat,language:safeLang,source:'Wikidata',items:[],skippedExisting:0};
 const entUrl=`${api}?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims&languages=${safeLang}|en&languagefallback=1&format=json&origin=*`,entData=await httpsJson(entUrl),entities=entData.entities||{};
 const props=['P36','P37','P30','P17','P19','P106','P57','P50','P175','P136','P641','P112','P159','P138','P495','P364','P740'];
 const linked=new Set();for(const e of Object.values(entities))for(const p of props){const id=wdEntityId(wdClaimValue(e,p));if(id)linked.add(id)}
 let labels={};if(linked.size){const batches=[...linked].slice(0,80),labelUrl=`${api}?action=wbgetentities&ids=${batches.join('|')}&props=labels&languages=${safeLang}|en&languagefallback=1&format=json&origin=*`,ld=await httpsJson(labelUrl);for(const [id,e] of Object.entries(ld.entities||{}))labels[id]=e.labels?.[safeLang]?.value||e.labels?.en?.value||id}
 const templates={
  P36:(x,a)=>({q:`Vad heter huvudstaden i ${x}?`,f:`${a} är huvudstad i ${x}.`,subtype:'capital'}),
  P37:(x,a)=>({q:`Vilket språk är ett officiellt språk i ${x}?`,f:`${a} är ett officiellt språk i ${x}.`,subtype:'language'}),
  P30:(x,a)=>({q:`På vilken kontinent ligger ${x}?`,f:`${x} ligger i ${a}.`,subtype:'continent'}),
  P17:(x,a)=>({q:`I vilket land ligger eller hör ${x} hemma?`,f:`${x} är kopplat till ${a}.`,subtype:'country'}),
  P19:(x,a)=>({q:`Var föddes ${x}?`,f:`${x} föddes i ${a}.`,subtype:'birthplace'}),
  P106:(x,a)=>({q:`Vilket yrke eller vilken roll är ${x} känd för?`,f:`${x} är känd som ${a}.`,subtype:'occupation'}),
  P57:(x,a)=>({q:`Vem regisserade ${x}?`,f:`${a} är regissör för ${x}.`,subtype:'director'}),
  P50:(x,a)=>({q:`Vem skrev ${x}?`,f:`${a} anges som författare till ${x}.`,subtype:'author'}),
  P175:(x,a)=>({q:`Vilken artist eller grupp framför ${x}?`,f:`${a} anges som artist för ${x}.`,subtype:'performer'}),
  P136:(x,a)=>({q:`Vilken genre förknippas ${x} med?`,f:`${x} klassificeras som ${a}.`,subtype:'genre'}),
  P641:(x,a)=>({q:`Vilken sport förknippas ${x} med?`,f:`${x} förknippas med ${a}.`,subtype:'sport'}),
  P112:(x,a)=>({q:`Vem grundade ${x}?`,f:`${a} anges som grundare av ${x}.`,subtype:'founder'}),
  P159:(x,a)=>({q:`Var har ${x} sitt huvudkontor?`,f:`${x} har sitt huvudkontor i ${a}.`,subtype:'headquarters'}),
  P138:(x,a)=>({q:`Vad eller vem är ${x} uppkallad efter?`,f:`${x} är uppkallad efter ${a}.`,subtype:'named-after'}),
  P495:(x,a)=>({q:`Vilket ursprungsland har ${x}?`,f:`${x} har ${a} som ursprungsland.`,subtype:'origin-country'}),
  P364:(x,a)=>({q:`Vilket är originalspråket för ${x}?`,f:`Originalspråket för ${x} är ${a}.`,subtype:'original-language'}),
  P740:(x,a)=>({q:`Var bildades ${x}?`,f:`${x} bildades i ${a}.`,subtype:'formation-place'})
 };
 const existing=allQuestions(),promptSet=new Set(existing.map(x=>normalizeText(x.q))),factSet=new Set(existing.map(x=>String(x.factKey||'')).filter(Boolean)),items=[];let skippedExisting=0;
 for(const id of ids){const e=entities[id];if(!e||e.missing!==undefined)continue;const label=e.labels?.[safeLang]?.value||e.labels?.en?.value||id,description=e.descriptions?.[safeLang]?.value||e.descriptions?.en?.value||'';let perEntity=0;
  for(const [prop,builder] of Object.entries(templates)){if(items.length>=max||perEntity>=3)break;const raw=wdClaimValue(e,prop),answerId=wdEntityId(raw);if(!answerId)continue;const answer=labels[answerId];if(!answer||answer===answerId||normalizeText(answer)===normalizeText(label))continue;const built=builder(label,answer),factKey=`wikidata.${id}.${prop}.${answerId}`;if(promptSet.has(normalizeText(built.q))||factSet.has(factKey)){skippedExisting++;continue}items.push({id:`${id}-${prop}-${answerId}`,entityId:id,property:prop,category:cat,q:built.q,correct:answer,explanation:built.f,description,difficulty:'medium',factKey,family:`wikidata.${id}.${prop}`,subtype:built.subtype,source:`https://www.wikidata.org/wiki/${id}`,sourceLabel:`Wikidata · ${label}`,verified:true});perEntity++}
  for(const [prop,labelText] of [['P571','grundades eller skapades'],['P577','publicerades eller hade premiär']]){if(items.length>=max||perEntity>=3)break;const year=wdYear(wdClaimValue(e,prop));if(!year)continue;const question=prop==='P571'?`Vilket år grundades eller skapades ${label}?`:`Vilket år publicerades eller hade ${label} premiär?`,factKey=`wikidata.${id}.${prop}.${year.replace(/\W/g,'')}`;if(promptSet.has(normalizeText(question))||factSet.has(factKey)){skippedExisting++;continue}items.push({id:`${id}-${prop}-${year}`,entityId:id,property:prop,category:cat,q:question,correct:year,explanation:`Enligt Wikidatas strukturerade data ${labelText} ${label} år ${year}.`,description,difficulty:'medium',factKey,family:`wikidata.${id}.${prop}`,subtype:'year',source:`https://www.wikidata.org/wiki/${id}`,sourceLabel:`Wikidata · ${label}`,verified:true});perEntity++}
 }
 const data={query:q,category:cat,language:safeLang,source:'Wikidata structured data',retrievedAt:new Date().toISOString(),items,skippedExisting};researchCache.set(cacheKey,{at:Date.now(),data});if(researchCache.size>80){const oldest=[...researchCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,20);oldest.forEach(([k])=>researchCache.delete(k))}return data
}

const CATEGORY_DISCOVERY_SEEDS={
 'Sverige':['Sverige historia','svenska uppfinningar','svenska författare','svenska artister','svenska idrottare','svenska städer','svenska företag','svenska kungar','svenska Nobelpristagare','svenska filmer','svenska byggnader','svenska naturreservat'],
 'Historia':['romarriket','antikens Grekland','medeltiden','renässansen','franska revolutionen','första världskriget','andra världskriget','vikingatiden','egyptiska faraoner','historiska uppfinningar','historiska ledare','arkeologiska fynd'],
 'Fotboll':['fotbolls-VM','fotbolls-EM','UEFA Champions League','svenska fotbollsklubbar','Premier League','La Liga','Serie A','Bundesliga','fotbollsspelare','fotbollsarenor','fotbollstränare','damfotboll'],
 'Sport':['olympiska spelen','friidrott','ishockey','tennis','handboll','basket','motorsport','skidåkning','simning','cykling','golf','världsrekord sport'],
 'Mat & dryck':['svenska maträtter','italiensk mat','fransk mat','asiatisk mat','ostar','bakverk','kryddor','frukter','grönsaker','kaffe','te','matlagningstekniker'],
 'Musik':['popmusik','rockmusik','jazz','klassisk musik','svenska artister','musikgrupper','låtskrivare','musikalbum','musikinstrument','musikpriser','festivaler','kompositörer'],
 'Musikquiz':['svenska låtar','poplåtar','rocklåtar','Eurovision låtar','Melodifestivalen','klassiska hits','musikgrupper','sångare','låtskrivare','album','duetter','filmmusik'],
 'Film & TV':['Oscarvinnare','svenska filmer','klassiska filmer','TV-serier','filmregissörer','skådespelare','animerade filmer','science fiction film','komedifilm','dramafilm','TV-program','filmfestivaler'],
 'Djur & natur':['däggdjur','fåglar','reptiler','hajar','valar','insekter','träd','blommor','nationalparker','berg','floder','naturfenomen'],
 'Vetenskap & teknik':['astronomi','rymdfart','fysik','kemi','biologi','medicin','datorhistoria','internet','programmering','uppfinningar','robotik','energi'],
 'Allmänbildning':['Nobelpriset','berömda personer','uppfinningar','arkitektur','litteratur','konst','geografi','vetenskap','språk','ekonomi','kultur','internationella organisationer'],
 'Resor':['världsarv','turistattraktioner','flygplatser','järnvägar','öar','stränder','nationalparker','museer','monument','semesterorter','vandringsleder','kända hotell'],
 'Bildrunda':['kända byggnader','landmärken','djurarter','konstverk','flaggor','fordon','musikinstrument','maträtter','växter','sportarenor','statyer','tekniska prylar'],
 'Onödigt vetande':['udda uppfinningar','världsrekord','märkliga djur','ovanliga traditioner','kuriosa historia','märkliga lagar','rekord byggnader','ovanliga ord','kända missöden','vardagsföremål historia','udda vetenskap','popkultur kuriosa'],
 '80/90/00-talet':['1980-talet musik','1980-talet film','1980-talet teknik','1990-talet musik','1990-talet film','1990-talet TV','1990-talet teknik','2000-talet musik','2000-talet film','2000-talet TV','2000-talet teknik','retrospel']
};
function discoverySeeds(category){const cat=clean(category||'Allmänbildning',50);return CATEGORY_DISCOVERY_SEEDS[cat]||[cat,`${cat} historia`,`${cat} kända personer`,`${cat} rekord`,`${cat} Sverige`,`${cat} internationellt`]} 
async function categoryQuestionDiscovery(category='Allmänbildning',lang='sv',limit=30){
 const cat=clean(category||'Allmänbildning',50),safeLang=['sv','en','de','es'].includes(lang)?lang:'sv',max=Math.max(8,Math.min(80,+limit||30)),seeds=discoverySeeds(cat),items=[],seen=new Set(),topics=[];let skippedExisting=0,failedSeeds=0;
 const perSeed=Math.max(6,Math.min(18,Math.ceil(max/Math.min(seeds.length,8))+3));
 for(const seed of seeds){if(items.length>=max)break;try{const r=await wikidataResearch(seed,cat,safeLang,perSeed);topics.push({seed,found:r.items.length});skippedExisting+=r.skippedExisting||0;for(const x of r.items||[]){if(items.length>=max)break;if(seen.has(x.factKey))continue;seen.add(x.factKey);items.push({...x,discoveredFrom:seed})}}catch(e){failedSeeds++;topics.push({seed,found:0,error:String(e.message||e)})}}
 return {category:cat,language:safeLang,source:'Wikidata structured data',retrievedAt:new Date().toISOString(),items,skippedExisting,topics,failedSeeds,seedsTried:topics.length};
}

function baseWithOverrides(includeDisabled=false){
  const overrides=readJson(OVERRIDE_FILE,{});
  return BASE_QUESTIONS.map((raw,i)=>normalizeQuestion({...raw,...(overrides[raw.id]||{}),id:raw.id},i)).filter(q=>includeDisabled||q.enabled!==false);
}
let questionCatalogueCache={at:0,value:null};
function invalidateQuestionCatalogue(){questionCatalogueCache.at=0;questionCatalogueCache.value=null;invalidateCatalogueCache()}
function allQuestions(force=false){
  const now=Date.now();
  // Building the full catalogue means normalising 22k+ questions and reading
  // several persistence files. Never do that for every Socket.IO room update.
  if(!force&&questionCatalogueCache.value&&now-questionCatalogueCache.at<30000)return questionCatalogueCache.value;
  const quarantined=new Set(readJson(QUARANTINE_FILE,[]));
  const base=baseWithOverrides(false).filter(q=>!quarantined.has(q.id));
  const custom=readJson(CUSTOM_FILE,[]).map((q,i)=>normalizeQuestion(q,i)).filter(x=>x.enabled!==false&&!quarantined.has(x.id));
  const ids=new Set();
  const value=[...base,...custom].filter(q=>q.q&&q.a.length>=2&&!ids.has(q.id)&&ids.add(q.id));
  questionCatalogueCache={at:now,value};
  return value;
}
function categoryCounts(qs=allQuestions()){return qs.reduce((m,q)=>{m[q.c]=(m[q.c]||0)+1;return m},{})}
function questionMetrics(){const x=readJson(QUESTION_METRICS_FILE,{});return x&&typeof x==='object'?x:{}}
function questionVerifications(){const seed=readJson(QUESTION_VERIFICATION_SEED_FILE,{}),runtime=readJson(QUESTION_VERIFICATION_FILE,{});return {...(seed&&typeof seed==='object'?seed:{}),...(runtime&&typeof runtime==='object'?runtime:{})}}
function actualDifficultyFor(q,m){if(!m||(+m.total||0)<30)return q.d;const a=pct(m.correct,m.total);return a>=75?'easy':a<=35?'hard':'medium'}
function healthFlags(q,m={},rt={},ver={}){const flags=[];const total=+m.total||0,plays=+m.plays||0,accuracy=total?pct(m.correct,total):null,skipRate=plays?Math.round((+m.skips||0)/plays*100):0,votes=(rt.up||0)+(rt.down||0),dist=m.answerDistribution||{};if(total>=20&&accuracy<10)flags.push('very-low-correct-rate');if(total>=20&&accuracy>98)flags.push('very-high-correct-rate');if(plays>=10&&skipRate>=30)flags.push('high-skip-rate');if(votes>=5&&(rt.down||0)/votes>=.6)flags.push('poor-player-rating');if((rt.flag||0)>=3)flags.push('player-reported');if(total>=20){const optionNorm=new Set((q.a||[]).map(normalizeText)),optionResponses=Object.entries(dist).filter(([k])=>optionNorm.has(normalizeText(k))).reduce((n,[,v])=>n+(+v||0),0),wrong=Object.entries(dist).filter(([k])=>optionNorm.has(normalizeText(k))&&normalizeText(k)!==normalizeText(q.a[q.r]||'')).sort((a,b)=>b[1]-a[1])[0];if(optionResponses>=total*.8&&wrong&&wrong[1]/Math.max(1,optionResponses)>=.65)flags.push('dominant-wrong-answer')}if(total>=30&&m.discriminationCount>=15&&Number(m.discriminationSum||0)/Math.max(1,m.discriminationCount)<-.05)flags.push('negative-discrimination');if(total>=30&&Object.keys(dist).length>=3){const vals=Object.values(dist).map(Number).sort((a,b)=>b-a);if(vals[0]>=total*.85&&accuracy!==null&&accuracy<40)flags.push('suspicious-distractor');}if(ver.validUntil&&Date.parse(ver.validUntil)<Date.now())flags.push('verification-expired');return flags}
function questionHealthItem(q,metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),verifications=questionVerifications()){const m=metrics[q.id]||{},rt=ratings[q.id]||{},ver=verifications[q.id]||{},flags=healthFlags(q,m,rt,ver),actualDifficulty=actualDifficultyFor(q,m),status=ver.status||((flags.length&&(+m.total||0)>=20)?'needs-review':'unverified');return {id:q.id,q:q.q,c:q.c,declaredDifficulty:q.d,actualDifficulty,plays:+m.plays||0,total:+m.total||0,correct:+m.correct||0,accuracy:(+m.total||0)?pct(m.correct,m.total):null,skipRate:(+m.plays||0)?Math.round((+m.skips||0)/(+m.plays||1)*100):0,avgResponseMs:(+m.responseCount||0)?Math.round((+m.responseMs||0)/(+m.responseCount||1)):null,answerDistribution:m.answerDistribution||{},discrimination:m.discriminationCount?Math.round((m.discriminationSum/m.discriminationCount)*100)/100:null,rating:{up:rt.up||0,down:rt.down||0,flag:rt.flag||0},healthScore:questionQuality(q,metrics,ratings),verification:ver,status,flags}}
function autoQuarantineFromHealth(){const qset=new Set(readJson(QUARANTINE_FILE,[])),metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),vers=questionVerifications();let added=0;for(const q of allQuestions()){const h=questionHealthItem(q,metrics,ratings,vers);const severe=h.status!=='verified'&&h.total>=30&&(h.flags.includes('dominant-wrong-answer')||h.flags.includes('poor-player-rating'))&&h.accuracy!==null&&h.accuracy<20;if(severe&&!qset.has(q.id)){qset.add(q.id);added++}}if(added)writeJson(QUARANTINE_FILE,[...qset]);return added}
function questionQuality(q,metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{})){
 const m=metrics[q.id],rt=ratings[q.id]||{};
 const base=(!m||!m.plays)?72:(()=>{const accuracy=pct(m.correct,m.total),balance=100-Math.min(100,Math.abs(55-accuracy)*1.6),confidence=Math.min(100,m.plays*10),skipPenalty=Math.min(25,(m.skips||0)*3);return balance*.65+confidence*.35-skipPenalty})();
 const votes=(rt.up||0)+(rt.down||0),sentiment=votes?((rt.up||0)-(rt.down||0))/votes:0;
 const wordingPenalty=(q.q.length<12?12:0)+(new Set(q.a.map(a=>a.trim().toLowerCase())).size!==q.a.length?25:0)+(q.a.some(a=>!a.trim())?20:0);
 return Math.max(0,Math.min(100,Math.round(base+sentiment*Math.min(15,votes*2)-wordingPenalty)));
}
function smartPick(pool,count,r){
 const metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),now=Date.now(),day=86400000;
 const recentPenalty=q=>{const t=Date.parse(metrics[q.id]?.lastPlayedAt||'');return Number.isFinite(t)&&now-t<7*day?18:0};
 const safe=pool.filter(q=>!metrics[q.id]||metrics[q.id].plays<5||questionQuality(q,metrics,ratings)>=30),source=safe.length>=count?safe:pool;
 const byCat=new Map(),tokens=x=>new Set(String(x||'').toLowerCase().replace(/[^a-zåäö0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>4));
 for(const q of source){if(!byCat.has(q.c))byCat.set(q.c,[]);byCat.get(q.c).push({q,quality:questionQuality(q,metrics,ratings)-recentPenalty(q),rand:Math.random(),tok:tokens(q.q)})}
 for(const arr of byCat.values())arr.sort((a,b)=>(b.quality+b.rand*12)-(a.quality+a.rand*12));
 const cats=shuffle([...byCat.keys()]),chosen=[],chosenTokens=[],chosenFamilies=new Set();let cursor=0,lastCat='';
 const tooSimilar=x=>(x.q.family&&chosenFamilies.has(x.q.family))||chosenTokens.slice(-5).some(t=>{let n=0;for(const w of x.tok)if(t.has(w))n++;return n>=3});
 while(chosen.length<count&&cats.length){
   let found=-1;
   for(let step=0;step<cats.length;step++){const i=(cursor+step)%cats.length,c=cats[i],arr=byCat.get(c);if(arr?.length&&(cats.length===1||c!==lastCat)){const k=arr.findIndex(x=>!tooSimilar(x));if(k>0){const [x]=arr.splice(k,1);arr.unshift(x)}found=i;break}}
   if(found<0)found=cats.findIndex(c=>byCat.get(c)?.length);if(found<0)break;
   const c=cats[found],x=byCat.get(c).shift();chosen.push(x.q);chosenTokens.push(x.tok);if(x.q.family)chosenFamilies.add(x.q.family);lastCat=c;cursor=(found+1)%cats.length;
   if(!byCat.get(c).length){cats.splice(found,1);if(cats.length)cursor%=cats.length}
 }
 return chosen;
}
function updateQuestionMetrics(r){
 const m=questionMetrics();
 for(const q of r.questionStats||[]){
   const x=m[q.id]||(m[q.id]={plays:0,correct:0,total:0,skips:0,responseMs:0,responseCount:0,lastPlayedAt:null,answerDistribution:{},discriminationSum:0,discriminationCount:0});
   x.plays++;x.correct+=q.correct||0;x.total+=q.total||0;x.skips+=q.skipped?1:0;
   if(q.avgResponseMs){x.responseMs+=q.avgResponseMs;x.responseCount++}
   x.answerDistribution=x.answerDistribution||{};for(const [label,n] of Object.entries(q.answerDistribution||{}))x.answerDistribution[label]=(x.answerDistribution[label]||0)+n;
   if(Number.isFinite(q.discrimination)){x.discriminationSum=(x.discriminationSum||0)+q.discrimination;x.discriminationCount=(x.discriminationCount||0)+1}
   x.lastPlayedAt=new Date().toISOString();
 }
 writeJson(QUESTION_METRICS_FILE,m);autoQuarantineFromHealth();
}

function questionConfidence(q,metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{})){
 const m=metrics[q.id]||{},rt=ratings[q.id]||{},plays=m.plays||0,total=m.total||0,votes=(rt.up||0)+(rt.down||0);
 let score=72+Math.min(18,plays*2)+Math.min(10,votes*2);
 if(total){const a=pct(m.correct,total);if(a<8||a>98)score-=18;else if(a<18||a>94)score-=8}
 if(votes>=3&&(rt.down||0)/votes>=.6)score-=25;
 if(new Set(q.a.map(normalizeText)).size!==q.a.length)score-=35;if(q.q.length<12)score-=10;
 return Math.max(0,Math.min(100,Math.round(score)));
}
function questionAudit(){
 const qs=[...baseWithOverrides(true),...readJson(CUSTOM_FILE,[]).map(normalizeQuestion)],metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),seen=new Map(),items=[];
 for(const q of qs){const key=normalizeText(q.q),quality=questionQuality(q,metrics,ratings),confidence=questionConfidence(q,metrics,ratings),problems=[];if(seen.has(key))problems.push('duplicate');else seen.set(key,q.id);if(new Set(q.a.map(normalizeText)).size!==q.a.length)problems.push('duplicate-options');if(q.q.length<12)problems.push('wording');if(confidence<45)problems.push('low-confidence');if(quality<40)problems.push('low-quality');items.push({id:q.id,c:q.c,q:q.q,quality,confidence,problems,status:(problems.includes('duplicate')||problems.includes('duplicate-options')||confidence<35)?'red':(problems.length||confidence<60)?'yellow':'green'})}
 const summary={total:items.length,green:items.filter(x=>x.status==='green').length,yellow:items.filter(x=>x.status==='yellow').length,red:items.filter(x=>x.status==='red').length};return {summary,items};
}
function composeQuiz(o={}){
 const minutes=Math.max(10,Math.min(120,+o.minutes||30)),count=Math.max(10,Math.min(80,Math.round(minutes*.7))),publicPlace=['public','journey'].includes(o.environment),hard=String(o.level||'normal');
 const rounds=[{name:'Uppvärmning',type:'classic',weight:.2,difficulty:'easy'},{name:'Blandad kunskap',type:'classic',weight:.3,difficulty:hard==='hard'?'hard':'mixed'},{name:'Bildrunda',type:'zoom',weight:.15,difficulty:'mixed',categories:['Bildrunda']},{name:'Utmaningen',type:'connections',weight:.15,difficulty:'medium'},{name:'Final',type:'risk',weight:.2,difficulty:hard==='easy'?'medium':'hard'}];
 let used=0;rounds.forEach((r,i)=>{r.count=i===rounds.length-1?count-used:Math.max(2,Math.round(count*r.weight));used+=r.count;delete r.weight});return {name:`Smart ${minutes} min`,count,minutes,audioQuestions:!publicPlace&&o.audioQuestions===true,rounds};
}
function quizRatingFor(sessionId,name){const h=readHistory().filter(x=>(sessionId&&x.sessionId===sessionId)||(!sessionId&&x.name===name));let rating=1500;for(const e of h){const acc=e.total?(e.correct||0)/e.total:.5;rating+=Math.round((acc-.55)*36+(e.win?8:0));}return Math.max(800,Math.min(2400,rating));}
function groupFingerprint(ids){return [...new Set(ids.filter(Boolean))].sort().join('|')}
function updateGroupMemory(r){const fp=groupFingerprint(r.players.map(p=>p.sessionId));if(r.players.length<2||!fp)return;const all=readJson(GROUPS_FILE,{}),g=all[fp]||(all[fp]={games:0,lastPlayedAt:null,winners:{},members:r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar}))});g.games++;g.lastPlayedAt=new Date().toISOString();const top=r.players.slice().sort((a,b)=>b.score-a.score)[0];if(top)g.winners[top.sessionId]=(g.winners[top.sessionId]||0)+1;g.members=r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar}));all[fp]=g;writeJson(GROUPS_FILE,all)}

function profileStrength(sessionId,name){const h=readHistory().filter(x=>(sessionId&&x.sessionId===sessionId)||(!sessionId&&x.name===name));if(!h.length)return 50;let c=0,t=0,w=0;for(const x of h){c+=x.correct||0;t+=x.total||0;w+=x.win?1:0}return Math.round((t?c/t*70:35)+Math.min(30,w*3))}
function balanceTeams(r){const names=r.teamNames.slice(0,Math.min(4,Math.max(2,r.teamNames.length))),scores=Object.fromEntries(names.map(n=>[n,0]));const ranked=r.players.map(p=>({p,strength:profileStrength(p.sessionId,p.name)})).sort((a,b)=>b.strength-a.strength);for(const x of ranked){const team=names.slice().sort((a,b)=>scores[a]-scores[b])[0];x.p.team=team;scores[team]+=x.strength}return scores}
function uniqueNickname(r,name,sid){const used=new Set(r.players.filter(p=>p.sessionId!==sid).map(p=>p.name.toLocaleLowerCase('sv-SE')));if(!used.has(name.toLocaleLowerCase('sv-SE')))return name;let i=2;while(used.has(`${name} ${i}`.toLocaleLowerCase('sv-SE')))i++;return `${name} ${i}`.slice(0,20)}



function normalizeText(s){return String(s||'').toLocaleLowerCase('sv-SE').normalize('NFKD').replace(/[^a-z0-9åäö ]/g,' ').replace(/\s+/g,' ').trim()}
function answerMatches(input,correct,q){const a=normalizeText(input),c=normalizeText(correct);if(!a||!c)return false;if(a===c)return true;const aliases=new Set([...(Array.isArray(q?.specialData?.accepted)?q.specialData.accepted:[]),...(Array.isArray(q?.accepted)?q.accepted:[])] .map(normalizeText));if(aliases.has(a))return true;const compact=x=>x.replace(/\b(the|a|an|ett|en|den|det)\b/g,' ').replace(/\s+/g,' ').trim();if(compact(a)===compact(c))return true;const lev=(x,y)=>{const d=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=y.length;j++){const tmp=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(x[i-1]===y[j-1]?0:1));prev=tmp}}return d[y.length]};return c.length>=6&&Math.abs(a.length-c.length)<=2&&lev(a,c)<=1}
function questionDoctor(){
 const qs=allQuestions(),metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),issues=[],exact=new Map(),prefix=new Map();
 for(const q of qs){
   const n=normalizeText(q.q),m=metrics[q.id]||{},rt=ratings[q.id]||{},votes=(rt.up||0)+(rt.down||0),quality=questionQuality(q,metrics,ratings),acc=m.total?pct(m.correct,m.total):null;
   if(!exact.has(n))exact.set(n,[]);exact.get(n).push(q.id);
   const pk=n.split(' ').slice(0,8).join(' ');if(pk.length>18){if(!prefix.has(pk))prefix.set(pk,[]);prefix.get(pk).push(q.id)}
   const duplicateOptions=new Set(q.a.map(normalizeText)).size!==q.a.length;
   if(duplicateOptions)issues.push({severity:'high',type:'duplicate-options',id:q.id,c:q.c,q:q.q,quality,message:'Duplicerade svarsalternativ.'});
   if(votes>=3&&(rt.down||0)/votes>=.6)issues.push({severity:'high',type:'rating',id:q.id,c:q.c,q:q.q,quality,message:`${rt.down||0} av ${votes} röster är negativa.`});
   if((m.plays||0)>=5&&acc>=95)issues.push({severity:'medium',type:'too-easy',id:q.id,c:q.c,q:q.q,quality,message:`${acc}% rätt efter ${m.plays} spel.`});
   if((m.plays||0)>=5&&acc<=15)issues.push({severity:'medium',type:'too-hard',id:q.id,c:q.c,q:q.q,quality,message:`${acc}% rätt efter ${m.plays} spel.`});
   if((m.plays||0)>=5&&quality<40)issues.push({severity:'high',type:'low-quality',id:q.id,c:q.c,q:q.q,quality,message:`Quality Score ${quality}/100.`});
   if(q.q.length<12)issues.push({severity:'medium',type:'wording',id:q.id,c:q.c,q:q.q,quality,message:'Mycket kort frågetext – kontrollera formuleringen.'});
 }
 for(const ids of exact.values())if(ids.length>1)for(const id of ids.slice(1)){const q=qs.find(x=>x.id===id);issues.push({severity:'high',type:'duplicate',id,c:q?.c||'',q:q?.q||'',quality:questionQuality(q,metrics,ratings),message:`Exakt dubblett (${ids.length} frågor).`})}
 for(const ids of prefix.values())if(ids.length>1&&ids.length<8)for(const id of ids.slice(1)){if(issues.some(x=>x.id===id&&x.type==='duplicate'))continue;const q=qs.find(x=>x.id===id);issues.push({severity:'low',type:'near-duplicate',id,c:q?.c||'',q:q?.q||'',quality:questionQuality(q,metrics,ratings),message:'Möjlig närliggande dubblett.'})}
 const order={high:0,medium:1,low:2};issues.sort((a,b)=>order[a.severity]-order[b.severity]||a.quality-b.quality);
 return {generatedAt:new Date().toISOString(),questions:qs.length,issues,summary:{high:issues.filter(x=>x.severity==='high').length,medium:issues.filter(x=>x.severity==='medium').length,low:issues.filter(x=>x.severity==='low').length,reviewQuestions:new Set(issues.map(x=>x.id)).size}};
}
function quizDNA(profile){
 const cats=Object.entries(profile.categories||{}).map(([name,v])=>({name,score:v.total?Math.round(v.correct/v.total*100):0,total:v.total})).filter(x=>x.total>=3).sort((a,b)=>b.score-a.score);
 return {strength:cats[0]||null,nemesis:cats.at(-1)||null,categories:cats.slice(0,12),style:(profile.bestStreak||0)>=10?'🔥 Streakspelare':(profile.accuracy||0)>=75?'🎯 Precision':(profile.games||0)>=10?'🧠 Erfaren':'🌱 Upptäckare'};
}
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
 {id:'team-night',name:'Team Night',description:'Social lagkväll med klassiska frågor, bildrunda, connections, risk och lagfinal.',teamNight:true,rounds:[
  {name:'Lagstart',type:'classic',count:5,categories:['Allmänbildning','Sverige','Djur & natur']},
  {name:'Bildlaget',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'Tänk tillsammans',type:'connections',count:4,categories:[]},
  {name:'Våga tillsammans',type:'risk',count:4,categories:['Historia','Vetenskap & teknik','Sport']},
  {name:'Lagfinal',type:'buzzer',count:5,categories:['Allmänbildning','Sverige','Film & TV','Musik','Sport']}
 ]},
 {id:'risk-final-night',name:'Risk Final',description:'Klassisk quizkväll som avslutas med en dramatisk riskfinal.',rounds:[
  {name:'Uppvärmning',type:'classic',count:6,categories:['Allmänbildning','Sverige','Historia']},
  {name:'Variation',type:'classic',count:6,categories:['Film & TV','Musik','Sport','Mat & dryck']},
  {name:'Bildrunda',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'FINAL · Våga allt',type:'risk',count:5,categories:['Allmänbildning','Historia','Vetenskap & teknik','Sverige']}
 ]},
 {id:'autopilot-night',name:'Auto-Pilot',description:'Director bygger en balanserad quizkväll med dramaturgi, variation och stark final.',rounds:[
  {name:'Uppvärmning',type:'classic',count:6,difficulty:'easy'},
  {name:'Blandad kunskap',type:'classic',count:7,difficulty:'mixed'},
  {name:'Bildrunda',type:'zoom',count:5,categories:['Bildrunda']},
  {name:'Precision',type:'estimate',count:3,difficulty:'mixed'},
  {name:'Tidslinjen',type:'sort',count:3,difficulty:'mixed'},
  {name:'FINAL · Våga allt',type:'risk',count:4,difficulty:'hard'}
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
function writeHistory(h){writeJson(HIGHSCORE_FILE,h.slice(-10000));invalidateHallOfFame()}
function historyFromGames(){
 const games=readJson(GAMES_FILE,[]),out=[];
 for(const g of games){
  const ps=Array.isArray(g.players)?g.players:[],top=ps.length?Math.max(...ps.map(p=>Number(p.score||0))):0,winningTeam=g.mode==='teams'?(g.teams?.[0]?.name||''):'';
  for(const p of ps){const st=p.stats||{};out.push({gameId:g.gameId,season:g.season||currentSeason(new Date(g.at)),at:g.at,sessionId:p.sessionId,name:p.name,avatar:p.avatar,score:Number(p.score||0),win:g.mode==='teams'?p.team===winningTeam:Number(p.score||0)===top,correct:Number(st.correct||0),total:Number(st.total||0),bestStreak:Number(st.bestStreak||0),visualCorrect:Number(st.visualCorrect||0),visualTotal:Number(st.visualTotal||0),responseTotalMs:Number(st.responseTotalMs||0),responseCount:Number(st.responseCount||0),categories:st.categories||{}})}
 }
 return out;
}
function effectiveHistory(){
 const stored=readHistory(),fromGames=historyFromGames(),by=new Map();
 for(const e of [...fromGames,...stored]){const key=`${e.gameId||e.at||''}|${e.sessionId||String(e.name||'').toLowerCase()}`;by.set(key,e)}
 return [...by.values()].sort((a,b)=>Date.parse(a.at||0)-Date.parse(b.at||0));
}
let hallOfFameCache={at:0,value:null};
function hallOfFame(force=false){
 const now=Date.now();
 if(!force&&hallOfFameCache.value&&now-hallOfFameCache.at<10000)return hallOfFameCache.value;
 const h=effectiveHistory(),by={};
 for(const e of h){const k=(e.sessionId||e.name||'').toLowerCase();const a=by[k]||(by[k]={sessionId:e.sessionId,name:e.name,avatar:e.avatar||'😀',games:0,wins:0,totalScore:0,bestScore:0,correct:0,total:0,bestStreak:0,visualCorrect:0,visualTotal:0,responseTotalMs:0,responseCount:0,categories:{}});a.games++;a.wins+=e.win?1:0;a.totalScore+=e.score||0;a.bestScore=Math.max(a.bestScore,e.score||0);a.correct+=e.correct||0;a.total+=e.total||0;a.bestStreak=Math.max(a.bestStreak,e.bestStreak||0);a.visualCorrect+=e.visualCorrect||0;a.visualTotal+=e.visualTotal||0;a.responseTotalMs+=e.responseTotalMs||0;a.responseCount+=e.responseCount||0;for(const [c,v] of Object.entries(e.categories||{})){const z=a.categories[c]||(a.categories[c]={correct:0,total:0});z.correct+=v.correct||0;z.total+=v.total||0}}
 const all=Object.values(by).map(a=>({...a,accuracy:pct(a.correct,a.total),avgResponseMs:a.responseCount?Math.round(a.responseTotalMs/a.responseCount):null}));
 const best=(arr,cmp)=>arr.slice().sort(cmp).slice(0,10);
 const value={games:new Set(h.map(x=>x.gameId)).size,players:all.length,highestScores:best(all,(a,b)=>b.bestScore-a.bestScore),mostWins:best(all,(a,b)=>b.wins-a.wins),bestAccuracy:best(all.filter(a=>a.total>=10),(a,b)=>b.accuracy-a.accuracy),bestStreak:best(all,(a,b)=>b.bestStreak-a.bestStreak),fastest:best(all.filter(a=>a.responseCount>=5),(a,b)=>a.avgResponseMs-b.avgResponseMs),lastGames:h.slice(-20).reverse()};
 hallOfFameCache={at:now,value};
 return value;
}
function invalidateHallOfFame(){hallOfFameCache.at=0;hallOfFameCache.value=null}

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
function customLeagueStandings(league){
 const rows=Object.values(league?.standings||{}).map(x=>({...x,accuracy:pct(x.correct,x.total)}));
 return rows.sort((a,b)=>b.leaguePoints-a.leaguePoints||b.wins-a.wins||b.quizPoints-a.quizPoints||b.correct-a.correct);
}
function updateCustomLeague(r){
 const id=cleanId(r.settings?.league);if(!id)return;
 const all=readJson(LEAGUES_FILE,[]),l=all.find(x=>x.id===id&&x.active!==false);if(!l)return;
 const ps=(r.players||[]).slice().sort((a,b)=>b.score-a.score),points=Array.isArray(l.points)?l.points:[3,2,1];
 let place=0,lastScore=null;
 for(let i=0;i<ps.length;i++){
  const p=ps[i];if(lastScore===null||p.score!==lastScore)place=i;lastScore=p.score;
  const k=p.sessionId||p.name.toLowerCase(),x=l.standings[k]||(l.standings[k]={sessionId:p.sessionId,name:p.name,avatar:p.avatar||'😀',games:0,wins:0,podiums:0,leaguePoints:0,quizPoints:0,correct:0,total:0});
  x.name=p.name;x.avatar=p.avatar||'😀';x.games++;x.wins+=place===0?1:0;x.podiums+=place<3?1:0;x.leaguePoints+=Number(points[place]||0);x.quizPoints+=Number(p.score||0);x.correct+=Number(p.stats?.correct||0);x.total+=Number(p.stats?.total||0);
 }
 l.games=(l.games||0)+1;l.updatedAt=new Date().toISOString();writeJson(LEAGUES_FILE,all);
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
function currentSeason(d=new Date()){const y=d.getFullYear(),half=d.getMonth()<6?'Vår':'Höst';return `${half} ${y}`}
function seasonStandings(season=currentSeason()){const games=readJson(GAMES_FILE,[]).filter(g=>(g.season||currentSeason(new Date(g.at)))===season),by={};for(const g of games){const ps=(g.players||[]).slice().sort((a,b)=>b.score-a.score),top=ps[0]?.score;for(const p of ps){const k=p.sessionId||p.name,x=by[k]||(by[k]={sessionId:p.sessionId,name:p.name,avatar:p.avatar||'😀',games:0,wins:0,points:0,correct:0,total:0});x.games++;x.points+=p.score||0;x.wins+=p.score===top?1:0;x.correct+=p.stats?.correct||0;x.total+=p.stats?.total||0}}return Object.values(by).map(x=>({...x,accuracy:pct(x.correct,x.total)})).sort((a,b)=>b.wins-a.wins||b.points-a.points)}
function persistDetailedGame(r,gameId){
 const games=readJson(GAMES_FILE,[]);
 const season=currentSeason();
 games.push({gameId,season,at:new Date().toISOString(),code:r.code,mode:r.mode,settings:r.settings,players:r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar,team:p.team,score:p.score,stats:p.stats,achievements:achievementsFor(r,p)})),teams:teamStandings(r),questionStats:r.questionStats,events:r.events||[],insights:gameInsights(r),highlights:gameHighlights(r)});
 writeJson(GAMES_FILE,games.slice(-300));updateLeague(r);updateTournament(r);updateCustomLeague(r);
}
function persistGame(r){
 const h=readHistory(), top=Math.max(...r.players.map(p=>p.score)), winningTeam=r.mode==='teams'?(teamStandings(r)[0]?.name||''):'' ,gameId=`${Date.now()}-${r.code}`;
 for(const p of r.players)h.push({gameId,season:currentSeason(),at:new Date().toISOString(),sessionId:p.sessionId,name:p.name,avatar:p.avatar,score:p.score,win:r.mode==='teams'?p.team===winningTeam:p.score===top,correct:p.stats.correct,total:p.stats.total,bestStreak:p.stats.bestStreak,visualCorrect:p.stats.visualCorrect,visualTotal:p.stats.visualTotal,responseTotalMs:p.stats.responseTotalMs,responseCount:p.stats.responseCount,categories:p.stats.categories});
 writeHistory(h);persistDetailedGame(r,gameId);updateQuestionMetrics(r);
}

const rooms=new Map(),timers=new Map(),directorTimers=new Map();
let roomPersistTimer=null;
function serializeRoom(r){return {...r,answers:[...(r.answers||new Map()).entries()],predictions:[...(r.predictions||new Map()).entries()],seen:[...(r.seen||new Set())],buzzerTried:[...(r.buzzerTried||new Set())],tiebreakEligible:r.tiebreakEligible?[...r.tiebreakEligible]:null,players:r.players.map(p=>({...p,socketId:null,connected:false}))}}
function persistActiveRooms(){try{writeJson(ACTIVE_ROOMS_FILE,{version:1,at:new Date().toISOString(),rooms:[...rooms.values()].filter(r=>r.phase!=='finished').map(serializeRoom)})}catch{}}
function scheduleRoomPersist(){if(roomPersistTimer)return;roomPersistTimer=setTimeout(()=>{roomPersistTimer=null;persistActiveRooms()},400);roomPersistTimer.unref?.()}
function restoreActiveRooms(){const x=readJson(ACTIVE_ROOMS_FILE,{rooms:[]}),now=Date.now();for(const raw of x.rooms||[]){if(!raw?.code||!Array.isArray(raw.players))continue;const age=now-Date.parse(raw.updatedAt||x.at||0);if(Number.isFinite(age)&&age>12*60*60*1000)continue;const r={...raw,answers:new Map(raw.answers||[]),predictions:new Map(raw.predictions||[]),seen:new Set(raw.seen||[]),buzzerTried:new Set(raw.buzzerTried||[]),tiebreakEligible:raw.tiebreakEligible?new Set(raw.tiebreakEligible):null};if(r.phase==='question')r.phase='paused';r.paused=r.phase==='paused';r.players=r.players.map(p=>({...p,connected:false,socketId:null}));rooms.set(r.code,r)}}
restoreActiveRooms();

function findPlayer(r,sid){return r.players.find(p=>p.sessionId===sid)}
function clearTimer(r){const t=timers.get(r.code);if(t){clearTimeout(t);timers.delete(r.code)}const d=directorTimers.get(r.code);if(d){clearTimeout(d);directorTimers.delete(r.code)}}
function teamStandings(r){const m=new Map();for(const p of r.players){if(!p.team)continue;const x=m.get(p.team)||{name:p.team,totalScore:0,score:0,players:0};x.totalScore+=p.score;x.players++;m.set(p.team,x)}for(const x of m.values())x.score=r.settings?.teamScoring==='sum'?x.totalScore:Math.round(x.totalScore/Math.max(1,x.players));return [...m.values()].sort((a,b)=>b.score-a.score||b.totalScore-a.totalScore||a.name.localeCompare(b.name))}
function roomPublic(r){return {code:r.code,phase:r.phase,hostSessionId:r.hostSessionId,mode:r.mode,teamNames:r.teamNames,teams:teamStandings(r),buzzerWinner:r.buzzerWinner||'',players:r.players.map(p=>({sessionId:p.sessionId,name:p.name,avatar:p.avatar,team:p.team||'',score:p.score,connected:p.connected,powerups:p.powerups||{},stats:{correct:p.stats.correct,total:p.stats.total,bestStreak:p.stats.bestStreak},captain:!!p.captain,profileStrength:profileStrength(p.sessionId,p.name)})),teamPowerups:r.teamPowerups||{},settings:r.settings,currentQuestion:['question','paused'].includes(r.phase)?r.currentPublic:null,round:r.round,rounds:r.rounds,questionStats:r.questionStats,paused:r.paused,recovered:!!r.recovered,connection:{connected:r.players.filter(p=>p.connected).length,total:r.players.length},answerProgress:{answered:r.answers?.size||0,total:(r.settings?.teamCollaborative?r.teamNames.filter(n=>r.players.some(p=>p.team===n&&p.connected)).length:r.players.length)},finalHidden:!!(r.settings?.finalHiddenStandings&&r.round===r.rounds&&r.phase!=='finished'),meta:{questions:catalogueSummary().questions,categories:catalogueSummary().categories,maxPlayers:100,packs:allPacks(),gamePlans:allGamePlans(),tournaments:readJson(TOURNAMENT_FILE,[]).filter(t=>t.active!==false).map(t=>({id:t.id,name:t.name})),leagues:readJson(LEAGUES_FILE,[]).filter(l=>l.active!==false).map(l=>({id:l.id,name:l.name}))}}}
function emitRoom(r){r.updatedAt=new Date().toISOString();scheduleRoomPersist();io.to(r.code).emit('roomState',roomPublic(r))}
function makeRoom(name,sid){let c;do c=roomCode();while(rooms.has(c));const r={code:c,hostToken:token(),hostSessionId:sid,phase:'lobby',mode:'individual',teamNames:['Lag 1','Lag 2'],players:[{sessionId:sid,name,avatar:'😀',team:'',score:0,connected:true,socketId:null,stats:freshStats(),roundScores:[],powerups:{fifty:1,double:1,shield:1}}],deck:[],index:0,answers:new Map(),seen:new Set(),settings:{count:20,timer:15,difficulty:'mixed',categories:[],roundSize:5,finalBonusCount:5,pack:'',screenMode:'all',gamePlan:'',profile:'ultimate',powerups:true,teamScoring:'average',director:true,drama:true,autoTeams:true,teamPowerups:true,audioQuestions:false,smartDifficulty:true,environment:'public',directorLevel:3,noRepeatDays:180,finalHiddenStandings:true},round:1,rounds:4,current:null,currentPublic:null,questionStartedAt:0,questionStats:[],paused:false,persisted:false,tiebreak:false,lastResult:null,lastGameOver:null,buzzerWinner:'',roundName:'',midRanks:null,events:[]};rooms.set(c,r);return r}

function selectDeck(r,s){
 const sessionIds=r.players.map(p=>p.sessionId),days=Math.max(1,+s.noRepeatDays||180);
 const globalSeen=storage.seenQuestionIds(sessionIds,days),seenFacts=storage.seenFactKeys(sessionIds,days);
 let qs=allQuestions().filter(q=>(s.audioQuestions===true||!q.audio)&&!globalSeen.has(q.id)&&(!q.factKey||!seenFacts.has(q.factKey))),plan=allGamePlans().find(x=>x.id===s.gamePlan);
 // If semantic no-repeat makes a narrow category impossible, relax fact-family filtering before repeating exact question IDs.
 if(qs.length<Math.max(10,+s.count||20))qs=allQuestions().filter(q=>(s.audioQuestions===true||!q.audio)&&!globalSeen.has(q.id));
 if(plan){
   const deck=[];let roundIndex=0;
   for(const round of plan.rounds||[]){roundIndex++;let pool=specialPool(round.type).filter(q=>(s.audioQuestions===true||!q.audio)&&!r.seen.has(q.id)&&!globalSeen.has(q.id));if(!pool.length)pool=qs.filter(q=>!r.seen.has(q.id));if(round.categories?.length){pool=pool.filter(q=>round.categories.includes(q.c));if(!pool.length&&s.audioQuestions!==true&&round.categories.includes('Musikquiz'))pool=qs.filter(q=>q.c==='Musik'&&!r.seen.has(q.id));}if(round.difficulty&&round.difficulty!=='mixed')pool=pool.filter(q=>q.d===round.difficulty);for(const q of smartPick(pool,Math.max(1,+round.count||5),r))deck.push({...q,_forcedType:round.type||q.specialType||'classic',_roundName:round.name||`Runda ${roundIndex}`,_roundIndex:roundIndex})}
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
 const upcomingAssets=r.deck.slice(r.index+1,r.index+6).flatMap(x=>[x.visual,x.audio]).filter(Boolean);const visualEffect=q.visual?(q._forcedType==='zoom'?'zoom':(q.c==='Bildrunda'&&r.index%4===1?'pixel':q.c==='Bildrunda'&&r.index%4===2?'silhouette':'none')):'none';
 return {id:q.id,number:r.index+1,total:r.deck.length,round:r.round,rounds:r.rounds,roundName:r.roundName||q._roundName||`Runda ${r.round}`,category:q.c,difficulty:q.d==='easy'?'Lätt':q.d==='hard'?'Svår':'Medel',timer:r.settings.timer,visual:q.visual||'',audio:q.audio||'',text:r.displayText||q.q,options:['text','estimate','clue','sort','map','pin'].includes(type)?[]:opts.map(o=>o.label),multiplier,tiebreak:r.tiebreak,type,riskOptions:(r.round===r.rounds?[0,250,500,1000]:[100,250,500]),clues,specialData:q.specialData||null,audioStart:q.audioStart||0,audioDuration:q.audioDuration||0,duelists:r.duelists||[],jackpot:r.jackpot||0,mystery:q._forcedType==='mystery',recordNote:(()=>{const leader=r.players.slice().sort((a,b)=>b.score-a.score)[0],streak=r.players.slice().sort((a,b)=>b.stats.bestStreak-a.stats.bestStreak)[0];if(streak?.stats?.streak>=5)return `🔥 ${streak.name} har ${streak.stats.streak} rätt i rad!`;if(leader&&r.index>0)return `👑 ${leader.name} leder med ${leader.score} poäng`;return ''})(),buzzerWinner:r.buzzerWinner||'',visualEffect,upcomingAssets};
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
 let correctCount=0,responseSum=0,responseCount=0;const answerDistribution={};const correctStrengths=[],wrongStrengths=[];
 const norm=x=>String(x??'').trim().toLocaleLowerCase('sv-SE').replace(/[.!?]/g,'');
 const correctText=String(q.a[q.r]??''),correctNumber=parseFloat(correctText.replace(',','.'));
 const estimateDistances=r.currentType==='estimate'&&Number.isFinite(correctNumber)?r.players.map(p=>{const a=r.answers.get(p.sessionId),n=parseFloat(String(a?.numericAnswer??'').replace(',','.'));return Number.isFinite(n)?Math.abs(n-correctNumber):Infinity}):[];
 const estimateMin=estimateDistances.length?Math.min(...estimateDistances):Infinity;
 for(const p of r.players){
   const eligible=(!r.tiebreak||!r.tiebreakEligible||r.tiebreakEligible.has(p.sessionId))&&(r.currentType!=='duel'||r.duelists.includes(p.sessionId));
   const ans=r.answers.get(p.sessionId);let ok=eligible&&!skipped&&!!ans;
   if(ok&&r.currentType==='text')ok=answerMatches(ans.textAnswer,correctText,q);
   else if(ok&&r.currentType==='clue')ok=answerMatches(ans.textAnswer,correctText,q);
   else if(ok&&r.currentType==='estimate'){const n=parseFloat(String(ans.numericAnswer??'').replace(',','.'));ok=Number.isFinite(n)&&Math.abs(n-correctNumber)===estimateMin}
   else if(ok&&r.currentType==='sort'){ok=JSON.stringify(ans.order||[])===JSON.stringify(q.specialData?.correct||[])}
   else if(ok&&r.currentType==='map'){const lat=+ans.mapLat,lon=+ans.mapLon,tlat=+q.specialData?.lat,tlon=+q.specialData?.lon;const dlat=(lat-tlat)*Math.PI/180,dlon=(lon-tlon)*Math.PI/180,a=Math.sin(dlat/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(tlat*Math.PI/180)*Math.sin(dlon/2)**2;ans.distanceKm=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));ok=Number.isFinite(ans.distanceKm)}
   else if(ok&&r.currentType==='pin'){const dx=(+ans.pinX-(+q.specialData?.x)),dy=(+ans.pinY-(+q.specialData?.y));ans.pinDistance=Math.sqrt(dx*dx+dy*dy);ok=Number.isFinite(ans.pinDistance)}
   else if(ok&&r.currentType==='duel'){ok=r.duelists.includes(p.sessionId)&&ans.answerIndex===correctIndex}
   else if(ok)ok=ans.answerIndex===correctIndex;
   if(ans){const chosenLabel=(Number.isInteger(ans.answerIndex)&&q.opts?.[ans.answerIndex])?q.opts[ans.answerIndex].label:(ans.textAnswer||ans.numericAnswer||'special');answerDistribution[chosenLabel]=(answerDistribution[chosenLabel]||0)+1}
   const strength=profileStrength(p.sessionId,p.name);if(ans){(ok?correctStrengths:wrongStrengths).push(strength)}
   let gain=0;
   const st=p.stats||(p.stats=freshStats());const cs=st.categories[q.c]||(st.categories[q.c]={correct:0,total:0});
   if(!eligible||(r.currentType==='buzzer'&&!ans)){results.push({sessionId:p.sessionId,correct:false,gain:0,responseMs:null,spectator:true});continue}
   if(!skipped){st.total++;cs.total++;if(q.visual)st.visualTotal++;if(q.c==='Onödigt vetande')st.uselessTotal++}
   if(ans?.responseMs>=0){st.responseTotalMs+=ans.responseMs;st.responseCount++;responseSum+=ans.responseMs;responseCount++}
   let scoreBreakdown={base:0,speedBonus:0,streakBonus:0,typeBonus:0,multiplier:mult,double:!!ans?.double,stake:0,total:0};
   if(ok){
     const effectiveDifficulty=actualDifficultyFor(q,questionMetrics()[q.id]);const base=effectiveDifficulty==='hard'?200:effectiveDifficulty==='medium'?150:100;scoreBreakdown.base=base;
     if(r.currentType==='risk'){gain=Math.max(0,Math.min(r.round===r.rounds?1000:500,+ans?.stake||100));scoreBreakdown.base=0;scoreBreakdown.stake=gain;scoreBreakdown.typeBonus=gain;st.riskWon++}
     else if(r.currentType==='buzzer'){gain=300;scoreBreakdown.base=0;scoreBreakdown.typeBonus=300;st.buzzWins++}
     else if(r.currentType==='speed'){scoreBreakdown.speedBonus=Math.max(0,100-Math.floor((ans?.responseMs||10000)/100));gain=base+scoreBreakdown.speedBonus}
     else if(r.currentType==='estimate'){gain=250;scoreBreakdown.base=0;scoreBreakdown.typeBonus=250}
     else if(r.currentType==='clue'){gain=Math.max(75,300-(+ans?.cluesUsed||0)*75);scoreBreakdown.base=0;scoreBreakdown.typeBonus=gain}
     else if(r.currentType==='text'){gain=200;scoreBreakdown.base=0;scoreBreakdown.typeBonus=200}
     else if(r.currentType==='sort'){gain=300;scoreBreakdown.base=0;scoreBreakdown.typeBonus=300}
     else if(r.currentType==='map'){gain=Math.max(50,Math.round(350-Math.min(300,(ans.distanceKm||3000)/5)));scoreBreakdown.base=0;scoreBreakdown.typeBonus=gain}
     else if(r.currentType==='pin'){gain=Math.max(50,Math.round(350-Math.min(300,(ans.pinDistance||1)*500)));scoreBreakdown.base=0;scoreBreakdown.typeBonus=gain}
     else if(r.currentType==='duel'){gain=350;scoreBreakdown.base=0;scoreBreakdown.typeBonus=350}
     else if(r.currentType==='jackpot'){gain=Math.max(500,jackpotValue||500);scoreBreakdown.base=0;scoreBreakdown.typeBonus=gain}
     else gain=base;
     if(!r.settings?.familyMode&&r.settings?.profile!=='family'&&r.currentType!=='risk'&&r.currentType!=='jackpot'){scoreBreakdown.streakBonus=Math.min(100,(st.streak||0)*20);gain+=scoreBreakdown.streakBonus}
     if(ans?.double){gain*=2}
     gain*=mult;scoreBreakdown.total=gain;p.score+=gain;st.correct++;cs.correct++;st.streak++;st.bestStreak=Math.max(st.bestStreak,st.streak);if(q.visual)st.visualCorrect++;correctCount++;
   }else if(!skipped){
     st.streak=0;
     if(r.currentType==='risk'){const loss=Math.max(0,Math.min(r.round===r.rounds?1000:500,+ans?.stake||100));scoreBreakdown={base:0,speedBonus:0,streakBonus:0,typeBonus:0,multiplier:1,double:false,stake:loss,total:0};if(ans?.shield){}else{gain=-loss;scoreBreakdown.total=gain;p.score+=gain;st.riskLost++}}
     else if(r.currentType==='buzzer'&&ans){gain=-100;scoreBreakdown={base:0,speedBonus:0,streakBonus:0,typeBonus:-100,multiplier:1,double:false,stake:0,total:gain};p.score+=gain}
   }
   results.push({sessionId:p.sessionId,correct:ok,gain,scoreBreakdown:{...scoreBreakdown,questionType:r.currentType,total:gain},responseMs:ans?.responseMs??null,mapLat:Number.isFinite(ans?.mapLat)?ans.mapLat:null,mapLon:Number.isFinite(ans?.mapLon)?ans.mapLon:null,distanceKm:Number.isFinite(ans?.distanceKm)?Math.round(ans.distanceKm):null,pinX:Number.isFinite(ans?.pinX)?ans.pinX:null,pinY:Number.isFinite(ans?.pinY)?ans.pinY:null,pinDistance:Number.isFinite(ans?.pinDistance)?ans.pinDistance:null});
 }
 if(r.currentType==='jackpot'&&correctCount>0)r.jackpot=0;const actualPct=pct(correctCount,Math.max(1,r.currentType==='duel'?r.duelists.length:r.players.length));for(const p of r.players){const pred=r.settings?.soloMode?null:r.predictions?.get(p.sessionId);if(Number.isFinite(pred)&&Math.abs(pred-actualPct)<=15){p.score+=50;const rr=results.find(x=>x.sessionId===p.sessionId);if(rr){rr.predictionBonus=50;rr.gain+=50;if(rr.scoreBreakdown)rr.scoreBreakdown.total=rr.gain}}}
 r.events.push(...results.filter(x=>x.gain).map(x=>({at:Date.now(),questionId:q.id,type:r.currentType,sessionId:x.sessionId,gain:x.gain,secretBonus})));const discrimination=(correctStrengths.length&&wrongStrengths.length)?(correctStrengths.reduce((a,b)=>a+b,0)/correctStrengths.length-wrongStrengths.reduce((a,b)=>a+b,0)/wrongStrengths.length)/100:null;r.questionStats.push({id:q.id,text:q.q,type:r.currentType,round:r.round,correct:correctCount,total:r.players.length,accuracy:pct(correctCount,r.players.length),avgResponseMs:responseCount?Math.round(responseSum/responseCount):null,skipped,answerDistribution,discrimination});
 if(!r.tiebreak&&r.index+1===Math.ceil(r.deck.length/2)){r.midRanks={};r.players.slice().sort((a,b)=>b.score-a.score).forEach((p,i)=>{r.midRanks[p.sessionId]={rank:i+1,score:p.score}})}
 r.phase='result';emitRoom(r);
 const correctAnswer=skipped?'Frågan hoppades över':r.currentType==='sort'?(q.specialData?.correct||[]).join(' → '):r.currentType==='map'?(q.specialData?.name||q.f):r.currentType==='pin'?q.f:q.opts[correctIndex]?.label;
 r.lastResult={correctAnswer,explanation:q.f,results,room:roomPublic(r),hostSessionId:r.hostSessionId,skipped,secretBonus,type:r.currentType,specialData:q.specialData||null,visual:q.visual||'',questionId:q.id,ratingPrompt:(r.index%7===3)};
 io.to(r.code).emit('roundResult',r.lastResult);dramaMoment(r,results,correctCount);directorSchedule(r,'result');
}
function smartRebalanceNext(r){
 if(!r.settings?.smartDifficulty||r.index<3||r.index>=r.deck.length-1)return;
 const recent=r.questionStats.slice(-3),avg=recent.reduce((a,x)=>a+(x.accuracy||0),0)/Math.max(1,recent.length),want=avg<35?'easy':avg>80?'hard':'medium';
 const metrics=questionMetrics();const j=r.deck.findIndex((q,i)=>i>r.index&&actualDifficultyFor(q,metrics[q.id])===want&&!q._forcedType);if(j>r.index){const tmp=r.deck[r.index+1];r.deck[r.index+1]=r.deck[j];r.deck[j]=tmp}
}
function advance(r){if(r.settings?.teamCollaborative&&r.mode==='teams'){for(const n of r.teamNames){const ms=r.players.filter(p=>p.team===n);if(ms.length){const i=ms.findIndex(p=>p.captain);ms.forEach(p=>p.captain=false);ms[(i+1+ms.length)%ms.length].captain=true}}}
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
 r.phase='finished';if(!isTie&&!r.persisted){persistGame(r);updateGroupMemory(r);storage.markSeen(r.players.map(p=>p.sessionId),[...r.seen]);storage.markFacts(r.players.map(p=>p.sessionId),r.deck.map(q=>q.factKey).filter(Boolean));r.persisted=true}
 storage.event(r.code,'game-finished',{players:r.players.map(p=>({sessionId:p.sessionId,name:p.name,score:p.score}))});
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

const adminSessions=new Map();
let adminAuthCacheLoaded=false,adminAuthCache=null;
function cookieValue(req,name){const raw=String(req.headers.cookie||'');for(const part of raw.split(';')){const i=part.indexOf('=');if(i<0)continue;if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim())}return ''}
function adminAuth(force=false){if(adminAuthCacheLoaded&&!force)return adminAuthCache;const x=readJson(ADMIN_AUTH_FILE,null);adminAuthCache=x&&x.version===1&&x.username&&x.salt&&x.hash?x:null;adminAuthCacheLoaded=true;return adminAuthCache}
function setAdminAuth(auth){writeJson(ADMIN_AUTH_FILE,auth);adminAuthCache=auth;adminAuthCacheLoaded=true}
function safeEqualText(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function passwordHash(password,salt){return new Promise((resolve,reject)=>crypto.scrypt(String(password),Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1},(err,key)=>err?reject(err):resolve(key.toString('hex'))))}
async function validPassword(password,auth){try{return safeEqualText(await passwordHash(password,auth.salt),auth.hash)}catch{return false}}
function newAdminSession(username){const t=token();adminSessions.set(t,{username,expires:Date.now()+12*60*60*1000});return t}
function setAdminCookie(req,res,t){const secure=req.secure||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';res.setHeader('Set-Cookie',`rq_admin_session=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`)}
function validAdminSession(req){const t=cookieValue(req,'rq_admin_session'),x=adminSessions.get(t);if(!t||!x)return false;if(x.expires<Date.now()){adminSessions.delete(t);return false}x.expires=Date.now()+12*60*60*1000;return true}
function adminAllowed(req){
 if(validAdminSession(req))return true;
 const ip=String(req.ip||req.socket.remoteAddress||'');return !ADMIN_KEY&&!adminAuth()&&(ip.includes('127.0.0.1')||ip.includes('::1'));
}
function requireAdmin(req,res,next){if(!adminAllowed(req))return res.status(401).json({ok:false,error:'Du är inte inloggad som administratör.'});next()}

ensureDataDir();
app.use('/media',express.static(MEDIA_DIR,{maxAge:'7d'}));
app.use(express.static(PUBLIC,{maxAge:'1h'}));
app.get('/health',(req,res)=>res.json({ok:true,version:APP_VERSION,rooms:rooms.size,questions:BASE_QUESTION_COUNT,status:'healthy'}));
app.get('/api/questions/meta',(req,res)=>{const x=catalogueSummary();res.json({version:APP_VERSION,questions:x.questions,categories:x.categories,difficulties:['easy','medium','hard'],packs:allPacks()})});
app.get('/api/highscores',(req,res)=>res.json(hallOfFame()));
app.get('/api/profiles',(req,res)=>{const h=effectiveHistory(),by={};for(const e of h){const k=e.sessionId||e.name.toLowerCase(),x=by[k]||(by[k]={sessionId:e.sessionId,name:e.name,avatar:e.avatar,games:0,wins:0,points:0,correct:0,total:0,bestStreak:0,categories:{}});x.games++;x.wins+=e.win?1:0;x.points+=e.score||0;x.correct+=e.correct||0;x.total+=e.total||0;x.bestStreak=Math.max(x.bestStreak,e.bestStreak||0);for(const [c,v] of Object.entries(e.categories||{})){const z=x.categories[c]||(x.categories[c]={correct:0,total:0});z.correct+=v.correct||0;z.total+=v.total||0}}const titles=readJson(TITLES_FILE,{});res.json(Object.values(by).map(x=>{const cats=Object.entries(x.categories).map(([c,v])=>({c,rate:v.total?v.correct/v.total:0,total:v.total})).filter(z=>z.total>=3).sort((a,b)=>b.rate-a.rate);const best= cats[0]?.c||'',auto=best==='Fotboll'?'⚽ Fotbollsnörden':best==='Musik'||best==='Musikquiz'?'🎵 Musikgurun':best==='Världen'||best==='Resor'?'🌍 Världsmästaren':x.bestStreak>=10?'🔥 Streakmästaren':x.wins>=5?'🏆 Quizmästaren':'🧠 Utmanaren';return {...x,accuracy:pct(x.correct,x.total),bestCategory:best,weakestCategory:cats.at(-1)?.c||'',title:titles[x.sessionId]||auto}}).sort((a,b)=>b.wins-a.wins||b.points-a.points))});
app.get('/api/rivalries',(req,res)=>{const games=readJson(GAMES_FILE,[]),pairs={};for(const g of games){const ps=(g.players||[]).slice().sort((a,b)=>b.score-a.score);for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j],ids=[a.sessionId||a.name,b.sessionId||b.name].sort(),k=ids.join('|'),x=pairs[k]||(pairs[k]={a:ids[0],b:ids[1],names:{},games:0,wins:{}});x.names[a.sessionId||a.name]=a.name;x.names[b.sessionId||b.name]=b.name;x.games++;const w=a.score===b.score?'tie':a.score>b.score?(a.sessionId||a.name):(b.sessionId||b.name);x.wins[w]=(x.wins[w]||0)+1}}res.json(Object.values(pairs).filter(x=>x.games>=2).sort((a,b)=>b.games-a.games).slice(0,50))});
app.get('/api/experience-summary',(req,res)=>{const games=readJson(GAMES_FILE,[]),h=readHistory(),metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{});const played=games.length,answers=Object.values(metrics).reduce((n,m)=>n+(+m.total||0),0),rated=Object.values(ratings).reduce((n,r)=>n+(+r.up||0)+(+r.down||0)+(+r.flag||0),0);res.json({ok:true,version:APP_VERSION,played,answers,rated,questions:allQuestions().length,autoPilot:true,teamNight:true,quietMode:true});});

app.get('/api/games',(req,res)=>{const g=readJson(GAMES_FILE,[]);res.json(g.slice(-50).reverse().map(x=>({gameId:x.gameId,at:x.at,mode:x.mode,players:x.players?.length||0,winner:x.mode==='teams'?x.teams?.[0]:x.players?.slice().sort((a,b)=>b.score-a.score)[0],settings:x.settings,insights:x.insights})))});
app.get('/api/games/:id',(req,res)=>{const x=readJson(GAMES_FILE,[]).find(g=>g.gameId===req.params.id);if(!x)return res.status(404).json({error:'Spelet hittades inte.'});res.json(x)});
app.get('/api/league',(req,res)=>{const t=Object.values(readJson(LEAGUE_FILE,{})).map(x=>({...x,accuracy:pct(x.correct,x.total)})).sort((a,b)=>b.wins-a.wins||b.points-a.points);res.json(t)});
app.get('/api/seasons',(req,res)=>{const games=readJson(GAMES_FILE,[]),names=[...new Set(games.map(g=>g.season||currentSeason(new Date(g.at))))].sort().reverse();res.json({current:currentSeason(),seasons:names,standings:seasonStandings(String(req.query.season||currentSeason()))})});
app.post('/api/question-rating',rateLimit('rating',60,60*1000),(req,res)=>{const id=cleanId(req.body?.questionId),vote=String(req.body?.vote||'');if(!id||!['up','down','flag'].includes(vote))return res.status(400).json({ok:false});const x=readJson(QUESTION_RATINGS_FILE,{}),q=x[id]||(x[id]={up:0,down:0,lastAt:null});q[vote]++;q.lastAt=new Date().toISOString();writeJson(QUESTION_RATINGS_FILE,x);res.json({ok:true,rating:q});});
app.get('/api/diagnostics',(req,res)=>res.json({ok:true,version:APP_VERSION,uptimeSeconds:Math.round(process.uptime()),rooms:rooms.size,questions:allQuestions().length,memoryMB:Math.round(process.memoryUsage().rss/1024/1024),dataDir:DATA_DIR,writable:(()=>{try{ensureDataDir();fs.accessSync(DATA_DIR,fs.constants.W_OK);return true}catch{return false}})(),storage:storage.status(),features:{globalNoRepeat:true,semanticNoRepeat:true,questionFamilies:true,questionHealth:true,adaptiveDifficulty:true,serverAuthoritativeScoring:true,idempotentAnswers:true,quizmaster3:true,finalExperience:true,yearInReview:true,studioQualityAssistant:true,transparentScoring:true,effortlessStart:true,adaptiveRounds:true,questionIntelligence2:true,gameShowAwards:true,backupRestore:true},socketClients:io.engine.clientsCount,connectedPlayers:[...rooms.values()].reduce((n,r)=>n+r.players.filter(p=>p.connected).length,0),activeRoomCodes:[...rooms.values()].filter(r=>r.phase!=='finished').map(r=>r.code),questionHealth:(()=>{const v=questionVerifications(),m=questionMetrics(),rt=readJson(QUESTION_RATINGS_FILE,{}),items=allQuestions().map(q=>questionHealthItem(q,m,rt,v));return {verified:items.filter(x=>x.status==='verified').length,needsReview:items.filter(x=>x.status==='needs-review').length,anomalies:items.filter(x=>x.flags.length).length}})()}));
app.get('/api/quiz-dna',(req,res)=>{const sid=cleanId(req.query.sessionId),name=clean(req.query.name,40),h=readHistory(),items=h.filter(x=>(sid&&x.sessionId===sid)||(!sid&&name&&x.name===name));if(!items.length)return res.status(404).json({ok:false,error:'Profilen saknar spelhistorik.'});const p={sessionId:sid||items[0].sessionId,name:items.at(-1).name,avatar:items.at(-1).avatar,games:items.length,wins:items.filter(x=>x.win).length,points:items.reduce((a,x)=>a+(x.score||0),0),correct:items.reduce((a,x)=>a+(x.correct||0),0),total:items.reduce((a,x)=>a+(x.total||0),0),bestStreak:Math.max(...items.map(x=>x.bestStreak||0)),categories:{}};for(const e of items)for(const [c,v] of Object.entries(e.categories||{})){const z=p.categories[c]||(p.categories[c]={correct:0,total:0});z.correct+=v.correct||0;z.total+=v.total||0}p.accuracy=p.total?Math.round(p.correct/p.total*100):0;res.json({ok:true,profile:p,dna:quizDNA(p)})});
app.get('/api/recovery',(req,res)=>res.json({ok:true,recoverable:[...rooms.values()].filter(r=>r.phase!=='finished').map(r=>({code:r.code,phase:r.phase,players:r.players.length,updatedAt:r.updatedAt||null}))}));
app.get('/api/storage/status',requireAdmin,(req,res)=>res.json({ok:true,...storage.status()}));


app.get('/api/game-plans',(req,res)=>res.json(allGamePlans()));
app.get('/api/leagues',(req,res)=>{const all=readJson(LEAGUES_FILE,[]).map(l=>({id:l.id,name:l.name,description:l.description||'',active:l.active!==false,createdAt:l.createdAt,updatedAt:l.updatedAt,games:l.games||0,players:Object.keys(l.standings||{}).length,points:l.points||[3,2,1]}));res.json(all.sort((a,b)=>(b.active-a.active)||String(b.createdAt).localeCompare(String(a.createdAt))))});
app.get('/api/leagues/:id',(req,res)=>{const l=readJson(LEAGUES_FILE,[]).find(x=>x.id===req.params.id);if(!l)return res.status(404).json({error:'Ligan hittades inte.'});const games=readJson(GAMES_FILE,[]).filter(g=>g.settings?.league===l.id).slice().reverse().slice(0,50);res.json({...l,standings:customLeagueStandings(l),recentGames:games.map(g=>({gameId:g.gameId,at:g.at,players:g.players?.length||0}))})});
app.post('/api/admin/leagues',requireAdmin,(req,res)=>{const all=readJson(LEAGUES_FILE,[]),name=clean(req.body?.name,80);if(!name)return res.status(400).json({ok:false,error:'Ligans namn saknas.'});let id=cleanId(req.body?.id)||('liga-'+Date.now());if(all.some(x=>x.id===id))return res.status(409).json({ok:false,error:'Liga-ID används redan.'});const pts=Array.isArray(req.body?.points)?req.body.points.slice(0,10).map(x=>Math.max(0,Math.min(100,Number(x)||0))):[3,2,1];const l={id,name,description:clean(req.body?.description,300),active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),points:pts.length?pts:[3,2,1],games:0,standings:{}};all.push(l);writeJson(LEAGUES_FILE,all);res.json({ok:true,league:l})});
app.post('/api/admin/leagues/:id/close',requireAdmin,(req,res)=>{const all=readJson(LEAGUES_FILE,[]),l=all.find(x=>x.id===req.params.id);if(!l)return res.status(404).json({ok:false,error:'Ligan hittades inte.'});l.active=false;l.updatedAt=new Date().toISOString();writeJson(LEAGUES_FILE,all);res.json({ok:true})});
app.post('/api/admin/leagues/:id/open',requireAdmin,(req,res)=>{const all=readJson(LEAGUES_FILE,[]),l=all.find(x=>x.id===req.params.id);if(!l)return res.status(404).json({ok:false,error:'Ligan hittades inte.'});l.active=true;l.updatedAt=new Date().toISOString();writeJson(LEAGUES_FILE,all);res.json({ok:true})});
app.post('/api/admin/leagues/:id/reset',requireAdmin,(req,res)=>{const all=readJson(LEAGUES_FILE,[]),l=all.find(x=>x.id===req.params.id);if(!l)return res.status(404).json({ok:false,error:'Ligan hittades inte.'});l.standings={};l.games=0;l.updatedAt=new Date().toISOString();writeJson(LEAGUES_FILE,all);res.json({ok:true})});
app.delete('/api/admin/leagues/:id',requireAdmin,(req,res)=>{const all=readJson(LEAGUES_FILE,[]),n=all.filter(x=>x.id!==req.params.id);if(n.length===all.length)return res.status(404).json({ok:false,error:'Ligan hittades inte.'});writeJson(LEAGUES_FILE,n);res.json({ok:true})});
app.get('/api/tournaments',(req,res)=>res.json(readJson(TOURNAMENT_FILE,[]).map(t=>({id:t.id,name:t.name,active:t.active!==false,createdAt:t.createdAt,updatedAt:t.updatedAt,players:Object.keys(t.standings||{}).length}))));
app.get('/api/tournaments/:id',(req,res)=>{const t=readJson(TOURNAMENT_FILE,[]).find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'Turneringen hittades inte.'});const standings=Object.values(t.standings||{}).sort((a,b)=>b.wins-a.wins||b.points-a.points);res.json({...t,standings})});
app.get('/api/qr',(req,res)=>{const text=String(req.query.text||'').slice(0,500);if(!text)return res.status(400).send('text required');res.type('png');const q=spawn('qrencode',['-t','PNG','-o','-','-s','7','-m','2',text]);q.stdout.pipe(res);q.on('error',()=>res.status(500).end())});

// Admin/editor
app.get('/api/year-review',(req,res)=>{const year=Math.max(2020,Math.min(2100,+req.query.year||new Date().getFullYear())),games=readJson(GAMES_FILE,[]).filter(g=>new Date(g.at).getFullYear()===year),players={};let questions=0;for(const g of games){questions+=(g.questionStats||[]).length;for(const p of g.players||[]){const k=p.sessionId||p.name,x=players[k]||(players[k]={name:p.name,avatar:p.avatar,games:0,wins:0,points:0,correct:0,total:0});x.games++;x.points+=p.score||0;x.correct+=p.stats?.correct||0;x.total+=p.stats?.total||0;const top=Math.max(...(g.players||[]).map(z=>z.score||0));if((p.score||0)===top)x.wins++}}const ranking=Object.values(players).sort((a,b)=>b.wins-a.wins||b.points-a.points);res.json({year,games:games.length,uniquePlayers:ranking.length,questionsPlayed:questions,champion:ranking[0]||null,ranking:ranking.slice(0,20)})});
app.get('/api/admin/question-research',rateLimit('question-research',30,10*60*1000),requireAdmin,async(req,res)=>{try{const data=await wikidataResearch(req.query.q,req.query.category,req.query.lang,req.query.limit);res.json({ok:true,...data})}catch(e){console.warn('[question-research]',e.message);res.status(502).json({ok:false,error:`Kunde inte söka verifierade källor: ${e.message}`})}});
app.get('/api/admin/question-discovery',rateLimit('question-discovery',12,10*60*1000),requireAdmin,async(req,res)=>{try{const data=await categoryQuestionDiscovery(req.query.category,req.query.lang,req.query.limit);res.json({ok:true,...data})}catch(e){console.warn('[question-discovery]',e.message);res.status(502).json({ok:false,error:`Automatisk kategorisökning misslyckades: ${e.message}`})}});
app.post('/api/admin/quality-assistant',requireAdmin,(req,res)=>{const raw=req.body||{},q=normalizeQuestion({...raw,id:'preview'}),issues=[],similar=allQuestions().map(x=>({id:x.id,q:x.q,c:x.c,score:(()=>{const a=new Set(normalizeText(q.q).split(' ')),b=new Set(normalizeText(x.q).split(' '));let n=0;for(const w of a)if(w.length>3&&b.has(w))n++;return n})()})).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score).slice(0,5);if(q.q.length<15)issues.push('Frågan är mycket kort.');if(q.a.length<3)issues.push('Använd helst minst tre svarsalternativ.');if(new Set(q.a.map(normalizeText)).size!==q.a.length)issues.push('Duplicerade svarsalternativ.');if(q.a.some(x=>x.length<2))issues.push('Ett svarsalternativ är för kort.');const lens=q.a.map(x=>x.length),correct=lens[q.r]||0,avg=lens.reduce((a,b)=>a+b,0)/Math.max(1,lens.length);if(correct>avg*1.8&&correct>18)issues.push('Rätt svar är mycket längre än distraktorerna och kan avslöja facit.');res.json({ok:true,score:Math.max(0,100-issues.length*18-Math.min(25,similar.length*4)),issues,similar,preview:q})});
app.get('/api/admin/diagnostics-download',requireAdmin,(req,res)=>{const payload={generatedAt:new Date().toISOString(),version:APP_VERSION,uptimeSeconds:Math.round(process.uptime()),memory:process.memoryUsage(),storage:storage.status(),rooms:[...rooms.values()].map(r=>({code:r.code,phase:r.phase,players:r.players.length,connected:r.players.filter(p=>p.connected).length,round:r.round,rounds:r.rounds})),questionCounts:categoryCounts(),features:{semanticNoRepeat:true,questionFamilies:true,teamNight:true,riskFinal:true,yearInReview:true,adaptiveDifficulty:true,questionHealth:true,autoPilot:true,teamCollaboration:true,playerFeedback:true}};res.setHeader('Content-Disposition',`attachment; filename=Resequiz-Diagnostics-${new Date().toISOString().slice(0,10)}.json`);res.json(payload)});
app.get('/api/admin/status',(req,res)=>{const auth=adminAuth();res.json({configured:!!auth,keyConfigured:!!ADMIN_KEY,authenticated:validAdminSession(req),username:validAdminSession(req)?adminSessions.get(cookieValue(req,'rq_admin_session'))?.username||'admin':null,version:APP_VERSION})});
app.post('/api/admin/setup',rateLimit('admin-setup',6,15*60*1000),async (req,res)=>{try{if(adminAuth())return res.status(409).json({ok:false,error:'Administratörskontot är redan skapat.'});if(!ADMIN_KEY)return res.status(503).json({ok:false,error:'Adminnyckel är inte konfigurerad. Kör rotate-admin-key.sh i containern först.'});const supplied=String(req.body?.key||'').trim();if(!safeEqualText(supplied,ADMIN_KEY))return res.status(403).json({ok:false,error:'Fel adminnyckel.'});const username=clean(req.body?.username||'',60);const password=String(req.body?.password||'');if(!/^[A-Za-z0-9._@-]{3,60}$/.test(username))return res.status(400).json({ok:false,error:'Användarnamnet måste vara 3–60 tecken och får innehålla bokstäver, siffror, punkt, _, @ eller -.'});if(password.length<10||password.length>200)return res.status(400).json({ok:false,error:'Lösenordet måste vara minst 10 tecken.'});const salt=crypto.randomBytes(16).toString('hex'),hash=await passwordHash(password,salt),auth={version:1,username,salt,hash,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};setAdminAuth(auth);const t=newAdminSession(username);setAdminCookie(req,res,t);res.json({ok:true,username,version:APP_VERSION})}catch(e){console.error('admin setup failed',e);res.status(500).json({ok:false,error:'Kunde inte skapa administratörskontot.'})}});
app.post('/api/admin/login',rateLimit('admin-login',8,10*60*1000),async (req,res)=>{try{const auth=adminAuth();if(!auth)return res.status(428).json({ok:false,error:'Administratörskontot är inte skapat ännu.',setupRequired:true});const username=String(req.body?.username||'').trim(),password=String(req.body?.password||'');if(!safeEqualText(username.toLowerCase(),String(auth.username).toLowerCase())||!await validPassword(password,auth))return res.status(403).json({ok:false,error:'Fel användarnamn eller lösenord.'});const t=newAdminSession(auth.username);setAdminCookie(req,res,t);res.json({ok:true,username:auth.username,version:APP_VERSION})}catch(e){console.error('admin login failed',e);res.status(500).json({ok:false,error:'Inloggningen kunde inte genomföras.'})}});
app.post('/api/admin/recover',rateLimit('admin-recover',4,30*60*1000),async (req,res)=>{try{if(!ADMIN_KEY)return res.status(503).json({ok:false,error:'Adminnyckel är inte konfigurerad.'});const supplied=String(req.body?.key||'').trim();if(!safeEqualText(supplied,ADMIN_KEY))return res.status(403).json({ok:false,error:'Fel adminnyckel.'});const username=clean(req.body?.username||'',60),password=String(req.body?.password||'');if(!/^[A-Za-z0-9._@-]{3,60}$/.test(username)||password.length<10)return res.status(400).json({ok:false,error:'Ange giltigt användarnamn och ett lösenord på minst 10 tecken.'});const old=adminAuth(),salt=crypto.randomBytes(16).toString('hex'),hash=await passwordHash(password,salt);setAdminAuth({version:1,username,salt,hash,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});adminSessions.clear();const t=newAdminSession(username);setAdminCookie(req,res,t);res.json({ok:true,username,version:APP_VERSION})}catch(e){console.error('admin recovery failed',e);res.status(500).json({ok:false,error:'Återställningen kunde inte genomföras.'})}});
app.post('/api/admin/change-password',requireAdmin,rateLimit('admin-password',5,15*60*1000),async (req,res)=>{try{const auth=adminAuth();if(!auth)return res.status(404).json({ok:false,error:'Administratörskonto saknas.'});const current=String(req.body?.currentPassword||''),password=String(req.body?.newPassword||'');if(!await validPassword(current,auth))return res.status(403).json({ok:false,error:'Nuvarande lösenord är fel.'});if(password.length<10||password.length>200)return res.status(400).json({ok:false,error:'Det nya lösenordet måste vara minst 10 tecken.'});const salt=crypto.randomBytes(16).toString('hex'),hash=await passwordHash(password,salt);setAdminAuth({...auth,salt,hash,updatedAt:new Date().toISOString()});adminSessions.clear();const t=newAdminSession(auth.username);setAdminCookie(req,res,t);res.json({ok:true})}catch(e){console.error('password change failed',e);res.status(500).json({ok:false,error:'Lösenordet kunde inte ändras.'})}});
app.post('/api/admin/logout',(req,res)=>{const t=cookieValue(req,'rq_admin_session');if(t)adminSessions.delete(t);res.setHeader('Set-Cookie','rq_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');res.json({ok:true})});
app.get('/api/admin/search',requireAdmin,(req,res)=>{const term=String(req.query.q||'').trim().toLocaleLowerCase('sv-SE'),cat=String(req.query.category||'').trim(),limit=Math.min(250,Math.max(1,+req.query.limit||100));const custom=readJson(CUSTOM_FILE,[]).map((q,i)=>({...normalizeQuestion(q,i),source:'custom'}));const base=baseWithOverrides(true).map(q=>({...q,source:'base'}));let all=[...base,...custom];if(term)all=all.filter(q=>q.id.toLocaleLowerCase('sv-SE').includes(term)||q.q.toLocaleLowerCase('sv-SE').includes(term)||q.a.some(a=>a.toLocaleLowerCase('sv-SE').includes(term)));if(cat)all=all.filter(q=>q.c===cat);res.json({total:all.length,items:all.slice(0,limit)})});
app.put('/api/admin/base/:id',requireAdmin,(req,res)=>{const id=cleanId(req.params.id);const raw=BASE_QUESTIONS.find(q=>q.id===id);if(!raw)return res.status(404).json({ok:false,error:'Basfrågan finns inte.'});const overrides=readJson(OVERRIDE_FILE,{}),merged=normalizeQuestion({...raw,...(overrides[id]||{}),...req.body,id},0);overrides[id]={c:merged.c,q:merged.q,a:merged.a,r:merged.r,f:merged.f,d:merged.d,visual:merged.visual,audio:merged.audio,enabled:merged.enabled};writeJson(OVERRIDE_FILE,overrides);res.json({ok:true,question:{...merged,source:'base'}})});
app.delete('/api/admin/base/:id',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),overrides=readJson(OVERRIDE_FILE,{});overrides[id]={...(overrides[id]||{}),enabled:false};writeJson(OVERRIDE_FILE,overrides);res.json({ok:true})});
app.post('/api/admin/base/:id/restore',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),overrides=readJson(OVERRIDE_FILE,{});delete overrides[id];writeJson(OVERRIDE_FILE,overrides);res.json({ok:true})});

app.get('/api/admin/fact-verification-report',requireAdmin,(req,res)=>res.json(readJson(FACT_VERIFICATION_REPORT_FILE,{ok:false,error:'Ingen faktaverifieringsrapport hittades.'})));
app.get('/api/admin/question-health',requireAdmin,(req,res)=>{const metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),vers=questionVerifications(),items=allQuestions().map(q=>questionHealthItem(q,metrics,ratings,vers));const summary={total:items.length,verified:items.filter(x=>x.status==='verified').length,unverified:items.filter(x=>x.status==='unverified').length,needsReview:items.filter(x=>x.status==='needs-review').length,quarantined:readJson(QUARANTINE_FILE,[]).length,proven:items.filter(x=>x.plays>=10&&!x.flags.length).length,anomalies:items.filter(x=>x.flags.length).length};res.json({ok:true,summary,items:items.filter(x=>x.flags.length||x.status!=='verified').sort((a,b)=>b.flags.length-a.flags.length||b.plays-a.plays).slice(0,Math.min(1000,Math.max(1,+req.query.limit||300)))})});
app.post('/api/admin/question-health/:id/status',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),q=[...baseWithOverrides(true),...readJson(CUSTOM_FILE,[]).map(normalizeQuestion)].find(x=>x.id===id);if(!q)return res.status(404).json({ok:false,error:'Frågan hittades inte.'});const status=['verified','needs-review','unverified'].includes(req.body?.status)?req.body.status:'unverified',all=questionVerifications();all[id]={status,source:clean(req.body?.source,300),notes:clean(req.body?.notes,500),verifiedAt:status==='verified'?new Date().toISOString():null,validUntil:req.body?.validUntil?clean(req.body.validUntil,40):null,verifiedBy:clean(req.body?.verifiedBy||'admin',80)};writeJson(QUESTION_VERIFICATION_FILE,all);res.json({ok:true,item:questionHealthItem(q,questionMetrics(),readJson(QUESTION_RATINGS_FILE,{}),all)})});
app.post('/api/admin/question-health/auto-quarantine',requireAdmin,(req,res)=>res.json({ok:true,added:autoQuarantineFromHealth()}));
app.get('/api/admin/dashboard',requireAdmin,(req,res)=>{const games=readJson(GAMES_FILE,[]),metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),qs=allQuestions();const items=qs.map(q=>({id:q.id,q:q.q,c:q.c,quality:questionQuality(q,metrics),plays:metrics[q.id]?.plays||0,accuracy:metrics[q.id]?.total?pct(metrics[q.id].correct,metrics[q.id].total):null}));const health=allQuestions().map(q=>questionHealthItem(q,metrics,ratings,questionVerifications()));res.json({version:APP_VERSION,questionHealth:{verified:health.filter(x=>x.status==='verified').length,needsReview:health.filter(x=>x.status==='needs-review').length,anomalies:health.filter(x=>x.flags.length).length},questions:qs.length,categories:Object.keys(categoryCounts()).length,games:games.length,profiles:hallOfFame().players,rooms:rooms.size,review:items.filter(x=>x.plays>=3&&x.quality<45).length,ratings:Object.values(ratings).reduce((a,x)=>a+(x.up||0)+(x.down||0),0),tooEasy:items.filter(x=>x.plays>=3&&x.accuracy>=90).length,tooHard:items.filter(x=>x.plays>=3&&x.accuracy<=20).length,topReview:items.filter(x=>x.plays>=3).sort((a,b)=>a.quality-b.quality).slice(0,12)});});
app.get('/api/admin/backup',requireAdmin,(req,res)=>{ensureDataDir();const files=[HIGHSCORE_FILE,CUSTOM_FILE,PACK_FILE,OVERRIDE_FILE,GAMES_FILE,LEAGUE_FILE,LEAGUES_FILE,PLAN_FILE,TOURNAMENT_FILE,TITLES_FILE,QUESTION_METRICS_FILE,QUESTION_RATINGS_FILE,SEASONS_FILE,ACTIVE_ROOMS_FILE,QUARANTINE_FILE,GROUPS_FILE,QUESTION_VERIFICATION_FILE];const data={format:'resequiz-backup',version:1,appVersion:APP_VERSION,createdAt:new Date().toISOString(),files:{}};for(const f of files)if(fs.existsSync(f))data.files[path.basename(f)]=readJson(f,null);res.setHeader('Content-Disposition',`attachment; filename=Resequiz-Backup-${new Date().toISOString().slice(0,10)}.rqbackup`);res.json(data)});
app.post('/api/admin/restore',rateLimit('restore',5,10*60*1000),requireAdmin,(req,res)=>{const b=req.body;if(!b||b.format!=='resequiz-backup'||!b.files||typeof b.files!=='object')return res.status(400).json({ok:false,error:'Ogiltig Resequiz-backup.'});const allowed=new Set(['highscores.json','custom-questions.json','custom-packs.json','question-overrides.json','games.json','league.json','leagues.json','game-plans.json','tournaments.json','player-titles.json','question-metrics.json','question-ratings.json','seasons.json','active-rooms.json','question-quarantine.json','groups.json','question-verification.json']);let restored=0;for(const [name,data] of Object.entries(b.files)){if(!allowed.has(name)||data===null)continue;writeJson(path.join(DATA_DIR,name),data);restored++}res.json({ok:true,restored})});

app.get('/api/admin/question-doctor',rateLimit('doctor',12,60*1000),requireAdmin,(req,res)=>{const d=questionDoctor(),limit=Math.min(500,Math.max(1,+req.query.limit||150));res.json({...d,issues:d.issues.slice(0,limit)})});
app.post('/api/admin/question-doctor/:id/disable',requireAdmin,(req,res)=>{const id=cleanId(req.params.id);const raw=BASE_QUESTIONS.find(q=>q.id===id);if(raw){const overrides=readJson(OVERRIDE_FILE,{});overrides[id]={...(overrides[id]||{}),enabled:false};writeJson(OVERRIDE_FILE,overrides);return res.json({ok:true,source:'base'})}const arr=readJson(CUSTOM_FILE,[]),q=arr.find(x=>x.id===id);if(!q)return res.status(404).json({ok:false,error:'Frågan hittades inte.'});q.enabled=false;writeJson(CUSTOM_FILE,arr);res.json({ok:true,source:'custom'})});
app.get('/api/quiz/compose',(req,res)=>res.json({ok:true,plan:composeQuiz(req.query)}));
app.post('/api/groups/recognize',(req,res)=>{const ids=Array.isArray(req.body?.sessionIds)?req.body.sessionIds.map(cleanId):[],fp=groupFingerprint(ids),g=readJson(GROUPS_FILE,{})[fp];res.json({ok:true,recognized:!!g,group:g||null})});
app.get('/api/ratings',(req,res)=>{const profiles=hallOfFame().mostWins.concat(hallOfFame().bestAccuracy);const seen=new Set();res.json(profiles.filter(x=>!seen.has(x.sessionId||x.name)&&seen.add(x.sessionId||x.name)).map(x=>({...x,rating:quizRatingFor(x.sessionId,x.name)})).sort((a,b)=>b.rating-a.rating))});
app.get('/api/admin/question-audit',requireAdmin,(req,res)=>{const a=questionAudit(),limit=Math.min(1000,Math.max(1,+req.query.limit||200));res.json({...a,items:a.items.filter(x=>x.status!=='green').slice(0,limit)})});
app.post('/api/admin/question-audit/:id/quarantine',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),q=new Set(readJson(QUARANTINE_FILE,[]));q.add(id);writeJson(QUARANTINE_FILE,[...q]);res.json({ok:true,id})});
app.post('/api/admin/question-audit/:id/approve',requireAdmin,(req,res)=>{const id=cleanId(req.params.id),q=readJson(QUARANTINE_FILE,[]).filter(x=>x!==id);writeJson(QUARANTINE_FILE,q);res.json({ok:true,id})});
app.get('/api/admin/update-status',requireAdmin,(req,res)=>res.json({ok:true,enabled:process.env.RESEQUIZ_ALLOW_WEB_UPDATE==='1',version:APP_VERSION,command:'/usr/local/sbin/update-resequiz.sh'}));
app.post('/api/admin/update',rateLimit('webupdate',2,10*60*1000),requireAdmin,(req,res)=>{if(process.env.RESEQUIZ_ALLOW_WEB_UPDATE!=='1')return res.status(403).json({ok:false,error:'Webbuppdatering är avstängd. Sätt RESEQUIZ_ALLOW_WEB_UPDATE=1 för att aktivera den.'});const cmd='/usr/local/sbin/update-resequiz.sh';if(!fs.existsSync(cmd))return res.status(404).json({ok:false,error:'Updateringsskriptet finns inte på '+cmd});const child=spawn(cmd,[],{detached:true,stdio:'ignore'});child.unref();res.json({ok:true,started:true,message:'Backup, uppdatering och health check startades.'})});
app.get('/api/admin/questions',rateLimit('admin',120,60*1000),requireAdmin,(req,res)=>res.json(readJson(CUSTOM_FILE,[])));
app.post('/api/admin/questions',requireAdmin,(req,res)=>{const arr=readJson(CUSTOM_FILE,[]),q=normalizeQuestion({...req.body,id:`custom-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`});if(!q.q||q.a.length<2)return res.status(400).json({ok:false,error:'Fråga och minst två svar krävs.'});arr.push(q);writeJson(CUSTOM_FILE,arr);invalidateCatalogueCache();const source=clean(req.body?._verificationSource,300);if(source){const all=readJson(QUESTION_VERIFICATION_FILE,{});all[q.id]={status:'verified',source,sourceType:clean(req.body?._verificationSourceType||'structured-web-source',80),notes:clean(req.body?._verificationNotes||'Källstödd kandidat granskad och sparad av administratör.',500),verifiedAt:new Date().toISOString(),validUntil:null,verifiedBy:clean(req.body?._verifiedBy||'admin-research',80)};writeJson(QUESTION_VERIFICATION_FILE,all)}res.json({ok:true,question:q,verified:!!source})});
app.put('/api/admin/questions/:id',requireAdmin,(req,res)=>{const arr=readJson(CUSTOM_FILE,[]),i=arr.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({ok:false});arr[i]=normalizeQuestion({...arr[i],...req.body,id:arr[i].id});writeJson(CUSTOM_FILE,arr);invalidateCatalogueCache();const source=clean(req.body?._verificationSource,300);if(source){const all=readJson(QUESTION_VERIFICATION_FILE,{});all[arr[i].id]={status:'verified',source,sourceType:clean(req.body?._verificationSourceType||'structured-web-source',80),notes:clean(req.body?._verificationNotes||'Källstödd kandidat granskad och sparad av administratör.',500),verifiedAt:new Date().toISOString(),validUntil:null,verifiedBy:clean(req.body?._verifiedBy||'admin-research',80)};writeJson(QUESTION_VERIFICATION_FILE,all)}res.json({ok:true,question:arr[i],verified:!!source})});
app.delete('/api/admin/questions/:id',requireAdmin,(req,res)=>{let arr=readJson(CUSTOM_FILE,[]);const n=arr.length;arr=arr.filter(x=>x.id!==req.params.id);writeJson(CUSTOM_FILE,arr);res.json({ok:arr.length<n})});
app.post('/api/admin/import',requireAdmin,(req,res)=>{if(!Array.isArray(req.body))return res.status(400).json({ok:false,error:'Skicka en JSON-array.'});const arr=readJson(CUSTOM_FILE,[]);let n=0;for(const raw of req.body.slice(0,5000)){const q=normalizeQuestion({...raw,id:`custom-${Date.now()}-${n}-${crypto.randomBytes(3).toString('hex')}`},n);if(q.q&&q.a.length>=2){arr.push(q);n++}}writeJson(CUSTOM_FILE,arr);res.json({ok:true,imported:n})});
app.post('/api/admin/media',requireAdmin,(req,res)=>{try{const raw=String(req.body?.data||''),m=raw.match(/^data:([^;]+);base64,(.+)$/);if(!m)return res.status(400).json({ok:false,error:'Ogiltig fil.'});const mime=m[1],buf=Buffer.from(m[2],'base64');if(buf.length>6*1024*1024)return res.status(400).json({ok:false,error:'Max 6 MB.'});const ext=mime.includes('png')?'png':mime.includes('jpeg')?'jpg':mime.includes('webp')?'webp':mime.includes('mpeg')?'mp3':mime.includes('ogg')?'ogg':mime.includes('wav')?'wav':'bin';const name=`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;fs.writeFileSync(path.join(MEDIA_DIR,name),buf);res.json({ok:true,url:'/media/'+name,mime,size:buf.length})}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post('/api/admin/import-excel',requireAdmin,async(req,res)=>{try{const raw=String(req.body?.data||''),m=raw.match(/^data:.*?;base64,(.+)$/);if(!m)return res.status(400).json({ok:false,error:'Ogiltig Excel-fil.'});const buf=Buffer.from(m[1],'base64');if(buf.length>8*1024*1024)return res.status(400).json({ok:false,error:'Max 8 MB.'});const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);const ws=wb.worksheets[0];if(!ws)return res.status(400).json({ok:false,error:'Arbetsblad saknas.'});const headers={};ws.getRow(1).eachCell((cell,col)=>headers[String(cell.value||'').trim().toLowerCase()]=col);const get=(row,names)=>{for(const n of names){const col=headers[n];if(col)return String(row.getCell(col).text||'').trim()}return ''};const arr=readJson(CUSTOM_FILE,[]);let n=0;for(let ri=2;ri<=ws.rowCount;ri++){const row=ws.getRow(ri),question=get(row,['fråga','question','q']);if(!question)continue;const correct=get(row,['rätt svar','correct','answer','a0']);const wrong=[get(row,['fel svar 1','wrong1','a1']),get(row,['fel svar 2','wrong2','a2']),get(row,['fel svar 3','wrong3','a3'])].filter(Boolean);if(!correct||!wrong.length)continue;const q=normalizeQuestion({id:`custom-${Date.now()}-${n}-${crypto.randomBytes(3).toString('hex')}`,c:get(row,['kategori','category','c'])||'Allmänbildning',q:question,a:[correct,...wrong],r:0,f:get(row,['förklaring','explanation','f']),d:get(row,['svårighet','difficulty','d'])||'medium',visual:get(row,['bild','visual','image']),audio:get(row,['ljud','audio'])},n);arr.push(q);n++}writeJson(CUSTOM_FILE,arr);res.json({ok:true,imported:n})}catch(e){res.status(400).json({ok:false,error:'Kunde inte läsa Excel-filen: '+e.message})}});
app.post('/api/admin/tournaments',requireAdmin,(req,res)=>{const all=readJson(TOURNAMENT_FILE,[]),t={id:cleanId(req.body.id)||`tournament-${Date.now()}`,name:clean(req.body.name||'Turnering',80),active:true,createdAt:new Date().toISOString(),standings:{}};all.push(t);writeJson(TOURNAMENT_FILE,all);res.json({ok:true,tournament:t})});
app.post('/api/admin/tournaments/:id/close',requireAdmin,(req,res)=>{const all=readJson(TOURNAMENT_FILE,[]),t=all.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({ok:false});t.active=false;t.updatedAt=new Date().toISOString();writeJson(TOURNAMENT_FILE,all);res.json({ok:true})});
app.get('/api/admin/suggest-distractors',requireAdmin,(req,res)=>{const category=String(req.query.category||''),correct=String(req.query.correct||'').trim().toLocaleLowerCase('sv-SE');let pool=allQuestions().filter(q=>!category||q.c===category).flatMap(q=>q.a).map(String).filter(x=>x.trim()&&x.trim().toLocaleLowerCase('sv-SE')!==correct);pool=[...new Set(pool)];res.json(shuffle(pool).slice(0,12))});
app.post('/api/admin/rebalance-difficulty',requireAdmin,(req,res)=>{const games=readJson(GAMES_FILE,[]),agg={};for(const g of games)for(const q of g.questionStats||[]){const x=agg[q.id]||(agg[q.id]={correct:0,total:0,plays:0});x.correct+=q.correct||0;x.total+=q.total||0;x.plays++}const overrides=readJson(OVERRIDE_FILE,{});let changed=0;for(const [id,x] of Object.entries(agg)){if(x.total<30||!BASE_QUESTIONS.some(q=>q.id===id))continue;const a=pct(x.correct,x.total),d=a<35?'hard':a>75?'easy':'medium';overrides[id]={...(overrides[id]||{}),d};changed++}writeJson(OVERRIDE_FILE,overrides);res.json({ok:true,changed})});
app.post('/api/admin/league/reset',requireAdmin,(req,res)=>{writeJson(LEAGUE_FILE,{});res.json({ok:true})});
app.get('/api/admin/statistics',requireAdmin,(req,res)=>{
 const games=readJson(GAMES_FILE,[]),history=readHistory(),metrics=questionMetrics(),ratings=readJson(QUESTION_RATINGS_FILE,{}),vers=questionVerifications(),qs=allQuestions(),cats=categoryCounts(),quarantine=readJson(QUARANTINE_FILE,[]);
 const profiles={};for(const e of history){const k=e.sessionId||String(e.name||'').toLowerCase(),x=profiles[k]||(profiles[k]={name:e.name||'Okänd',avatar:e.avatar||'😀',games:0,wins:0,points:0,correct:0,total:0,bestStreak:0,responseMs:0,responseCount:0});x.games++;x.wins+=e.win?1:0;x.points+=e.score||0;x.correct+=e.correct||0;x.total+=e.total||0;x.bestStreak=Math.max(x.bestStreak,e.bestStreak||0);x.responseMs+=e.responseTotalMs||0;x.responseCount+=e.responseCount||0}
 const players=Object.values(profiles).map(x=>({...x,accuracy:pct(x.correct,x.total),winRate:pct(x.wins,x.games),avgResponseMs:x.responseCount?Math.round(x.responseMs/x.responseCount):null})).sort((a,b)=>b.wins-a.wins||b.points-a.points);
 const totalAnswers=Object.values(metrics).reduce((n,m)=>n+(+m.total||0),0),correctAnswers=Object.values(metrics).reduce((n,m)=>n+(+m.correct||0),0),responseTotal=Object.values(metrics).reduce((n,m)=>n+(+m.responseTotalMs||0),0),responseCount=Object.values(metrics).reduce((n,m)=>n+(+m.responseCount||0),0);
 const health=qs.map(q=>questionHealthItem(q,metrics,ratings,vers));
 const questionRows=qs.map(q=>{const m=metrics[q.id]||{},r=ratings[q.id]||{},h=questionHealthItem(q,metrics,ratings,vers);return {id:q.id,q:q.q,c:q.c,d:q.d,type:q.type||'classic',plays:+m.plays||0,total:+m.total||0,correct:+m.correct||0,accuracy:m.total?pct(m.correct,m.total):null,avgResponseMs:m.responseCount?Math.round((+m.responseTotalMs||0)/m.responseCount):null,up:+r.up||0,down:+r.down||0,flag:+r.flag||0,status:h.status,actualDifficulty:h.actualDifficulty,healthFlags:h.flags||[]}});
 const catStats={};for(const q of qs){const x=catStats[q.c]||(catStats[q.c]={category:q.c,questions:0,played:0,answers:0,correct:0,factKeys:new Set()});x.questions++;x.factKeys.add(q.factKey||q.id);const m=metrics[q.id]||{};x.played+=+m.plays||0;x.answers+=+m.total||0;x.correct+=+m.correct||0}const categories=Object.values(catStats).map(x=>({category:x.category,questions:x.questions,uniqueFacts:x.factKeys.size,uniqueFactTarget:['Världen','Hjärngympa'].includes(x.category)?null:1000,uniqueFactGap:['Världen','Hjärngympa'].includes(x.category)?null:Math.max(0,1000-x.factKeys.size),played:x.played,answers:x.answers,correct:x.correct,accuracy:x.answers?pct(x.correct,x.answers):null})).sort((a,b)=>b.questions-a.questions);
 const modes={};for(const g of games){const k=g.mode||'individual',x=modes[k]||(modes[k]={mode:k,games:0,players:0});x.games++;x.players+=(g.players||[]).length}
 const byDay={};for(const g of games){const d=String(g.at||'').slice(0,10);if(!d)continue;const x=byDay[d]||(byDay[d]={date:d,games:0,players:0,questions:0});x.games++;x.players+=(g.players||[]).length;x.questions+=(g.questionStats||[]).length}
 const recent=Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
 const totalParticipants=games.reduce((n,g)=>n+(g.players?.length||0),0),totalQuestionsPlayed=games.reduce((n,g)=>n+(g.questionStats?.length||0),0);
 res.json({ok:true,generatedAt:new Date().toISOString(),version:APP_VERSION,overview:{games:games.length,uniquePlayers:players.length,playerSessions:totalParticipants,questions:qs.length,categories:Object.keys(cats).length,totalAnswers,correctAnswers,accuracy:totalAnswers?pct(correctAnswers,totalAnswers):0,avgResponseMs:responseCount?Math.round(responseTotal/responseCount):null,questionsPlayed:totalQuestionsPlayed,activeRooms:rooms.size,connectedPlayers:[...rooms.values()].reduce((n,r)=>n+r.players.filter(p=>p.connected).length,0),ratings:Object.values(ratings).reduce((n,r)=>n+(+r.up||0)+(+r.down||0)+(+r.flag||0),0),quarantine:quarantine.length},questionHealth:{verified:health.filter(x=>x.status==='verified').length,needsReview:health.filter(x=>x.status==='needs-review').length,anomalies:health.filter(x=>x.flags.length).length,proven:health.filter(x=>x.total>=30).length},categories,modes:Object.values(modes),recent,players:players.slice(0,100),questions:{mostPlayed:questionRows.filter(x=>x.plays).sort((a,b)=>b.plays-a.plays).slice(0,20),hardest:questionRows.filter(x=>x.total>=5&&x.accuracy!=null).sort((a,b)=>a.accuracy-b.accuracy).slice(0,20),easiest:questionRows.filter(x=>x.total>=5&&x.accuracy!=null).sort((a,b)=>b.accuracy-a.accuracy).slice(0,20),bestRated:questionRows.filter(x=>x.up+x.down+x.flag).sort((a,b)=>(b.up-b.down-b.flag)-(a.up-a.down-a.flag)).slice(0,20),flagged:questionRows.filter(x=>x.flag||x.healthFlags.length).sort((a,b)=>(b.flag+b.healthFlags.length)-(a.flag+a.healthFlags.length)).slice(0,20)},system:{uptimeSeconds:Math.round(process.uptime()),memoryMB:Math.round(process.memoryUsage().rss/1024/1024),storage:storage.status()}});
});
app.get('/api/admin/analytics',requireAdmin,(req,res)=>{const games=readJson(GAMES_FILE,[]),m={};for(const g of games)for(const q of g.questionStats||[]){const x=m[q.id]||(m[q.id]={id:q.id,text:q.text,plays:0,correct:0,total:0,responseMs:0,responseCount:0,type:q.type||'classic'});x.plays++;x.correct+=q.correct||0;x.total+=q.total||0;if(q.avgResponseMs){x.responseMs+=q.avgResponseMs;x.responseCount++}}const items=Object.values(m).map(x=>{const accuracy=pct(x.correct,x.total),avgResponseMs=x.responseCount?Math.round(x.responseMs/x.responseCount):null,balance=100-Math.min(100,Math.abs(55-accuracy)*1.8),confidence=Math.min(100,x.plays*12),qualityScore=Math.round(balance*.7+confidence*.3);return {...x,accuracy,avgResponseMs,qualityScore,review:x.plays>=3&&(accuracy<15||accuracy>95||qualityScore<45)}}).sort((a,b)=>b.plays-a.plays);res.json({games:games.length,items})});
app.get('/api/admin/game-plans',requireAdmin,(req,res)=>res.json(readJson(PLAN_FILE,[])));
app.post('/api/admin/game-plans',requireAdmin,(req,res)=>{const arr=readJson(PLAN_FILE,[]),rounds=Array.isArray(req.body.rounds)?req.body.rounds.slice(0,20).map((r,i)=>({name:clean(r.name||`Runda ${i+1}`,60),type:['classic','risk','buzzer','speed','truefalse','text','estimate','clue','zoom','mystery','connections','sort','map','pin','duel','jackpot'].includes(r.type)?r.type:'classic',count:Math.min(30,Math.max(1,+r.count||5)),categories:Array.isArray(r.categories)?r.categories.map(x=>clean(x,50)):[],difficulty:['easy','medium','hard','mixed'].includes(r.difficulty)?r.difficulty:'mixed'})):[];const plan={id:cleanId(req.body.id)||`plan-${Date.now()}`,name:clean(req.body.name||'Eget upplägg',80),description:clean(req.body.description,240),family:!!req.body.family,rounds};const i=arr.findIndex(x=>x.id===plan.id);if(i>=0)arr[i]=plan;else arr.push(plan);writeJson(PLAN_FILE,arr);res.json({ok:true,plan})});
app.delete('/api/admin/game-plans/:id',requireAdmin,(req,res)=>{const arr=readJson(PLAN_FILE,[]).filter(x=>x.id!==req.params.id);writeJson(PLAN_FILE,arr);res.json({ok:true})});
app.get('/api/admin/packs',requireAdmin,(req,res)=>res.json(readJson(PACK_FILE,[])));
app.post('/api/admin/packs',requireAdmin,(req,res)=>{const arr=readJson(PACK_FILE,[]),p={id:cleanId(req.body.id)||`pack-${Date.now()}`,name:clean(req.body.name,60),description:clean(req.body.description,200),categories:Array.isArray(req.body.categories)?req.body.categories.map(x=>clean(x,50)):[],difficulty:['easy','medium','hard','mixed'].includes(req.body.difficulty)?req.body.difficulty:'mixed'};arr.push(p);writeJson(PACK_FILE,arr);res.json({ok:true,pack:p})});
app.get('/api/admin/rqpack/export',requireAdmin,(req,res)=>{const id=cleanId(req.query.id),packs=readJson(PACK_FILE,[]),pack=id?packs.find(x=>x.id===id):null;if(id&&!pack)return res.status(404).json({ok:false,error:'Paketet hittades inte.'});const data={format:'resequiz-rqpack',version:1,appVersion:APP_VERSION,createdAt:new Date().toISOString(),pack:pack||{id:'all-custom',name:'Alla egna frågor',description:'Export från Resequiz'},questions:readJson(CUSTOM_FILE,[]),plans:readJson(PLAN_FILE,[])};res.setHeader('Content-Disposition',`attachment; filename=${cleanId(pack?.id||'resequiz-custom')}.rqpack`);res.type('application/json').send(JSON.stringify(data,null,2))});
app.post('/api/admin/rqpack/import',rateLimit('rqpack',20,10*60*1000),requireAdmin,(req,res)=>{const x=req.body;if(!x||x.format!=='resequiz-rqpack'||x.version!==1)return res.status(400).json({ok:false,error:'Ogiltigt .rqpack-format.'});const incoming=Array.isArray(x.questions)?x.questions.slice(0,5000).map(normalizeQuestion):[],cur=readJson(CUSTOM_FILE,[]),ids=new Set(cur.map(q=>q.id));let added=0;for(const q of incoming)if(q.q&&q.a.length>=2&&!ids.has(q.id)){cur.push(q);ids.add(q.id);added++}writeJson(CUSTOM_FILE,cur);if(x.pack&&x.pack.name){const ps=readJson(PACK_FILE,[]);const p={id:cleanId(x.pack.id)||`pack-${Date.now()}`,name:clean(x.pack.name,60),description:clean(x.pack.description,200),categories:Array.isArray(x.pack.categories)?x.pack.categories.map(c=>clean(c,50)):[],difficulty:['easy','medium','hard','mixed'].includes(x.pack.difficulty)?x.pack.difficulty:'mixed'};if(!ps.some(y=>y.id===p.id))ps.push(p);writeJson(PACK_FILE,ps)}res.json({ok:true,added,total:cur.length})});


// API routes must always return JSON. This also makes mixed-version deployments
// obvious instead of leaking Express' default HTML 404 page to the browser.
app.use('/api',(req,res)=>res.status(404).json({
  ok:false,
  error:`API-endpoint saknas: ${req.method} ${req.originalUrl}. Kontrollera att webb- och serverversionen är samma och kör uppdateringen igen.`,
  code:'API_ROUTE_NOT_FOUND',
  version:APP_VERSION,
  method:req.method,
  path:req.originalUrl
}));

io.on('connection',socket=>{
 socket.on('createRoom',(d,cb=()=>{})=>{const name=clean(d?.name,20),sid=cleanId(d?.sessionId),avatar=cleanAvatar(d?.avatar);if(!name||!sid)return cb({ok:false,error:'Namn saknas.'});const r=makeRoom(name,sid);r.players[0].name=uniqueNickname(r,name,sid);r.players[0].avatar=avatar;r.players[0].socketId=socket.id;socket.join(r.code);cb({ok:true,code:r.code,hostToken:r.hostToken,room:roomPublic(r)});emitRoom(r)});
 socket.on('joinRoom',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||'')),name=clean(d?.name,20),sid=cleanId(d?.sessionId),avatar=cleanAvatar(d?.avatar);if(!r)return cb({ok:false,error:'Rummet finns inte.'});if(r.phase!=='lobby')return cb({ok:false,error:'Spelet har redan startat.'});if(r.players.length>=100)return cb({ok:false,error:'Rummet är fullt (max 100).'});const safeName=uniqueNickname(r,name,sid);let p=findPlayer(r,sid);if(!p){p={sessionId:sid,name:safeName,avatar,team:clean(d?.team,20),score:0,connected:true,socketId:socket.id,stats:freshStats(),roundScores:[],powerups:{fifty:1,double:1,shield:1}};r.players.push(p)}else{p.name=safeName;p.avatar=avatar;p.connected=true;p.socketId=socket.id}socket.join(r.code);cb({ok:true,room:roomPublic(r)});emitRoom(r)});
 socket.on('joinDisplay',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r)return cb({ok:false,error:'Rummet finns inte.'});socket.join(r.code);cb({ok:true,room:roomPublic(r)});if(['question','paused'].includes(r.phase)&&r.currentPublic)socket.emit('question',r.currentPublic);else if(r.phase==='result'&&r.lastResult)socket.emit('roundResult',r.lastResult);else if(r.phase==='roundBreak')socket.emit('roundBreak',{room:roomPublic(r),round:r.round,rounds:r.rounds});else if(r.phase==='finished'&&r.lastGameOver)socket.emit('gameOver',r.lastGameOver)});
 socket.on('rejoin',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r)return cb({ok:false});const p=findPlayer(r,cleanId(d?.sessionId));if(!p)return cb({ok:false});p.connected=true;p.socketId=socket.id;socket.join(r.code);cb({ok:true,room:roomPublic(r)});if(r.currentPublic&&['question','paused'].includes(r.phase))socket.emit('question',r.currentPublic);else if(r.phase==='result'&&r.lastResult)socket.emit('roundResult',r.lastResult);else if(r.phase==='roundBreak')socket.emit('roundBreak',{room:roomPublic(r),round:r.round,rounds:r.rounds});else if(r.phase==='finished'&&r.lastGameOver)socket.emit('gameOver',r.lastGameOver);emitRoom(r)});
 socket.on('setLobbyConfig',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d?.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden kan ändra.'});r.mode=d?.mode==='teams'?'teams':'individual';const names=Array.isArray(d.teamNames)?d.teamNames.map(x=>clean(x,20)).filter(Boolean).slice(0,4):[];r.teamNames=names.length>=2?names:['Lag 1','Lag 2'];if(r.mode==='teams')r.players.forEach((p,i)=>{if(!r.teamNames.includes(p.team))p.team=r.teamNames[i%r.teamNames.length]});else r.players.forEach(p=>p.team='');emitRoom(r);cb({ok:true,room:roomPublic(r)})});
 socket.on('setTeam',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||r.phase!=='lobby')return cb({ok:false});const sid=cleanId(d.sessionId);if(sid!==cleanId(d.requesterSessionId)&&d.hostToken!==r.hostToken)return cb({ok:false,error:'Inte tillåtet.'});const p=findPlayer(r,sid);if(!p)return cb({ok:false});p.team=clean(d.team,20);emitRoom(r);cb({ok:true})});
 socket.on('startGame',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Endast värden kan starta.'});if(r.players.length<1)return cb({ok:false,error:'Ingen spelare finns i rummet.'});const s=d.settings||{};r.mode=s.mode==='teams'?'teams':'individual';if(r.players.length===1&&r.mode==='teams')r.mode='individual';r.teamNames=Array.isArray(s.teamNames)?s.teamNames.map(x=>clean(x,20)).filter(Boolean).slice(0,4):r.teamNames;if(r.mode==='teams'&&s.autoTeams===false&&new Set(r.players.map(p=>p.team).filter(Boolean)).size<2)return cb({ok:false,error:'Minst två lag med deltagare krävs.'});const selectedPlan=allGamePlans().find(x=>x.id===cleanId(s.gamePlan));const family=selectedPlan?.family||s.profile==='family',journey=!!selectedPlan?.journey,teamNight=!!selectedPlan?.teamNight;if(teamNight)r.mode='teams';r.settings={count:Math.min(200,Math.max(5,+s.count||20)),timer:journey?45:(family?Math.max(30,+s.timer||30):([0,10,15,20,30,45,60].includes(+s.timer)?+s.timer:15)),difficulty:family?'easy':(['easy','medium','hard','mixed'].includes(s.difficulty)?s.difficulty:'mixed'),categories:Array.isArray(s.categories)?s.categories:[],roundSize:Math.min(20,Math.max(1,+s.roundSize||5)),finalBonusCount:(family||journey)?0:Math.min(10,Math.max(0,+s.finalBonusCount||5)),pack:cleanId(s.pack),screenMode:journey?'all':(s.screenMode==='display'?'display':'all'),gamePlan:cleanId(s.gamePlan),profile:family?'family':(journey?'classic':(s.profile==='classic'?'classic':'ultimate')),powerups:journey?false:s.powerups!==false,teamScoring:s.teamScoring==='sum'?'sum':'average',tournament:cleanId(s.tournament),league:cleanId(s.league),smartDifficulty:s.smartDifficulty!==false,director:journey?true:s.director!==false,drama:s.drama!==false,audioQuestions:s.audioQuestions===true,autoTeams:s.autoTeams!==false,teamPowerups:journey?false:s.teamPowerups!==false,journeyMode:journey,soloMode:r.players.length===1,noRepeatDays:Math.max(1,Math.min(3650,+s.noRepeatDays||180)),finalHiddenStandings:s.finalHiddenStandings!==false,familyMode:family,teamNight,teamCollaborative:teamNight,adaptiveProfiles:true,autoPilot:cleanId(s.gamePlan)==='autopilot-night'};r.deck=selectDeck(r,r.settings);if(r.deck.length<2)return cb({ok:false,error:'För få nya frågor i urvalet.'});r.deck.forEach(q=>r.seen.add(q.id));r.index=0;r.round=1;r.rounds=(selectedPlan?.rounds?.length)||Math.ceil(r.deck.length/r.settings.roundSize);r.questionStats=[];r.tiebreak=false;r.secretBonusIndex=family?-1:Math.floor(Math.random()*r.deck.length);if(r.mode==='teams'&&r.settings.autoTeams)balanceTeams(r);r.teamPowerups={};if(r.mode==='teams')for(const n of r.teamNames)r.teamPowerups[n]={double:1,shield:1};r.players.forEach(p=>{p.score=0;p.stats=freshStats();p.roundScores=[];p.powerups={fifty:1,double:1,shield:1};p.powerState={};p.captain=false});if(r.mode==='teams')for(const n of r.teamNames){const m=r.players.filter(p=>p.team===n);if(m[0])m[0].captain=true}r.persisted=false;storage.event(r.code,'game-start',{players:r.players.length,settings:r.settings});cb({ok:true});startRoundQuestion(r)});
 socket.on('submitAnswer',(d,cb=()=>{})=>{
   const r=rooms.get(String(d?.code||''));if(!r||r.phase!=='question'||r.currentPublic?.id!==d.questionId)return cb({ok:false,error:'Frågan är inte aktiv.'});
   const p=findPlayer(r,cleanId(d.sessionId));if(!p)return cb({ok:false,error:'Spelaren hittades inte.'});
   if(r.settings?.teamCollaborative&&r.mode==='teams'&&!p.captain)return cb({ok:false,error:'Diskutera i laget – lagkaptenen låser svaret.'});
   const submissionId=cleanId(d?.submissionId)||`${r.code}-${r.current.id}-${p.sessionId}`;const receipt=storage.recordReceipt(r.code,r.current.id,p.sessionId,submissionId);
   if(receipt.duplicate||r.answers.has(p.sessionId))return cb({ok:true,duplicate:true,error:'Redan besvarad.'});
   if(r.currentType==='duel'&&!r.duelists.includes(p.sessionId))return cb({ok:false,error:'Den här frågan är en duell mellan två andra spelare.'});
   if(r.currentType==='buzzer'&&r.buzzerWinner!==p.sessionId)return cb({ok:false,error:'Du måste vinna buzzern för att svara.'});
   const responseMs=Math.max(0,Date.now()-r.questionStartedAt),stake=r.currentType==='risk'?Math.max(0,Math.min(r.round===r.rounds?1000:500,+d.stake||100)):0;
   if(r.currentType==='buzzer'){
     const correctIndex=r.current.opts.findIndex(o=>o.correct);
     if(+d.answerIndex!==correctIndex){
       r.buzzerTried=r.buzzerTried||new Set();r.buzzerTried.add(p.sessionId);p.score-=100;const st=p.stats||(p.stats=freshStats());st.total++;st.streak=0;
       r.events=r.events||[];r.events.push({at:Date.now(),questionId:r.current.id,type:'buzzer',sessionId:p.sessionId,gain:-100});
       r.buzzerWinner='';r.currentPublic.buzzerWinner='';cb({ok:true,responseMs,wrongBuzz:true});io.to(r.code).emit('buzzWrong',{sessionId:p.sessionId,name:p.name,avatar:p.avatar,penalty:-100});emitRoom(r);
       const available=r.players.filter(x=>x.connected&&!r.buzzerTried.has(x.sessionId));if(!available.length){settleQuestion(r);return}io.to(r.code).emit('buzzerReopened',{tried:[...r.buzzerTried]});return;
     }
   }
   const teamAnswer={answerIndex:+d.answerIndex,responseMs,stake,textAnswer:clean(d.textAnswer,200),numericAnswer:clean(d.numericAnswer,60),cluesUsed:Math.max(0,Math.min(3,+d.cluesUsed||0)),order:Array.isArray(d.order)?d.order.map(x=>clean(x,100)):[],mapLat:Number(d.mapLat),mapLon:Number(d.mapLon),pinX:Number(d.pinX),pinY:Number(d.pinY),double:!!p.powerState?.double,shield:!!p.powerState?.shield};
   if(r.settings?.teamCollaborative&&r.mode==='teams'){for(const m of r.players.filter(x=>x.team===p.team)){r.answers.set(m.sessionId,{...teamAnswer,teamCaptain:p.sessionId});m.powerState={}}}else{r.answers.set(p.sessionId,teamAnswer);p.powerState={}}cb({ok:true,responseMs,teamLocked:!!r.settings?.teamCollaborative});
   const connected=r.players.filter(x=>x.connected),answeredUnits=r.settings?.teamCollaborative?new Set(connected.filter(x=>r.answers.has(x.sessionId)).map(x=>x.team)).size:r.answers.size,totalUnits=r.settings?.teamCollaborative?new Set(connected.map(x=>x.team).filter(Boolean)).size:connected.length;
   io.to(r.code).emit('answerProgress',{answered:answeredUnits,total:r.currentType==='buzzer'?1:r.currentType==='duel'?r.duelists.length:totalUnits});
   const needed=r.currentType==='duel'?r.duelists.length:totalUnits;if(r.currentType==='buzzer'||answeredUnits>=needed)settleQuestion(r);
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
   if(action==='lockAnswers'&&['question','paused'].includes(r.phase)){settleQuestion(r);return cb({ok:true})}
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
 socket.on('quizmasterState',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Endast quizmaster.'});const q=r.current,next=r.deck[r.index+1];cb({ok:true,answered:r.answers?.size||0,total:r.players.filter(p=>p.connected).length,playerStatus:r.players.map(p=>{const a=r.answers?.get(p.sessionId),rr=r.lastResult?.results?.find(x=>x.sessionId===p.sessionId);return {sessionId:p.sessionId,answered:!!a,connected:p.connected,submitted:r.phase==='result'?(a?.textAnswer||a?.numericAnswer||''):undefined,correct:r.phase==='result'?rr?.correct:undefined}}),current:q?{id:q.id,text:r.displayText||q.q,correct:q.a?.[q.r]||'',fact:q.f||'',type:r.currentType||q.specialType||'classic'}:null,next:next?{text:next.q,category:next.c,difficulty:next.d}:null})});
 socket.on('hostAdjustScore',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Endast quizmaster.'});const p=findPlayer(r,cleanId(d.sessionId));if(!p)return cb({ok:false,error:'Spelaren hittades inte.'});const delta=Math.max(-5000,Math.min(5000,Math.round(+d.delta||0)));p.score+=delta;storage.event(r.code,'host-score-adjust',{sessionId:p.sessionId,delta,reason:clean(d.reason,120)});emitRoom(r);cb({ok:true,score:p.score})});
 socket.on('hostPause',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false});if(r.phase==='question'){clearTimer(r);r.phase='paused';r.paused=true;emitRoom(r);io.to(r.code).emit('gamePaused',{reason:clean(d.reason||'Quizmaster pausade spelet.',120)});storage.event(r.code,'pause',{reason:d.reason});return cb({ok:true,paused:true})}if(r.phase==='paused'){r.phase='question';r.paused=false;emitRoom(r);io.to(r.code).emit('gameResumed',{});storage.event(r.code,'resume',{});return cb({ok:true,paused:false})}cb({ok:false,error:'Spelet kan inte pausas nu.'})});
 socket.on('hostReplaceQuestion',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken||!['question','paused'].includes(r.phase))return cb({ok:false,error:'Kan inte byta fråga nu.'});clearTimer(r);const used=new Set(r.deck.map(q=>q.id)),pool=allQuestions().filter(q=>!used.has(q.id)&&(!q.audio||r.settings.audioQuestions));const repl=smartPick(pool,1,r)[0];if(!repl)return cb({ok:false,error:'Ingen ersättningsfråga hittades.'});r.deck[r.index]=repl;r.seen.add(repl.id);storage.event(r.code,'replace-question',{old:r.current?.id,new:repl.id});cb({ok:true});startRoundQuestion(r)});
 socket.on('hostAcceptAnswer',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken||r.phase!=='result'||!r.lastResult)return cb({ok:false,error:'Kan bara godkänna ett svar efter låsning.'});if(!['text','clue'].includes(r.lastResult.type))return cb({ok:false,error:'Manuell godkänning gäller fritextsvar.'});const p=findPlayer(r,cleanId(d.sessionId)),rr=r.lastResult.results?.find(x=>x.sessionId===p?.sessionId);if(!p||!rr)return cb({ok:false,error:'Spelaren hittades inte.'});if(rr.correct)return cb({ok:true,already:true});const base=r.lastResult.type==='clue'?Math.max(75,300-(+r.answers.get(p.sessionId)?.cluesUsed||0)*75):200,mult=r.currentPublic?.multiplier||1,gain=base*mult;p.score+=gain;rr.correct=true;rr.gain+=gain;rr.manualAccepted=true;rr.scoreBreakdown={base:r.lastResult.type==='text'?200:0,typeBonus:r.lastResult.type==='clue'?base:0,speedBonus:0,streakBonus:0,multiplier:mult,double:false,stake:0,total:gain,questionType:r.lastResult.type,manual:true};const st=p.stats||(p.stats=freshStats());st.correct++;const cs=st.categories[r.current?.c]||(st.categories[r.current?.c]={correct:0,total:0});cs.correct++;const qstat=(r.questionStats||[]).findLast?.(x=>x.id===r.current?.id)||(r.questionStats||[]).slice().reverse().find(x=>x.id===r.current?.id);if(qstat){qstat.correct=(qstat.correct||0)+1;qstat.accuracy=pct(qstat.correct,qstat.total||r.players.length)}r.lastResult.room=roomPublic(r);storage.event(r.code,'manual-answer-accepted',{sessionId:p.sessionId,questionId:r.current?.id,gain});emitRoom(r);io.to(r.code).emit('roundResult',r.lastResult);cb({ok:true,gain,score:p.score})});
 socket.on('hostBroadcast',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return cb({ok:false,error:'Endast quizmaster.'});const message=clean(d.message,160);if(!message)return cb({ok:false,error:'Meddelande saknas.'});io.to(r.code).emit('hostMessage',{message,at:Date.now()});storage.event(r.code,'host-message',{message});cb({ok:true})});
 socket.on('replaySame',(d,cb=()=>{})=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken||r.phase!=='finished')return cb({ok:false,error:'Kan inte starta om nu.'});clearTimer(r);r.deck=selectDeck(r,r.settings);if(r.deck.length<2)return cb({ok:false,error:'För få nya frågor kvar i urvalet.'});r.deck.forEach(q=>r.seen.add(q.id));r.index=0;r.round=1;const selectedPlan=allGamePlans().find(x=>x.id===r.settings.gamePlan);r.rounds=(selectedPlan?.rounds?.length)||Math.ceil(r.deck.length/r.settings.roundSize);r.questionStats=[];r.lastResult=null;r.lastGameOver=null;r.tiebreak=false;r.persisted=false;r.events=[];r.midRanks=null;r.lastLeader='';r.secretBonusIndex=r.settings.profile==='family'?-1:Math.floor(Math.random()*r.deck.length);if(r.mode==='teams'&&r.settings.autoTeams)balanceTeams(r);r.players.forEach(p=>{p.score=0;p.stats=freshStats();p.roundScores=[];p.powerups={fifty:1,double:1,shield:1};p.powerState={};p.captain=false});if(r.mode==='teams')for(const n of r.teamNames){const m=r.players.filter(p=>p.team===n);if(m[0])m[0].captain=true}cb({ok:true});startRoundQuestion(r)});
 socket.on('resetRoom',(d)=>{const r=rooms.get(String(d?.code||''));if(!r||d.hostToken!==r.hostToken)return;r.phase='lobby';r.deck=[];r.index=0;r.current=null;r.currentPublic=null;r.answers=new Map();r.questionStats=[];r.lastResult=null;r.lastGameOver=null;r.players.forEach(p=>{p.score=0;p.stats=freshStats();p.powerups={fifty:1,double:1,shield:1};p.powerState={}});r.persisted=false;r.tiebreak=false;emitRoom(r)});
 socket.on('leaveRoom',d=>{const r=rooms.get(String(d?.code||''));if(!r)return;const sid=cleanId(d.sessionId),wasHost=r.hostSessionId===sid;r.players=r.players.filter(p=>p.sessionId!==sid);socket.leave(r.code);if(closeIfEmpty(r))return;if(wasHost){const np=r.players[0];r.hostSessionId=np.sessionId;r.hostToken=token();io.to(np.socketId).emit('hostPromoted',{hostToken:r.hostToken})}emitRoom(r)});
 socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.players.find(x=>x.socketId===socket.id);if(p){p.connected=false;p.socketId=null;emitRoom(r);if(r.hostSessionId===p.sessionId){setTimeout(()=>{const current=rooms.get(r.code),host=current&&findPlayer(current,p.sessionId);if(!current||host?.connected)return;const np=current.players.find(x=>x.connected&&x.sessionId!==p.sessionId);if(np){current.hostSessionId=np.sessionId;current.hostToken=token();io.to(np.socketId).emit('hostPromoted',{hostToken:current.hostToken,reason:'host-disconnected'});io.to(current.code).emit('hostMigration',{name:np.name,avatar:np.avatar});emitRoom(current)}},12000).unref?.()}}}});
});

let loopTick=Date.now();
setInterval(()=>{const now=Date.now(),lag=now-loopTick-5000;loopTick=now;if(lag>2000)console.warn(`[event-loop-lag] ${lag}ms`);},5000).unref();
setInterval(()=>{try{storage.cleanupReceipts(24)}catch{}},60*60*1000).unref();
setInterval(()=>{for(const [c,r] of rooms){if(r.players.length&&!r.players.some(p=>p.connected)&&r.phase==='lobby'){clearTimer(r);rooms.delete(c)}}},15*60*1000).unref();
function gracefulShutdown(signal){console.log(`[shutdown] ${signal}`);try{persistActiveRooms()}catch{};const hard=setTimeout(()=>{try{storage.close()}catch{};process.exit(0)},2500);hard.unref?.();try{io.close()}catch{};try{server.close(()=>{clearTimeout(hard);try{storage.close()}catch{};process.exit(0)})}catch{clearTimeout(hard);try{storage.close()}catch{};process.exit(0)}}
process.on('SIGTERM',()=>gracefulShutdown('SIGTERM'));process.on('SIGINT',()=>gracefulShutdown('SIGINT'));
server.listen(PORT,'0.0.0.0',()=>console.log(`Resequiz ${APP_VERSION} listening on ${PORT}`));
