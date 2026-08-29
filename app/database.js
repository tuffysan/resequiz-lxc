'use strict';
const path=require('path');
let DatabaseSync;
try{({DatabaseSync}=require('node:sqlite'))}catch{}
function openQuizDb(dataDir){
 if(!DatabaseSync)return null;
 const db=new DatabaseSync(path.join(dataDir,'quiz.db'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS schema_info(version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS result_index(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,category TEXT,difficulty TEXT,score REAL,total REAL,played_at TEXT);
 CREATE TABLE IF NOT EXISTS question_metrics(question_id TEXT PRIMARY KEY,times_shown INTEGER NOT NULL DEFAULT 0,times_correct INTEGER NOT NULL DEFAULT 0,reported INTEGER NOT NULL DEFAULT 0,last_seen TEXT);
 CREATE INDEX IF NOT EXISTS ix_result_user ON result_index(user_id);
 CREATE INDEX IF NOT EXISTS ix_result_category ON result_index(category);`);
 if(!db.prepare('SELECT COUNT(*) n FROM schema_info').get().n)db.prepare('INSERT INTO schema_info(version) VALUES(?)').run(20);
 return db;
}
function indexResults(db,rows){if(!db)return;const st=db.prepare('INSERT OR REPLACE INTO result_index(id,user_id,name,category,difficulty,score,total,played_at) VALUES(?,?,?,?,?,?,?,?)');for(const r of rows)st.run(r.id||'',r.userId||null,r.name||'',r.category||'',r.difficulty||'',Number(r.score)||0,Number(r.total)||1,r.at||'')}
module.exports={openQuizDb,indexResults};
