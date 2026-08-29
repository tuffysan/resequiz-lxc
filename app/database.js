'use strict';
const path=require('path');
let DatabaseSync;
try{({DatabaseSync}=require('node:sqlite'))}catch{}
function openQuizDb(dataDir){
 if(!DatabaseSync)return null;
 const db=new DatabaseSync(path.join(dataDir,'quiz.db'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS schema_info(version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS result_index(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,mode TEXT,category TEXT,difficulty TEXT,format TEXT,score REAL,total REAL,played_at TEXT);
 CREATE TABLE IF NOT EXISTS question_metrics(question_id TEXT PRIMARY KEY,times_shown INTEGER NOT NULL DEFAULT 0,times_correct INTEGER NOT NULL DEFAULT 0,reported INTEGER NOT NULL DEFAULT 0,total_response_ms INTEGER NOT NULL DEFAULT 0,last_seen TEXT);
 CREATE TABLE IF NOT EXISTS question_history(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,question_id TEXT,category TEXT,correct INTEGER NOT NULL,answer_index INTEGER,response_ms INTEGER,played_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS achievements(user_id TEXT NOT NULL,badge_id TEXT NOT NULL,earned_at TEXT NOT NULL,PRIMARY KEY(user_id,badge_id));
 CREATE TABLE IF NOT EXISTS daily_attempts(user_id TEXT NOT NULL,day_key TEXT NOT NULL,result_id TEXT NOT NULL,score REAL,total REAL,played_at TEXT NOT NULL,PRIMARY KEY(user_id,day_key));
 CREATE TABLE IF NOT EXISTS duel_index(id TEXT PRIMARY KEY,creator_user_id TEXT,category TEXT,difficulty TEXT,format TEXT,created_at TEXT,status TEXT);
 CREATE INDEX IF NOT EXISTS ix_result_user ON result_index(user_id);
 CREATE INDEX IF NOT EXISTS ix_result_category ON result_index(category);
 CREATE INDEX IF NOT EXISTS ix_result_mode ON result_index(mode);
 CREATE INDEX IF NOT EXISTS ix_history_user ON question_history(user_id,played_at);
 CREATE INDEX IF NOT EXISTS ix_history_question ON question_history(question_id,played_at);`);
 const cols=db.prepare(`PRAGMA table_info(result_index)`).all().map(x=>x.name);
 for(const [name,type] of [['mode','TEXT'],['format','TEXT']])if(!cols.includes(name))try{db.exec(`ALTER TABLE result_index ADD COLUMN ${name} ${type}`)}catch{}
 const qm=db.prepare(`PRAGMA table_info(question_metrics)`).all().map(x=>x.name);
 if(!qm.includes('total_response_ms'))try{db.exec('ALTER TABLE question_metrics ADD COLUMN total_response_ms INTEGER NOT NULL DEFAULT 0')}catch{}
 const row=db.prepare('SELECT COUNT(*) n FROM schema_info').get();
 if(!row.n)db.prepare('INSERT INTO schema_info(version) VALUES(?)').run(22);else db.prepare('UPDATE schema_info SET version=?').run(22);
 return db;
}
function indexResults(db,rows){if(!db)return;const st=db.prepare('INSERT OR REPLACE INTO result_index(id,user_id,name,mode,category,difficulty,format,score,total,played_at) VALUES(?,?,?,?,?,?,?,?,?,?)');for(const r of rows)st.run(r.id||'',r.userId||null,r.name||'',r.mode||'',r.category||'',r.difficulty||'',r.format||'',Number(r.score)||0,Number(r.total)||1,r.at||'')}
module.exports={openQuizDb,indexResults};
