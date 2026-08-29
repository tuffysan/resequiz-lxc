const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const {createStorage}=require('../storage');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resequiz-storage-'));
try{
  delete process.env.RESEQUIZ_STORAGE;
  const s=createStorage(dir);
  assert.equal(s.status().engine,'json-safe');
  const f=path.join(dir,'sample.json');
  s.writeJson(f,{ok:true,n:1});
  assert.deepEqual(s.readJson(f,{}),{ok:true,n:1});
  assert.equal(s.recordReceipt('1','q1','p1','a').duplicate,false);
  assert.equal(s.recordReceipt('1','q1','p1','a').duplicate,true);
  s.markSeen(['p1'],['q1','q2']);
  s.markFacts(['p1'],['f1']);
  assert(s.seenQuestionIds(['p1']).has('q2'));
  assert(s.seenFactKeys(['p1']).has('f1'));
  s.close();
  console.log('Storage safe mode OK: JSON-authoritative, no SQLite on request path');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
