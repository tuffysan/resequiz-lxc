#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const [,,questionsFile,targetArg='520']=process.argv;
if(!questionsFile){console.error('Usage: expand-source-backed-questions.js <questions.json> [target-per-category]');process.exit(2)}
const TARGET=Math.max(100,Number(targetArg)||520);
const VERIFIED_AT=new Date().toISOString().slice(0,10);
const endpoint='https://query.wikidata.org/sparql';
const wanted=['80/90/00-talet','Allmänbildning','Bildrunda','Djur & natur','Film & TV','Fotboll','Historia','Hjärngympa','Mat & dryck','Musik','Musikquiz','Onödigt vetande','Resor','Sport','Sverige','Vetenskap & teknik','Världen'];
let bank=JSON.parse(fs.readFileSync(questionsFile,'utf8'));
const fp=new Set(bank.map(q=>`${q.category||''}|${String(q.question||'').trim().toLowerCase()}`));
const ids=new Set(bank.map(q=>String(q.id)));
const countCat=c=>bank.filter(q=>q.category===c && q.verified===true).length;
function add(category,question,correct,wrong,extra={}){
  question=String(question||'').trim(); correct=String(correct||'').trim();
  let opts=[correct,...wrong.map(String).map(s=>s.trim())].filter(Boolean);
  opts=[...new Set(opts)]; if(!question||!correct||opts.length<4)return false; opts=opts.slice(0,4);
  const key=`${category}|${question.toLowerCase()}`; if(fp.has(key))return false;
  // stable shuffle from question hash
  let h=0;for(const ch of question)h=((h<<5)-h+ch.charCodeAt(0))|0;
  for(let i=opts.length-1;i>0;i--){const j=Math.abs(h+i*7919)%(i+1);[opts[i],opts[j]]=[opts[j],opts[i]]}
  const correctIndex=opts.indexOf(correct); if(correctIndex<0)return false;
  const id='src-'+require('crypto').createHash('sha1').update(category+'|'+question).digest('hex').slice(0,18);
  if(ids.has(id))return false;
  bank.push({id,category,difficulty:extra.difficulty||'medium',question,answers:opts,correct:correctIndex,explanation:extra.explanation||`Rätt svar är ${correct}.`,verified:true,verifiedAt:VERIFIED_AT,verificationLevel:'source-backed',verificationMethod:extra.method||'Wikidata structured data',source:extra.source||'https://www.wikidata.org/',visual:extra.visual||'',subtype:extra.visual?'image':''});
  fp.add(key);ids.add(id);return true;
}
function pick(values,correct,n=3){const uniq=[...new Set(values.map(String).filter(x=>x&&x!==String(correct)))];let out=[];for(let i=0;i<uniq.length&&out.length<n;i++){const idx=Math.abs((String(correct).charCodeAt(i%String(correct).length)||17)*31+i*17)%uniq.length;const v=uniq[idx];if(!out.includes(v))out.push(v)}for(const v of uniq){if(out.length>=n)break;if(!out.includes(v))out.push(v)}return out.slice(0,n)}
const CACHE_DIR=process.env.QUIZ_SOURCE_CACHE||path.join(path.dirname(questionsFile),'source-cache');
const CACHE_MAX_AGE_MS=Number(process.env.QUIZ_SOURCE_CACHE_DAYS||30)*86400000;
const REQUEST_DELAY_MS=Number(process.env.QUIZ_SOURCE_DELAY_MS||1200);
const MAX_ATTEMPTS=Math.max(1,Number(process.env.QUIZ_SOURCE_RETRIES||4));
const TIMEOUT_MS=Math.max(10000,Number(process.env.QUIZ_SOURCE_TIMEOUT_MS||45000));
fs.mkdirSync(CACHE_DIR,{recursive:true});
let lastRequestAt=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function cacheFile(q){return path.join(CACHE_DIR,crypto.createHash('sha256').update(q).digest('hex')+'.json')}
function readCache(q,allowStale=false){
  const f=cacheFile(q); try{const st=fs.statSync(f);if(!allowStale&&Date.now()-st.mtimeMs>CACHE_MAX_AGE_MS)return null;const j=JSON.parse(fs.readFileSync(f,'utf8'));return Array.isArray(j.rows)?j.rows:null}catch{return null}
}
function writeCache(q,rows){const f=cacheFile(q),tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify({savedAt:new Date().toISOString(),rows}));fs.renameSync(tmp,f)}
async function sparql(name,q){
  const cached=readCache(q,false);
  if(cached){console.log(`Cache ${name}: ${cached.length} poster`);return cached}
  const url=endpoint+'?format=json&query='+encodeURIComponent(q);
  let lastError;
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
    const wait=Math.max(0,REQUEST_DELAY_MS-(Date.now()-lastRequestAt));if(wait)await sleep(wait);
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);lastRequestAt=Date.now();
    try{
      const r=await fetch(url,{headers:{'User-Agent':'Quiz/21.0.1 source-backed question builder (self-hosted educational quiz)','Accept':'application/sparql-results+json'},signal:ctrl.signal});
      if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
      const j=await r.json();const rows=(j.results?.bindings||[]).map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v.value])));
      writeCache(q,rows);console.log(`Källa ${name}: ${rows.length} poster`);return rows;
    }catch(e){
      lastError=e;const retryable=e.name==='AbortError'||/429|502|503|504|aborted|fetch failed/i.test(String(e.message));
      console.warn(`Källa ${name}: försök ${attempt}/${MAX_ATTEMPTS} misslyckades: ${e.message}`);
      if(!retryable||attempt===MAX_ATTEMPTS)break;
      await sleep(Math.min(15000,1000*Math.pow(2,attempt-1)));
    }finally{clearTimeout(timer)}
  }
  const stale=readCache(q,true);if(stale){console.warn(`Källa ${name}: använder sparad cache efter nätverksfel (${stale.length} poster).`);return stale}
  throw lastError||new Error('Källan kunde inte hämtas');
}
const label=`SERVICE wikibase:label { bd:serviceParam wikibase:language "sv,en". }`;
async function main(){
 let remoteOK=true;
 try{await sparql('anslutningstest','SELECT ?item WHERE { ?item wdt:P31 wd:Q6256. } LIMIT 1')}catch(e){remoteOK=false;console.warn('Wikidata är inte tillgängligt just nu:',e.message)}
 const need=wanted.filter(c=>countCat(c)<TARGET && c!=='Hjärngympa');
 if(!need.length){console.log(`Alla källbaserade kategorier har redan minst ${TARGET} verifierade frågor.`)}
 // Countries: reused for general knowledge, travel, world and image round.
 let countries=[];if(remoteOK)try{countries=await sparql('länder',`SELECT DISTINCT ?item ?itemLabel ?capital ?capitalLabel ?currency ?currencyLabel ?continent ?continentLabel ?flag WHERE { ?item wdt:P31 wd:Q6256; wdt:P36 ?capital. OPTIONAL{?item wdt:P38 ?currency.} OPTIONAL{?item wdt:P30 ?continent.} OPTIONAL{?item wdt:P41 ?flag.} ${label} } LIMIT 300`)}catch(e){console.warn('Wikidata länder:',e.message)}
 const capitals=countries.map(x=>x.capitalLabel), countryNames=countries.map(x=>x.itemLabel), currencies=countries.map(x=>x.currencyLabel), continents=countries.map(x=>x.continentLabel);
 for(const r of countries){const src=r.item||'https://www.wikidata.org/';
  add('Allmänbildning',`Vilken är huvudstaden i ${r.itemLabel}?`,r.capitalLabel,pick(capitals,r.capitalLabel),{source:src,difficulty:'easy'});
  if(r.currencyLabel)add('Allmänbildning',`Vilken valuta är kopplad till ${r.itemLabel}?`,r.currencyLabel,pick(currencies,r.currencyLabel),{source:src});
  add('Resor',`Du reser till ${r.itemLabel}. Vilken huvudstad hör till landet?`,r.capitalLabel,pick(capitals,r.capitalLabel),{source:src,difficulty:'easy'});
  if(r.continentLabel)add('Resor',`På vilken världsdel ligger ${r.itemLabel}?`,r.continentLabel,pick(continents,r.continentLabel),{source:src});
  add('Världen',`${r.capitalLabel} är huvudstad i vilket land?`,r.itemLabel,pick(countryNames,r.itemLabel),{source:src});
  if(r.currencyLabel)add('Världen',`Vilket land i listan använder valutan ${r.currencyLabel}?`,r.itemLabel,pick(countryNames,r.itemLabel),{source:src});
  if(r.flag){add('Bildrunda','Vilket land har denna flagga?',r.itemLabel,pick(countryNames,r.itemLabel),{source:src,visual:r.flag,difficulty:'easy'});if(r.capitalLabel)add('Bildrunda','Vilken huvudstad hör till landet vars flagga visas?',r.capitalLabel,pick(capitals,r.capitalLabel),{source:src,visual:r.flag});if(r.continentLabel)add('Bildrunda','På vilken världsdel ligger landet vars flagga visas?',r.continentLabel,pick(continents,r.continentLabel),{source:src,visual:r.flag});}
 }
 // Sweden municipalities: county and administrative seat.
 let swe=[];if(remoteOK)try{swe=await sparql('svenska kommuner',`SELECT DISTINCT ?item ?itemLabel ?county ?countyLabel ?seat ?seatLabel WHERE { ?item wdt:P31 wd:Q127448; wdt:P17 wd:Q34. OPTIONAL{?item wdt:P131 ?county.} OPTIONAL{?item wdt:P36 ?seat.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata Sverige:',e.message)}
 const counties=swe.map(x=>x.countyLabel),seats=swe.map(x=>x.seatLabel),municipal=swe.map(x=>x.itemLabel);
 for(const r of swe){const src=r.item||'https://www.wikidata.org/';if(r.countyLabel)add('Sverige',`Vilket län tillhör ${r.itemLabel}?`,r.countyLabel,pick(counties,r.countyLabel),{source:src});if(r.seatLabel)add('Sverige',`Vilken ort är centralort i ${r.itemLabel}?`,r.seatLabel,pick(seats,r.seatLabel),{source:src});if(r.seatLabel)add('Sverige',`${r.seatLabel} är centralort i vilken kommun?`,r.itemLabel,pick(municipal,r.itemLabel),{source:src});}
 // Films
 let films=[];if(remoteOK)try{films=await sparql('filmer',`SELECT DISTINCT ?item ?itemLabel ?director ?directorLabel ?country ?countryLabel (YEAR(?date) AS ?year) WHERE { ?item wdt:P31 wd:Q11424; wdt:P577 ?date. FILTER(YEAR(?date)>=1950) OPTIONAL{?item wdt:P57 ?director.} OPTIONAL{?item wdt:P495 ?country.} ${label} } LIMIT 380`)}catch(e){console.warn('Wikidata film:',e.message)}
 const directors=films.map(x=>x.directorLabel), filmYears=films.map(x=>x.year), filmCountries=films.map(x=>x.countryLabel);
 for(const r of films){const src=r.item||'https://www.wikidata.org/';if(r.directorLabel)add('Film & TV',`Vem regisserade filmen ”${r.itemLabel}”?`,r.directorLabel,pick(directors,r.directorLabel),{source:src});if(r.year)add('Film & TV',`Vilket år hade ”${r.itemLabel}” premiär enligt Wikidata?`,r.year,pick(filmYears,r.year),{source:src});if(r.countryLabel)add('Film & TV',`Vilket produktionsland är kopplat till filmen ”${r.itemLabel}”?`,r.countryLabel,pick(filmCountries,r.countryLabel),{source:src});if(r.year&&Number(r.year)>=1980&&Number(r.year)<=2009){add('80/90/00-talet',`Vilket år hade filmen ”${r.itemLabel}” premiär?`,r.year,pick(filmYears,r.year),{source:src});if(r.directorLabel)add('80/90/00-talet',`Vem regisserade ”${r.itemLabel}”, en film från ${r.year}?`,r.directorLabel,pick(directors,r.directorLabel),{source:src});}}
 // Musicians
 let musicians=[];if(remoteOK)try{musicians=await sparql('musiker',`SELECT DISTINCT ?item ?itemLabel ?country ?countryLabel ?instrument ?instrumentLabel ?genre ?genreLabel WHERE { ?item wdt:P31 wd:Q5; wdt:P106/wdt:P279* wd:Q639669. OPTIONAL{?item wdt:P27 ?country.} OPTIONAL{?item wdt:P1303 ?instrument.} OPTIONAL{?item wdt:P136 ?genre.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata musik:',e.message)}
 const mc=musicians.map(x=>x.countryLabel),mi=musicians.map(x=>x.instrumentLabel),mg=musicians.map(x=>x.genreLabel);
 for(const r of musicians){const src=r.item||'https://www.wikidata.org/';if(r.countryLabel)add('Musik',`Vilket land är musikern ${r.itemLabel} medborgare i?`,r.countryLabel,pick(mc,r.countryLabel),{source:src});if(r.instrumentLabel)add('Musik',`Vilket instrument är ${r.itemLabel} kopplad till?`,r.instrumentLabel,pick(mi,r.instrumentLabel),{source:src});if(r.genreLabel)add('Musik',`Vilken musikgenre är ${r.itemLabel} kopplad till?`,r.genreLabel,pick(mg,r.genreLabel),{source:src});}
 // Songs for music quiz
 let songs=[];if(remoteOK)try{songs=await sparql('låtar',`SELECT DISTINCT ?item ?itemLabel ?performer ?performerLabel (YEAR(?date) AS ?year) WHERE { ?item wdt:P31/wdt:P279* wd:Q7366; wdt:P175 ?performer. OPTIONAL{?item wdt:P577 ?date.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata låtar:',e.message)}
 const performers=songs.map(x=>x.performerLabel), songYears=songs.map(x=>x.year);
 for(const r of songs){const src=r.item||'https://www.wikidata.org/';if(r.performerLabel)add('Musikquiz',`Vem framför låten ”${r.itemLabel}”?`,r.performerLabel,pick(performers,r.performerLabel),{source:src,difficulty:'easy'});if(r.year)add('Musikquiz',`Vilket år publicerades ”${r.itemLabel}”?`,r.year,pick(songYears,r.year),{source:src});if(r.year&&Number(r.year)>=1980&&Number(r.year)<=2009)add('80/90/00-talet',`Vilket år släpptes låten ”${r.itemLabel}”?`,r.year,pick(songYears,r.year),{source:src});}
 // Footballers
 let football=[];if(remoteOK)try{football=await sparql('fotbollsspelare',`SELECT DISTINCT ?item ?itemLabel ?country ?countryLabel ?position ?positionLabel ?club ?clubLabel WHERE { ?item wdt:P106 wd:Q937857. OPTIONAL{?item wdt:P27 ?country.} OPTIONAL{?item wdt:P413 ?position.} OPTIONAL{?item wdt:P54 ?club.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata fotboll:',e.message)}
 const fc=football.map(x=>x.countryLabel),fp=football.map(x=>x.positionLabel),fclub=football.map(x=>x.clubLabel);
 for(const r of football){const src=r.item||'https://www.wikidata.org/';if(r.countryLabel)add('Fotboll',`Vilket land representerar eller kommer fotbollsspelaren ${r.itemLabel} från?`,r.countryLabel,pick(fc,r.countryLabel),{source:src});if(r.positionLabel)add('Fotboll',`Vilken spelposition är ${r.itemLabel} kopplad till?`,r.positionLabel,pick(fp,r.positionLabel),{source:src});if(r.clubLabel)add('Fotboll',`Vilken klubb är ${r.itemLabel} kopplad till i Wikidata?`,r.clubLabel,pick(fclub,r.clubLabel),{source:src,difficulty:'hard'});}
 // General athletes
 let athletes=[];if(remoteOK)try{athletes=await sparql('idrottare',`SELECT DISTINCT ?item ?itemLabel ?sport ?sportLabel ?country ?countryLabel (YEAR(?birth) AS ?year) WHERE { ?item wdt:P31 wd:Q5; wdt:P106 wd:Q2066131. OPTIONAL{?item wdt:P641 ?sport.} OPTIONAL{?item wdt:P27 ?country.} OPTIONAL{?item wdt:P569 ?birth.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata sport:',e.message)}
 const asport=athletes.map(x=>x.sportLabel),ac=athletes.map(x=>x.countryLabel),ay=athletes.map(x=>x.year);
 for(const r of athletes){const src=r.item||'https://www.wikidata.org/';if(r.sportLabel)add('Sport',`Vilken sport är ${r.itemLabel} känd för?`,r.sportLabel,pick(asport,r.sportLabel),{source:src});if(r.countryLabel)add('Sport',`Vilket land är idrottaren ${r.itemLabel} medborgare i?`,r.countryLabel,pick(ac,r.countryLabel),{source:src});if(r.year)add('Sport',`Vilket år föddes ${r.itemLabel}?`,r.year,pick(ay,r.year),{source:src,difficulty:'hard'});}
 // Historical people
 let hist=[];if(remoteOK)try{hist=await sparql('historiska personer',`SELECT DISTINCT ?item ?itemLabel ?country ?countryLabel ?occupation ?occupationLabel (YEAR(?birth) AS ?year) WHERE { ?item wdt:P31 wd:Q5; wdt:P569 ?birth. FILTER(YEAR(?birth)<1900) OPTIONAL{?item wdt:P27 ?country.} OPTIONAL{?item wdt:P106 ?occupation.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata historia:',e.message)}
 const hc=hist.map(x=>x.countryLabel),ho=hist.map(x=>x.occupationLabel),hy=hist.map(x=>x.year);
 for(const r of hist){const src=r.item||'https://www.wikidata.org/';if(r.year)add('Historia',`Vilket år föddes ${r.itemLabel}?`,r.year,pick(hy,r.year),{source:src});if(r.countryLabel)add('Historia',`Vilket land var ${r.itemLabel} medborgare i?`,r.countryLabel,pick(hc,r.countryLabel),{source:src});if(r.occupationLabel)add('Historia',`Vilket yrke eller roll är ${r.itemLabel} kopplad till?`,r.occupationLabel,pick(ho,r.occupationLabel),{source:src});}
 // Animals/nature
 let taxa=[];if(remoteOK)try{taxa=await sparql('djur och arter',`SELECT DISTINCT ?item ?itemLabel ?parent ?parentLabel ?status ?statusLabel ?image WHERE { ?item wdt:P31 wd:Q16521; wdt:P171 ?parent. OPTIONAL{?item wdt:P141 ?status.} OPTIONAL{?item wdt:P18 ?image.} ${label} } LIMIT 450`)}catch(e){console.warn('Wikidata djur:',e.message)}
 const parents=taxa.map(x=>x.parentLabel),statuses=taxa.map(x=>x.statusLabel);
 for(const r of taxa){const src=r.item||'https://www.wikidata.org/';if(r.parentLabel)add('Djur & natur',`Vilket överordnat taxon är ${r.itemLabel} kopplat till?`,r.parentLabel,pick(parents,r.parentLabel),{source:src});if(r.statusLabel)add('Djur & natur',`Vilken bevarandestatus är ${r.itemLabel} kopplad till?`,r.statusLabel,pick(statuses,r.statusLabel),{source:src});if(r.image)add('Djur & natur',`Vilken art eller taxon visas på bilden?`,r.itemLabel,pick(taxa.map(x=>x.itemLabel),r.itemLabel),{source:src,visual:r.image,difficulty:'easy'});}
 // Food/drink
 let food=[];if(remoteOK)try{food=await sparql('mat och dryck',`SELECT DISTINCT ?item ?itemLabel ?country ?countryLabel ?ingredient ?ingredientLabel WHERE { { ?item wdt:P31/wdt:P279* wd:Q746549. } UNION { ?item wdt:P31/wdt:P279* wd:Q40050. } OPTIONAL{?item wdt:P495 ?country.} OPTIONAL{?item wdt:P527 ?ingredient.} ${label} } LIMIT 450`)}catch(e){console.warn('Wikidata mat:',e.message)}
 const foodCountries=food.map(x=>x.countryLabel),ingredients=food.map(x=>x.ingredientLabel),foods=food.map(x=>x.itemLabel);
 for(const r of food){const src=r.item||'https://www.wikidata.org/';if(r.countryLabel)add('Mat & dryck',`Vilket ursprungsland är ${r.itemLabel} kopplad till?`,r.countryLabel,pick(foodCountries,r.countryLabel),{source:src});if(r.ingredientLabel)add('Mat & dryck',`Vilken ingrediens ingår i ${r.itemLabel} enligt Wikidata?`,r.ingredientLabel,pick(ingredients,r.ingredientLabel),{source:src});if(r.countryLabel)add('Mat & dryck',`Vilken maträtt eller dryck i listan är kopplad till ${r.countryLabel}?`,r.itemLabel,pick(foods,r.itemLabel),{source:src,difficulty:'hard'});}
 // Mountains for trivia
 let mountains=[];if(remoteOK)try{mountains=await sparql('berg',`SELECT DISTINCT ?item ?itemLabel ?country ?countryLabel ?height WHERE { ?item wdt:P31/wdt:P279* wd:Q8502. OPTIONAL{?item wdt:P17 ?country.} OPTIONAL{?item wdt:P2044 ?height.} ${label} } LIMIT 400`)}catch(e){console.warn('Wikidata berg:',e.message)}
 const mountainCountries=mountains.map(x=>x.countryLabel), heights=mountains.map(x=>x.height).filter(Boolean).map(x=>String(Math.round(Number(x))));
 for(const r of mountains){const src=r.item||'https://www.wikidata.org/';if(r.countryLabel)add('Onödigt vetande',`I vilket land ligger berget ${r.itemLabel}?`,r.countryLabel,pick(mountainCountries,r.countryLabel),{source:src});if(r.height&&Number.isFinite(Number(r.height))){const h=String(Math.round(Number(r.height)));add('Onödigt vetande',`Ungefär hur många meter över havet är ${r.itemLabel}?`,h,pick(heights,h),{source:src,difficulty:'hard'});}}
 // Chemical elements + scientists for science
 let elements=[];if(remoteOK)try{elements=await sparql('grundämnen',`SELECT DISTINCT ?item ?itemLabel ?symbol ?number WHERE { ?item wdt:P31 wd:Q11344; wdt:P246 ?symbol; wdt:P1086 ?number. ${label} } LIMIT 140`)}catch(e){console.warn('Wikidata grundämnen:',e.message)}
 const symbols=elements.map(x=>x.symbol),numbers=elements.map(x=>x.number),enames=elements.map(x=>x.itemLabel);
 for(const r of elements){const src=r.item||'https://www.wikidata.org/';add('Vetenskap & teknik',`Vilken kemisk beteckning har grundämnet ${r.itemLabel}?`,r.symbol,pick(symbols,r.symbol),{source:src,difficulty:'easy'});add('Vetenskap & teknik',`Vilket atomnummer har ${r.itemLabel}?`,r.number,pick(numbers,r.number),{source:src});add('Vetenskap & teknik',`Vilket grundämne har beteckningen ${r.symbol}?`,r.itemLabel,pick(enames,r.itemLabel),{source:src,difficulty:'easy'});}
 let scientists=[];if(remoteOK)try{scientists=await sparql('forskare',`SELECT DISTINCT ?item ?itemLabel ?field ?fieldLabel ?country ?countryLabel WHERE { ?item wdt:P31 wd:Q5; wdt:P106/wdt:P279* wd:Q901. OPTIONAL{?item wdt:P101 ?field.} OPTIONAL{?item wdt:P27 ?country.} ${label} } LIMIT 250`)}catch(e){console.warn('Wikidata forskare:',e.message)}
 const sf=scientists.map(x=>x.fieldLabel),sc=scientists.map(x=>x.countryLabel);
 for(const r of scientists){const src=r.item||'https://www.wikidata.org/';if(r.fieldLabel)add('Vetenskap & teknik',`Vilket forskningsfält är ${r.itemLabel} kopplad till?`,r.fieldLabel,pick(sf,r.fieldLabel),{source:src});if(r.countryLabel)add('Vetenskap & teknik',`Vilket land var forskaren ${r.itemLabel} medborgare i?`,r.countryLabel,pick(sc,r.countryLabel),{source:src});}
 // Deterministically verified brain-teasers; no external factual dependency.
 for(let a=2;countCat('Hjärngympa')<TARGET && a<80;a++)for(let b=2;b<80 && countCat('Hjärngympa')<TARGET;b++){
   const sum=a+b,wrong=[sum+1,sum-1,a*b].map(String);add('Hjärngympa',`Vad blir ${a} + ${b}?`,String(sum),wrong,{source:'urn:quiz:deterministic-arithmetic',method:'Deterministic arithmetic',difficulty:a+b<30?'easy':a+b<80?'medium':'hard',explanation:`${a} + ${b} = ${sum}.`});
 }
 // Fill general categories with additional country relation forms when still below target.
 for(const c of ['Allmänbildning','Resor','Världen'])for(const r of countries){if(countCat(c)>=TARGET)break;if(r.continentLabel)add(c,`Vilken världsdel hör ${r.itemLabel} till?`,r.continentLabel,pick(continents,r.continentLabel),{source:r.item});}
 fs.writeFileSync(questionsFile+'.tmp',JSON.stringify(bank,null,2)+'\n');fs.renameSync(questionsFile+'.tmp',questionsFile);
 console.log('\nVerifierade/källbaserade frågor per kategori:');for(const c of wanted)console.log(`${c}: ${countCat(c)}${countCat(c)>=TARGET?' ✓':' (under mål)'}`);
 const under=wanted.filter(c=>countCat(c)<TARGET);if(under.length){console.warn(`Målet ${TARGET}+ nåddes inte för: ${under.join(', ')}. Kör skriptet igen senare; befintliga frågor behålls.`);process.exitCode=3}else console.log(`Alla kategorier har minst ${TARGET} verifierade frågor.`)
}
main().catch(e=>{console.error('Kunde inte bygga källbaserad frågebank:',e.stack||e);process.exit(1)});
