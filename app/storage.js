const fs = require('fs');
const path = require('path');

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function readJson(file, fallback){
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch { return fallback; }
}
function writeJsonAtomic(file, value){
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value,null,2)+'\n','utf8');
  fs.renameSync(tmp,file);
}
module.exports={readJson,writeJsonAtomic,ensureDir};
