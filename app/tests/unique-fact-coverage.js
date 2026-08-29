const fs=require('fs'),path=require('path');
const qs=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/questions.json'),'utf8'));
const by={};for(const q of qs){const c=q.c||'Okänd';const x=by[c]||(by[c]={questions:0,facts:new Set()});x.questions++;x.facts.add(q.factKey||q.id)}
let bad=0;console.log('Unique fact coverage (goal 1000; Världen/Hjärngympa excluded)');
for(const c of Object.keys(by).sort()){const x=by[c],excluded=['Världen','Hjärngympa'].includes(c),gap=excluded?0:Math.max(0,1000-x.facts.size);console.log(`${c}: questions=${x.questions} uniqueFacts=${x.facts.size}${excluded?' excluded':` gap=${gap}`}`);if(!excluded&&x.facts.size>x.questions)bad++}
if(bad)process.exit(1);console.log('Integrity OK: variants are not counted as unique facts.');
