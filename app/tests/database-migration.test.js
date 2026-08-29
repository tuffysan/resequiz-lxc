'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
let DatabaseSync;
try{({DatabaseSync}=require('node:sqlite'))}catch{}
const {openQuizDb}=require('../database');

test('upgrades legacy Quiz SQLite schema before creating mode index', {skip:!DatabaseSync}, ()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quiz-db-migration-'));
  const file=path.join(dir,'quiz.db');
  const old=new DatabaseSync(file);
  old.exec(`
    CREATE TABLE result_index(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,category TEXT,difficulty TEXT,score REAL,total REAL,played_at TEXT);
    CREATE TABLE question_metrics(question_id TEXT PRIMARY KEY,times_shown INTEGER NOT NULL DEFAULT 0,times_correct INTEGER NOT NULL DEFAULT 0,reported INTEGER NOT NULL DEFAULT 0,last_seen TEXT);
  `);
  old.prepare('INSERT INTO result_index(id,name,score,total) VALUES(?,?,?,?)').run('legacy-1','Legacy',7,10);
  old.close();

  const db=openQuizDb(dir);
  const resultCols=db.prepare('PRAGMA table_info(result_index)').all().map(x=>x.name);
  const metricCols=db.prepare('PRAGMA table_info(question_metrics)').all().map(x=>x.name);
  assert.ok(resultCols.includes('mode'));
  assert.ok(resultCols.includes('format'));
  assert.ok(metricCols.includes('total_response_ms'));
  assert.ok(metricCols.includes('answer_5'));
  assert.equal(db.prepare('SELECT name FROM result_index WHERE id=?').get('legacy-1').name,'Legacy');
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='ix_result_mode'").get());
  assert.equal(db.prepare('SELECT version FROM schema_info').get().version,2400);
  db.close();
  fs.rmSync(dir,{recursive:true,force:true});
});
