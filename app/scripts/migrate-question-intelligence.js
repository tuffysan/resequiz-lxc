'use strict';
const path=require('path'),fs=require('fs');
const {readJson,writeJsonAtomic}=require('../storage');
const {cleanQuestionText,deriveFactKey}=require('../question-intelligence');
const file=process.argv[2]||path.join(process.env.RESEQUIZ_DATA_DIR||path.join(__dirname,'..','data'),'questions.json');
const dry=process.argv.includes('--dry-run');
const qs=readJson(file,[]);let cleaned=0,factKeys=0;
for(const q of qs){const before=q.question??q.q??'',after=cleanQuestionText(before);if(after&&after!==before){if('question'in q)q.question=after;else q.q=after;cleaned++}if(!q.factKey){q.factKey=deriveFactKey(q);factKeys++}}
if(!dry){const backup=`${file}.pre-22.1-${new Date().toISOString().replace(/[:.]/g,'-')}.bak`;fs.copyFileSync(file,backup);writeJsonAtomic(file,qs);console.log(`Backup: ${backup}`)}
console.log(JSON.stringify({ok:true,total:qs.length,cleaned,factKeys,dryRun:dry},null,2));
