#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
let auditBank;try{({auditBank}=require('../app/question-verification'))}catch{({auditBank}=require('../question-verification'))}
const input=process.argv[2]||process.env.RESEQUIZ_DATA_DIR&&path.join(process.env.RESEQUIZ_DATA_DIR,'questions.json')||'/var/lib/resequiz/questions.json';
const mutate=process.argv.includes('--apply');
const qs=JSON.parse(fs.readFileSync(input,'utf8'));
const a=auditBank(qs,{mutate,quarantineStructural:true});
if(mutate){const bak=input+`.pre-verification-${new Date().toISOString().replace(/[:.]/g,'-')}.bak`;fs.copyFileSync(input,bak);fs.writeFileSync(input,JSON.stringify(qs,null,2)+'\
');console.error('Backup:',bak)}
console.log(JSON.stringify(a.counts,null,2));
