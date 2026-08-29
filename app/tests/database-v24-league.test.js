'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');const {migrate}=require('../database');
test('Quiz 24 creates league schema after safe migration',()=>{const db=new DatabaseSync(':memory:');migrate(db);const cols=db.prepare('PRAGMA table_info(league_points)').all().map(x=>x.name);for(const c of ['user_id','week_key','xp','games','updated_at'])assert.ok(cols.includes(c));assert.equal(db.prepare('SELECT version FROM schema_info').get().version,2400);db.close()});
