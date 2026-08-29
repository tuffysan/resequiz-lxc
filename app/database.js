'use strict';
const path=require('path');
let DatabaseSync;
try{({DatabaseSync}=require('node:sqlite'))}catch{}

function columns(db,table){try{return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>String(x.name)))}catch{return new Set()}}
function ensureColumn(db,table,name,definition){if(columns(db,table).has(name))return false;db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);return true}
function ensureSchemaInfo(db){db.exec('CREATE TABLE IF NOT EXISTS schema_info(version INTEGER NOT NULL)');const row=db.prepare('SELECT COUNT(*) n FROM schema_info').get();if(!row.n)db.prepare('INSERT INTO schema_info(version) VALUES(?)').run(2400);else db.prepare('UPDATE schema_info SET version=?').run(2400)}

function migrate(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS result_index(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,category TEXT,difficulty TEXT,score REAL,total REAL,played_at TEXT);
    CREATE TABLE IF NOT EXISTS question_metrics(question_id TEXT PRIMARY KEY,times_shown INTEGER NOT NULL DEFAULT 0,times_correct INTEGER NOT NULL DEFAULT 0,reported INTEGER NOT NULL DEFAULT 0,last_seen TEXT);
    CREATE TABLE IF NOT EXISTS question_history(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,question_id TEXT,category TEXT,correct INTEGER NOT NULL,answer_index INTEGER,response_ms INTEGER,played_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS achievements(user_id TEXT NOT NULL,badge_id TEXT NOT NULL,earned_at TEXT NOT NULL,PRIMARY KEY(user_id,badge_id));
    CREATE TABLE IF NOT EXISTS daily_attempts(user_id TEXT NOT NULL,day_key TEXT NOT NULL,result_id TEXT NOT NULL,score REAL,total REAL,played_at TEXT NOT NULL,PRIMARY KEY(user_id,day_key));
    CREATE TABLE IF NOT EXISTS duel_index(id TEXT PRIMARY KEY,creator_user_id TEXT,category TEXT,difficulty TEXT,format TEXT,created_at TEXT,status TEXT);
    CREATE TABLE IF NOT EXISTS league_points(user_id TEXT NOT NULL,week_key TEXT NOT NULL,xp INTEGER NOT NULL DEFAULT 0,games INTEGER NOT NULL DEFAULT 0,updated_at TEXT,PRIMARY KEY(user_id,week_key));
    CREATE TABLE IF NOT EXISTS review_schedule(
      user_id TEXT NOT NULL, fact_key TEXT NOT NULL, question_id TEXT, category TEXT,
      interval_days REAL NOT NULL DEFAULT 0, ease REAL NOT NULL DEFAULT 2.3,
      correct_streak INTEGER NOT NULL DEFAULT 0, last_result INTEGER,
      last_seen TEXT, due_at TEXT, PRIMARY KEY(user_id,fact_key)
    );
  `);
  for(const [name,def] of [['mode','TEXT'],['format','TEXT'],['user_id','TEXT'],['name','TEXT'],['category','TEXT'],['difficulty','TEXT'],['score','REAL'],['total','REAL'],['played_at','TEXT']])ensureColumn(db,'result_index',name,def);
  ensureColumn(db,'question_metrics','total_response_ms','INTEGER NOT NULL DEFAULT 0');
  for(let i=0;i<6;i++)ensureColumn(db,'question_metrics',`answer_${i}`,'INTEGER NOT NULL DEFAULT 0');
  for(const [name,def] of [['times_shown','INTEGER NOT NULL DEFAULT 0'],['times_correct','INTEGER NOT NULL DEFAULT 0'],['reported','INTEGER NOT NULL DEFAULT 0'],['last_seen','TEXT']])ensureColumn(db,'question_metrics',name,def);
  // Future-proof partially created review tables.
  for(const [name,def] of [['question_id','TEXT'],['category','TEXT'],['interval_days','REAL NOT NULL DEFAULT 0'],['ease','REAL NOT NULL DEFAULT 2.3'],['correct_streak','INTEGER NOT NULL DEFAULT 0'],['last_result','INTEGER'],['last_seen','TEXT'],['due_at','TEXT']])ensureColumn(db,'review_schedule',name,def);
  db.exec(`
    CREATE INDEX IF NOT EXISTS ix_result_user ON result_index(user_id);
    CREATE INDEX IF NOT EXISTS ix_result_category ON result_index(category);
    CREATE INDEX IF NOT EXISTS ix_result_mode ON result_index(mode);
    CREATE INDEX IF NOT EXISTS ix_history_user ON question_history(user_id,played_at);
    CREATE INDEX IF NOT EXISTS ix_history_question ON question_history(question_id,played_at);
    CREATE INDEX IF NOT EXISTS ix_league_week ON league_points(week_key,xp DESC);
    CREATE INDEX IF NOT EXISTS ix_review_due ON review_schedule(user_id,due_at);
    CREATE INDEX IF NOT EXISTS ix_review_category ON review_schedule(user_id,category,due_at);
  `);
  ensureSchemaInfo(db);
}
function openQuizDb(dataDir){if(!DatabaseSync)return null;const db=new DatabaseSync(path.join(dataDir,'quiz.db'));try{db.exec('PRAGMA foreign_keys=ON');try{db.exec('PRAGMA journal_mode=WAL')}catch{};migrate(db);return db}catch(err){try{db.close()}catch{};throw err}}
function indexResults(db,rows){if(!db)return;const st=db.prepare('INSERT OR REPLACE INTO result_index(id,user_id,name,mode,category,difficulty,format,score,total,played_at) VALUES(?,?,?,?,?,?,?,?,?,?)');for(const r of rows)st.run(r.id||'',r.userId||null,r.name||'',r.mode||'',r.category||'',r.difficulty||'',r.format||'',Number(r.score)||0,Number(r.total)||1,r.at||'')}
module.exports={openQuizDb,indexResults,migrate,columns};
