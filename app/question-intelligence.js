'use strict';
const crypto=require('crypto');
const safe=v=>String(v??'').trim();
const WRAPPERS=[
 /^vad\s+säger\s+dina\s+kunskaper\s*[–—:\-]\s*/i,
 /^känner\s+du\s+till\s+svaret\s*[:–—\-]\s*/i,
 /^kan\s+du\s+svaret\s*[:–—\-]\s*/i,
 /^kan\s+du\s+räkna\s+ut\s+eller\s+ange\s+detta\s*[:–—\-]\s*/i,
 /^kan\s+du\s+välja\s+rätt\s+alternativ\s*[:–—\-]\s*/i,
 /^vilket\s+alternativ\s+är\s+rätt\s*[:–—\-]\s*/i,
 /^vad\s+är\s+rätt\s+svar\s*[:–—\-]\s*/i,
 /^hur\s+lyder\s+rätt\s+svar\s+på\s+detta\s*[:–—\-]\s*/i,
 /^kan\s+du\s+svara\s+på\s+detta\s*[:–—\-]\s*/i,
 /^kan\s+du\s+ange\s+platsen\s*[:–—\-]\s*/i,
 /^bildutmaning\s*[:–—\-]\s*/i,
 /^quizfråga\s*[:–—\-]\s*/i,
 /^fråga\s*[:–—\-]\s*/i,
 /^i\s+en\s+quiz(?:fråga)?\s*[:–—\-]\s*/i,
 /^i\s+ett\s+quiz\s*[:–—\-]\s*/i,
 /^i\s+denna\s+quiz\s*[:–—\-]\s*/i,
 /^i\s+detta\s+quiz\s*[:–—\-]\s*/i,
 /^i\s+en\s+frågesport\s*[:–—\-]\s*/i
];
function cleanQuestionText(value){
 let text=safe(value).replace(/\s+/g,' ').trim();
 text=text.replace(/^kan\s+du\s+ange\s+vem\s+som\s+/i,'Vem ').replace(/^kan\s+du\s+ange\s+(vilken|vilket|vad)\s+/i,(_,w)=>w.charAt(0).toUpperCase()+w.slice(1)+' ');
 for(let pass=0;pass<6;pass++){
  const before=text;
  for(const re of WRAPPERS) text=text.replace(re,'').trim();
  if(text===before)break;
 }
 text=text.replace(/^[:;,.!?–—\-]+\s*/,'').trim();
 text=text.replace(/^(Vilken|Vilket|Vilka|Vad)\s+(.+?)\s+som\s+(är|var|har|hade|blev|kan)\b/i,'$1 $2 $3');
 // Repair common sentence fragments produced by legacy presentation wrappers.
 if(/^betyder\s+/i.test(text))text='Vad '+text;
 else if(/^många\s+/i.test(text))text='Hur '+text;
 else if(/^mycket\s+/i.test(text))text='Hur '+text;
 else if(/^(hög|lång|gammal|snabb|stor)\s+är\s+/i.test(text))text='Hur '+text;
 else if(/^som\s+/i.test(text))text=text.replace(/^som\s+/i,'');
 if(text)text=text.charAt(0).toUpperCase()+text.slice(1);
 return text;
}
function normalizeText(v){return cleanQuestionText(v).toLocaleLowerCase('sv-SE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9åäö ]/g,' ').replace(/\s+/g,' ').trim()}
const STOP=new Set('vad vilken vilket vilka vem var vart när hur är har hade finns heter betyder mycket många kan av i på för till med och eller som den det de en ett från om ungefär rätt svar detta'.split(' '));
function tokens(v){return new Set(normalizeText(v).split(' ').filter(x=>x.length>2&&!STOP.has(x)))}
function similarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i)}
function slug(v){return normalizeText(v).replace(/\s+/g,'.').replace(/\.+/g,'.').slice(0,160).replace(/^\.|\.$/g,'')}
function deriveFactKey(q){
 if(safe(q.factKey))return safe(q.factKey);
 if(safe(q.family))return `family.${slug(q.family)}`;
 const cat=slug(q.category||q.c||'general')||'general';
 const base=slug(cleanQuestionText(q.question||q.q||''));
 return base?`${cat}.${base}`:`${cat}.${crypto.createHash('sha1').update(JSON.stringify(q)).digest('hex').slice(0,12)}`;
}
function answerQuality(q){
 const a=(q.answers||q.a||[]).map(safe),reasons=[];
 if(a.length<2)reasons.push('för få svarsalternativ');
 const low=a.map(x=>x.toLocaleLowerCase('sv-SE'));
 if(new Set(low).size!==low.length)reasons.push('dubbla svarsalternativ');
 if(a.some(x=>!x))reasons.push('tomt svarsalternativ');
 const ci=Number(q.correct??q.r),correct=a[ci]||'';
 if(!Number.isInteger(ci)||ci<0||ci>=a.length)reasons.push('ogiltigt rätt svar');
 if(correct&&normalizeText(q.question||q.q||'').includes(normalizeText(correct))&&normalizeText(correct).length>3)reasons.push('rätt svar förekommer i frågetexten');
 if(a.length>=3){const lens=a.map(x=>x.length).filter(Boolean),avg=lens.reduce((x,y)=>x+y,0)/lens.length;if(correct.length>Math.max(18,avg*2.2))reasons.push('rätt svar sticker ut i längd')}
 return reasons;
}
function wordingQuality(q){
 const raw=safe(q.question||q.q),clean=cleanQuestionText(raw),reasons=[];
 if(raw!==clean)reasons.push('presentationstext i frågan');
 if(clean.length>240)reasons.push('mycket lång frågetext');
 if(clean.length<8)reasons.push('mycket kort frågetext');
 if(/\b(rätt svar|quizfråga|frågesport|kan du svara|kan du välja)\b/i.test(clean))reasons.push('generisk quizformulering');
 if(/\b(\w+)\s+\1\b/i.test(clean))reasons.push('upprepat ord');
 return reasons;
}
module.exports={cleanQuestionText,normalizeText,similarity,deriveFactKey,answerQuality,wordingQuality};
