'use strict';
const fs=require('fs');
const path=require('path');
const {writeJsonAtomic}=require('../app/storage');
const [,,src,dst]=process.argv;
if(!src||!dst){console.error('Usage: node scripts/import-legacy-questions.js <source.json> <dest.json>');process.exit(2)}
const raw=JSON.parse(fs.readFileSync(src,'utf8'));
if(!Array.isArray(raw))throw new Error('Question file must be a JSON array');
const clean=s=>String(s??'').trim();
const out=[];
for(const x of raw){
  if(!x||typeof x!=='object')continue;
  const answers=Array.isArray(x.answers)?x.answers:Array.isArray(x.a)?x.a:[];
  const correct=Number.isInteger(x.correct)?x.correct:Number.isInteger(x.r)?x.r:Number(x.correct??x.r);
  const q={
    id:clean(x.id)||`legacy-${out.length+1}`,
    category:clean(x.category??x.c)||'Övrigt',
    difficulty:['easy','medium','hard'].includes(x.difficulty??x.d)?(x.difficulty??x.d):'medium',
    question:clean(x.question??x.q),
    answers:answers.map(clean),
    correct,
    explanation:clean(x.explanation??x.f)
  };
  if(!q.question||q.answers.length<2||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.answers.length)continue;
  out.push(q);
}
writeJsonAtomic(dst,out);
console.log(`Imported ${out.length} valid questions from ${raw.length} rows -> ${dst}`);
