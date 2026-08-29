const fs=require('fs');
const path=require('path');
let Database=null;
try{Database=require('better-sqlite3')}catch{}

function createStorage(dataDir){
  fs.mkdirSync(dataDir,{recursive:true});
  const dbFile=path.join(dataDir,'resequiz.db');
  let db=null;
  if(Database){
    db=new Database(dbFile);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS game_events (id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT, event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);`);
    const has=db.prepare('SELECT 1 FROM schema_migrations WHERE version=1').get();
    if(!has) db.prepare('INSERT INTO schema_migrations(version,name,applied_at) VALUES(1,?,?)').run('initial-kv-event-store',new Date().toISOString());
    const has2=db.prepare('SELECT 1 FROM schema_migrations WHERE version=2').get();
    if(!has2) db.prepare('INSERT INTO schema_migrations(version,name,applied_at) VALUES(2,?,?)').run('global-no-repeat',new Date().toISOString());
    db.exec(`CREATE TABLE IF NOT EXISTS player_seen_questions (session_id TEXT NOT NULL, question_id TEXT NOT NULL, seen_at TEXT NOT NULL, PRIMARY KEY(session_id,question_id));
             CREATE TABLE IF NOT EXISTS player_seen_facts (session_id TEXT NOT NULL, fact_key TEXT NOT NULL, seen_at TEXT NOT NULL, PRIMARY KEY(session_id,fact_key));`);
    const has3=db.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get();
    if(!has3) db.prepare('INSERT INTO schema_migrations(version,name,applied_at) VALUES(3,?,?)').run('semantic-no-repeat-facts',new Date().toISOString());
    db.exec(`CREATE TABLE IF NOT EXISTS answer_receipts (room_code TEXT NOT NULL, question_id TEXT NOT NULL, session_id TEXT NOT NULL, submission_id TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY(room_code,question_id,session_id));
             CREATE INDEX IF NOT EXISTS idx_answer_receipts_submission ON answer_receipts(submission_id);`);
    const has4=db.prepare('SELECT 1 FROM schema_migrations WHERE version=4').get();
    if(!has4) db.prepare('INSERT INTO schema_migrations(version,name,applied_at) VALUES(4,?,?)').run('question-health-and-idempotency',new Date().toISOString());
  }
  const keyFor=f=>path.basename(f);
  function readJson(file,fallback){
    const key=keyFor(file);
    if(db){
      const row=db.prepare('SELECT value FROM kv WHERE key=?').get(key);
      if(row){try{return JSON.parse(row.value)}catch{}}
      try{if(fs.existsSync(file)){const val=JSON.parse(fs.readFileSync(file,'utf8'));writeJson(file,val);return val}}catch{}
      return fallback;
    }
    try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}
  }
  function writeJson(file,data){
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const text=JSON.stringify(data,null,2),tmp=file+'.tmp';
    fs.writeFileSync(tmp,text);fs.renameSync(tmp,file);
    if(db) db.prepare(`INSERT INTO kv(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).run(keyFor(file),JSON.stringify(data),new Date().toISOString());
  }
  function event(roomCode,eventType,payload){if(db)db.prepare('INSERT INTO game_events(room_code,event_type,payload,created_at) VALUES(?,?,?,?)').run(String(roomCode||''),String(eventType||''),JSON.stringify(payload??{}),new Date().toISOString())}
  function seenQuestionIds(sessionIds,days=180){if(!db||!Array.isArray(sessionIds)||!sessionIds.length)return new Set();const cutoff=new Date(Date.now()-Math.max(1,days)*86400000).toISOString(),stmt=db.prepare('SELECT question_id FROM player_seen_questions WHERE session_id=? AND seen_at>=?');const out=new Set();for(const sid of sessionIds)for(const r of stmt.all(String(sid),cutoff))out.add(r.question_id);return out}
  function seenFactKeys(sessionIds,days=180){if(!db||!Array.isArray(sessionIds)||!sessionIds.length)return new Set();const cutoff=new Date(Date.now()-Math.max(1,days)*86400000).toISOString(),stmt=db.prepare('SELECT fact_key FROM player_seen_facts WHERE session_id=? AND seen_at>=?');const out=new Set();for(const sid of sessionIds)for(const r of stmt.all(String(sid),cutoff))out.add(r.fact_key);return out}
  function markFacts(sessionIds,factKeys){if(!db)return;const ins=db.prepare('INSERT INTO player_seen_facts(session_id,fact_key,seen_at) VALUES(?,?,?) ON CONFLICT(session_id,fact_key) DO UPDATE SET seen_at=excluded.seen_at'),now=new Date().toISOString();const tx=db.transaction(()=>{for(const sid of sessionIds||[])for(const k of factKeys||[])if(k)ins.run(String(sid),String(k),now)});tx()}
  function markSeen(sessionIds,questionIds){if(!db)return;const ins=db.prepare('INSERT INTO player_seen_questions(session_id,question_id,seen_at) VALUES(?,?,?) ON CONFLICT(session_id,question_id) DO UPDATE SET seen_at=excluded.seen_at'),now=new Date().toISOString();const tx=db.transaction(()=>{for(const sid of sessionIds||[])for(const qid of questionIds||[])ins.run(String(sid),String(qid),now)});tx()}
  function recordReceipt(roomCode,questionId,sessionId,submissionId){
    if(!db)return {ok:true,duplicate:false};
    try{db.prepare('INSERT INTO answer_receipts(room_code,question_id,session_id,submission_id,received_at) VALUES(?,?,?,?,?)').run(String(roomCode),String(questionId),String(sessionId),String(submissionId||''),new Date().toISOString());return {ok:true,duplicate:false}}catch(e){if(String(e.code||'').includes('CONSTRAINT'))return {ok:true,duplicate:true};throw e}
  }
  function cleanupReceipts(hours=24){if(!db)return 0;const cutoff=new Date(Date.now()-Math.max(1,hours)*3600000).toISOString();return db.prepare('DELETE FROM answer_receipts WHERE received_at<?').run(cutoff).changes}
  function status(){return {engine:db?'sqlite':'json-fallback',database:dbFile,wal:!!db,schemaVersion:db?Number(db.prepare('SELECT MAX(version) v FROM schema_migrations').get()?.v||0):0}}
  function close(){try{db?.close()}catch{}}
  return {readJson,writeJson,event,seenQuestionIds,seenFactKeys,markSeen,markFacts,recordReceipt,cleanupReceipts,status,close,dbFile};
}
module.exports={createStorage};
