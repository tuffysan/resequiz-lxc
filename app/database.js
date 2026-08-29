'use strict';
const path=require('path');
let DatabaseSync;
try{({DatabaseSync}=require('node:sqlite'))}catch{}

function columns(db,table){
  try{return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>String(x.name)))}catch{return new Set()}
}
function ensureColumn(db,table,name,definition){
  const cols=columns(db,table);
  if(cols.has(name))return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  return true;
}
function ensureSchemaInfo(db){
  db.exec('CREATE TABLE IF NOT EXISTS schema_info(version INTEGER NOT NULL)');
  const row=db.prepare('SELECT COUNT(*) n FROM schema_info').get();
  if(!row.n)db.prepare('INSERT INTO schema_info(version) VALUES(?)').run(2211);
  else db.prepare('UPDATE schema_info SET version=?').run(2211);
}

function migrate(db){
  // IMPORTANT: only create base tables first. Existing Quiz databases may have
  // older versions of these tables without mode/format/analytics columns.
  // Columns are added before any index or query refers to them.
  db.exec(`
    CREATE TABLE IF NOT EXISTS result_index(
      id TEXT PRIMARY KEY,user_id TEXT,name TEXT,category TEXT,difficulty TEXT,
      score REAL,total REAL,played_at TEXT
    );
    CREATE TABLE IF NOT EXISTS question_metrics(
      question_id TEXT PRIMARY KEY,
      times_shown INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0,
      reported INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT
    );
    CREATE TABLE IF NOT EXISTS question_history(
      id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,question_id TEXT,
      category TEXT,correct INTEGER NOT NULL,answer_index INTEGER,
      response_ms INTEGER,played_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS achievements(
      user_id TEXT NOT NULL,badge_id TEXT NOT NULL,earned_at TEXT NOT NULL,
      PRIMARY KEY(user_id,badge_id)
    );
    CREATE TABLE IF NOT EXISTS daily_attempts(
      user_id TEXT NOT NULL,day_key TEXT NOT NULL,result_id TEXT NOT NULL,
      score REAL,total REAL,played_at TEXT NOT NULL,
      PRIMARY KEY(user_id,day_key)
    );
    CREATE TABLE IF NOT EXISTS duel_index(
      id TEXT PRIMARY KEY,creator_user_id TEXT,category TEXT,difficulty TEXT,
      format TEXT,created_at TEXT,status TEXT
    );
  `);

  // Upgrade legacy tables before indexes/statements use new columns.
  ensureColumn(db,'result_index','mode','TEXT');
  ensureColumn(db,'result_index','format','TEXT');
  ensureColumn(db,'question_metrics','total_response_ms','INTEGER NOT NULL DEFAULT 0');
  for(let i=0;i<6;i++)ensureColumn(db,'question_metrics',`answer_${i}`,'INTEGER NOT NULL DEFAULT 0');

  // Older experimental builds may have partially-created tables. Ensure every
  // field needed by the current server is present, without dropping user data.
  ensureColumn(db,'result_index','user_id','TEXT');
  ensureColumn(db,'result_index','name','TEXT');
  ensureColumn(db,'result_index','category','TEXT');
  ensureColumn(db,'result_index','difficulty','TEXT');
  ensureColumn(db,'result_index','score','REAL');
  ensureColumn(db,'result_index','total','REAL');
  ensureColumn(db,'result_index','played_at','TEXT');
  ensureColumn(db,'question_metrics','times_shown','INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db,'question_metrics','times_correct','INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db,'question_metrics','reported','INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db,'question_metrics','last_seen','TEXT');

  // Indexes are deliberately LAST. This fixes the 22.0/22.1 startup crash
  // "no such column: mode" on databases created by older Quiz versions.
  db.exec(`
    CREATE INDEX IF NOT EXISTS ix_result_user ON result_index(user_id);
    CREATE INDEX IF NOT EXISTS ix_result_category ON result_index(category);
    CREATE INDEX IF NOT EXISTS ix_result_mode ON result_index(mode);
    CREATE INDEX IF NOT EXISTS ix_history_user ON question_history(user_id,played_at);
    CREATE INDEX IF NOT EXISTS ix_history_question ON question_history(question_id,played_at);
  `);
  ensureSchemaInfo(db);
}

function openQuizDb(dataDir){
  if(!DatabaseSync)return null;
  const db=new DatabaseSync(path.join(dataDir,'quiz.db'));
  try{
    db.exec('PRAGMA foreign_keys=ON');
    // journal_mode can return a row and must not be mixed with schema migration.
    // Run it independently and tolerate filesystems where WAL is unavailable.
    try{db.exec('PRAGMA journal_mode=WAL')}catch{}
    migrate(db);
    return db;
  }catch(err){
    try{db.close()}catch{}
    throw err;
  }
}
function indexResults(db,rows){
  if(!db)return;
  const st=db.prepare('INSERT OR REPLACE INTO result_index(id,user_id,name,mode,category,difficulty,format,score,total,played_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const r of rows)st.run(r.id||'',r.userId||null,r.name||'',r.mode||'',r.category||'',r.difficulty||'',r.format||'',Number(r.score)||0,Number(r.total)||1,r.at||'');
}
module.exports={openQuizDb,indexResults,migrate};
