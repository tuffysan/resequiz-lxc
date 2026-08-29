const fs=require('fs');
const path=require('path');
let Database=null;
try{Database=require('better-sqlite3')}catch{}

function createStorage(dataDir){
  fs.mkdirSync(dataDir,{recursive:true});
  const dbFile=path.join(dataDir,'resequiz.db');
  const mode=String(process.env.RESEQUIZ_STORAGE||'json').toLowerCase();
  let db=null;
  if(mode==='sqlite'&&Database){
    db=new Database(dbFile,{timeout:750});
    db.pragma('busy_timeout = 750');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS game_events (id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT, event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);`);
    const migrations=[[1,'initial-kv-event-store'],[2,'global-no-repeat'],[3,'semantic-no-repeat-facts'],[4,'question-health-and-idempotency']];
    db.exec(`CREATE TABLE IF NOT EXISTS player_seen_questions (session_id TEXT NOT NULL, question_id TEXT NOT NULL, seen_at TEXT NOT NULL, PRIMARY KEY(session_id,question_id));
             CREATE TABLE IF NOT EXISTS player_seen_facts (session_id TEXT NOT NULL, fact_key TEXT NOT NULL, seen_at TEXT NOT NULL, PRIMARY KEY(session_id,fact_key));
             CREATE TABLE IF NOT EXISTS answer_receipts (room_code TEXT NOT NULL, question_id TEXT NOT NULL, session_id TEXT NOT NULL, submission_id TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY(room_code,question_id,session_id));
             CREATE INDEX IF NOT EXISTS idx_answer_receipts_submission ON answer_receipts(submission_id);`);
    const ins=db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)');
    for(const [v,n] of migrations)ins.run(v,n,new Date().toISOString());
  }

  const keyFor=f=>path.basename(f);
  const seenQFile=path.join(dataDir,'seen-questions.json');
  const seenFFile=path.join(dataDir,'seen-facts.json');
  const receiptFile=path.join(dataDir,'answer-receipts.json');
  const eventFile=path.join(dataDir,'game-events.jsonl');
  const safeRead=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}};
  const atomicWrite=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file)};

  function readJson(file,fallback){
    // JSON files are authoritative in the default mode. This avoids a native,
    // synchronous SQLite call on normal HTTP/Socket.IO request paths.
    if(!db)return safeRead(file,fallback);
    const key=keyFor(file);
    try{
      const row=db.prepare('SELECT value FROM kv WHERE key=?').get(key);
      if(row){try{return JSON.parse(row.value)}catch{}}
    }catch{}
    try{if(fs.existsSync(file)){const val=JSON.parse(fs.readFileSync(file,'utf8'));writeJson(file,val);return val}}catch{}
    return fallback;
  }
  function writeJson(file,data){
    atomicWrite(file,data);
    if(db){
      try{db.prepare(`INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).run(keyFor(file),JSON.stringify(data),new Date().toISOString())}catch(e){console.warn('[storage] sqlite mirror write failed:',e.message)}
    }
  }

  let seenQ=safeRead(seenQFile,{}),seenF=safeRead(seenFFile,{}),receipts=safeRead(receiptFile,{});
  if(!seenQ||typeof seenQ!=='object'||Array.isArray(seenQ))seenQ={};
  if(!seenF||typeof seenF!=='object'||Array.isArray(seenF))seenF={};
  if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))receipts={};
  let flushTimer=null;
  function scheduleAuxFlush(){
    if(db||flushTimer)return;
    flushTimer=setTimeout(()=>{flushTimer=null;try{atomicWrite(seenQFile,seenQ);atomicWrite(seenFFile,seenF);atomicWrite(receiptFile,receipts)}catch(e){console.warn('[storage] aux flush failed:',e.message)}},750);
    flushTimer.unref?.();
  }
  function pruneMapObject(obj,cutoff,maxPerSession=5000){
    for(const sid of Object.keys(obj)){
      const rows=Object.entries(obj[sid]||{}).filter(([,at])=>Date.parse(at)>=cutoff).sort((a,b)=>Date.parse(b[1])-Date.parse(a[1])).slice(0,maxPerSession);
      if(rows.length)obj[sid]=Object.fromEntries(rows);else delete obj[sid];
    }
  }

  function event(roomCode,eventType,payload){
    if(db){try{db.prepare('INSERT INTO game_events(room_code,event_type,payload,created_at) VALUES(?,?,?,?)').run(String(roomCode||''),String(eventType||''),JSON.stringify(payload??{}),new Date().toISOString())}catch(e){console.warn('[storage] event write failed:',e.message)};return}
    const row=JSON.stringify({roomCode:String(roomCode||''),eventType:String(eventType||''),payload:payload??{},createdAt:new Date().toISOString()})+'\n';
    fs.appendFile(eventFile,row,()=>{});
  }
  function seenQuestionIds(sessionIds,days=180){
    if(db){const cutoff=new Date(Date.now()-Math.max(1,days)*86400000).toISOString(),stmt=db.prepare('SELECT question_id FROM player_seen_questions WHERE session_id=? AND seen_at>=?'),out=new Set();for(const sid of sessionIds||[])for(const r of stmt.all(String(sid),cutoff))out.add(r.question_id);return out}
    const cutoff=Date.now()-Math.max(1,days)*86400000,out=new Set();for(const sid of sessionIds||[])for(const [id,at] of Object.entries(seenQ[String(sid)]||{}))if(Date.parse(at)>=cutoff)out.add(id);return out;
  }
  function seenFactKeys(sessionIds,days=180){
    if(db){const cutoff=new Date(Date.now()-Math.max(1,days)*86400000).toISOString(),stmt=db.prepare('SELECT fact_key FROM player_seen_facts WHERE session_id=? AND seen_at>=?'),out=new Set();for(const sid of sessionIds||[])for(const r of stmt.all(String(sid),cutoff))out.add(r.fact_key);return out}
    const cutoff=Date.now()-Math.max(1,days)*86400000,out=new Set();for(const sid of sessionIds||[])for(const [id,at] of Object.entries(seenF[String(sid)]||{}))if(Date.parse(at)>=cutoff)out.add(id);return out;
  }
  function markFacts(sessionIds,factKeys){
    if(db){const ins=db.prepare('INSERT INTO player_seen_facts(session_id,fact_key,seen_at) VALUES(?,?,?) ON CONFLICT(session_id,fact_key) DO UPDATE SET seen_at=excluded.seen_at'),now=new Date().toISOString();db.transaction(()=>{for(const sid of sessionIds||[])for(const k of factKeys||[])if(k)ins.run(String(sid),String(k),now)})();return}
    const now=new Date().toISOString();for(const sid of sessionIds||[]){const k=String(sid),m=seenF[k]||(seenF[k]={});for(const f of factKeys||[])if(f)m[String(f)]=now}pruneMapObject(seenF,Date.now()-365*86400000);scheduleAuxFlush();
  }
  function markSeen(sessionIds,questionIds){
    if(db){const ins=db.prepare('INSERT INTO player_seen_questions(session_id,question_id,seen_at) VALUES(?,?,?) ON CONFLICT(session_id,question_id) DO UPDATE SET seen_at=excluded.seen_at'),now=new Date().toISOString();db.transaction(()=>{for(const sid of sessionIds||[])for(const qid of questionIds||[])ins.run(String(sid),String(qid),now)})();return}
    const now=new Date().toISOString();for(const sid of sessionIds||[]){const k=String(sid),m=seenQ[k]||(seenQ[k]={});for(const qid of questionIds||[])if(qid)m[String(qid)]=now}pruneMapObject(seenQ,Date.now()-365*86400000);scheduleAuxFlush();
  }
  function recordReceipt(roomCode,questionId,sessionId,submissionId){
    if(db){try{db.prepare('INSERT INTO answer_receipts(room_code,question_id,session_id,submission_id,received_at) VALUES(?,?,?,?,?)').run(String(roomCode),String(questionId),String(sessionId),String(submissionId||''),new Date().toISOString());return {ok:true,duplicate:false}}catch(e){if(String(e.code||'').includes('CONSTRAINT'))return {ok:true,duplicate:true};throw e}}
    const key=[roomCode,questionId,sessionId].map(String).join('|');if(receipts[key])return {ok:true,duplicate:true};receipts[key]={submissionId:String(submissionId||''),receivedAt:new Date().toISOString()};scheduleAuxFlush();return {ok:true,duplicate:false};
  }
  function cleanupReceipts(hours=24){
    if(db)return db.prepare('DELETE FROM answer_receipts WHERE received_at<?').run(new Date(Date.now()-Math.max(1,hours)*3600000).toISOString()).changes;
    const cutoff=Date.now()-Math.max(1,hours)*3600000;let n=0;for(const [k,v] of Object.entries(receipts)){if(Date.parse(v.receivedAt||0)<cutoff){delete receipts[k];n++}}if(n)scheduleAuxFlush();return n;
  }
  function status(){return {engine:db?'sqlite':'json-safe',database:db?dbFile:null,wal:!!db,schemaVersion:db?Number(db.prepare('SELECT MAX(version) v FROM schema_migrations').get()?.v||0):0,mode}}
  function close(){try{if(flushTimer){clearTimeout(flushTimer);flushTimer=null}if(!db){atomicWrite(seenQFile,seenQ);atomicWrite(seenFFile,seenF);atomicWrite(receiptFile,receipts)}db?.close()}catch{}}
  return {readJson,writeJson,event,seenQuestionIds,seenFactKeys,markSeen,markFacts,recordReceipt,cleanupReceipts,status,close,dbFile};
}
module.exports={createStorage};
