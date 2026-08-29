'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { readJson, writeJsonAtomic, ensureDir } = require('./storage');

const VERSION='19.1.0';
const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||'0.0.0.0';
const DATA_DIR=process.env.RESEQUIZ_DATA_DIR||path.join(__dirname,'data');
const PUBLIC_DIR=path.join(__dirname,'public');
const QUESTIONS_FILE=path.join(DATA_DIR,'questions.json');
const RESULTS_FILE=path.join(DATA_DIR,'results.json');
const SETTINGS_FILE=path.join(DATA_DIR,'settings.json');
const ADMIN_TOKEN=(process.env.RESEQUIZ_ADMIN_TOKEN||'').trim();
ensureDir(DATA_DIR);

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:false}});
app.use(express.json({limit:'1mb'}));
app.use(express.static(PUBLIC_DIR,{maxAge:'5m',etag:true}));

const rooms=new Map();
const safe=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,40);
const questions=()=>readJson(QUESTIONS_FILE,[]);
const results=()=>readJson(RESULTS_FILE,[]);
const settings=()=>readJson(SETTINGS_FILE,{title:'Resequiz',defaultQuestionCount:10,defaultSeconds:30,allowGuestAdmin:true});
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const roomCode=()=>{for(let i=0;i<100;i++){const c=String(Math.floor(1000+Math.random()*9000));if(!rooms.has(c))return c}throw new Error('room code unavailable')};
const publicQuestion=q=>({id:q.id,category:q.category,difficulty:q.difficulty,question:q.question,answers:q.answers});
const publicRoom=r=>({code:r.code,phase:r.phase,hostId:r.hostId,questionIndex:r.questionIndex,total:r.quiz.length,seconds:r.seconds,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,answered:p.answered}))});
const adminAllowed=req=>!ADMIN_TOKEN || req.headers.authorization===`Bearer ${ADMIN_TOKEN}` || settings().allowGuestAdmin===true;

app.get('/health',(req,res)=>res.json({ok:true,version:VERSION,rooms:rooms.size,questions:questions().length}));
app.get('/api/meta',(req,res)=>{const qs=questions();res.json({version:VERSION,categories:[...new Set(qs.map(q=>q.category))].sort(),questionCount:qs.length,settings:settings()})});
app.get('/api/questions',(req,res)=>{
  let qs=questions();
  if(req.query.category) qs=qs.filter(q=>q.category===req.query.category);
  res.json(qs.map(publicQuestion));
});
app.post('/api/solo/start',(req,res)=>{
  const body=req.body||{}, count=Math.min(50,Math.max(1,Number(body.count)||settings().defaultQuestionCount||10));
  let qs=questions(); if(body.category) qs=qs.filter(q=>q.category===body.category);
  res.json({ok:true,questions:shuffle(qs).slice(0,count).map(publicQuestion)});
});
app.post('/api/solo/check',(req,res)=>{
  const q=questions().find(x=>x.id===req.body?.questionId); if(!q)return res.status(404).json({ok:false,error:'Frågan finns inte'});
  const selected=Number(req.body?.answerIndex);
  res.json({ok:true,correct:selected===q.correct,correctIndex:q.correct,explanation:q.explanation||''});
});
app.get('/api/results',(req,res)=>res.json(results().slice(-100).reverse()));
app.post('/api/results',(req,res)=>{
  const b=req.body||{}; const item={id:crypto.randomUUID(),name:safe(b.name)||'Gäst',score:Math.max(0,Number(b.score)||0),total:Math.max(1,Number(b.total)||1),mode:safe(b.mode)||'solo',at:new Date().toISOString()};
  const all=results(); all.push(item); writeJsonAtomic(RESULTS_FILE,all.slice(-5000)); res.status(201).json({ok:true,result:item});
});
app.get('/api/stats',(req,res)=>{const rs=results();const played=rs.length,avg=played?rs.reduce((a,r)=>a+(r.score/r.total),0)/played:0,best=played?Math.max(...rs.map(r=>r.score/r.total)):0;res.json({played,average:Math.round(avg*100),best:Math.round(best*100),questions:questions().length})});

app.get('/api/admin/questions',(req,res)=>{if(!adminAllowed(req))return res.sendStatus(401);res.json(questions())});
app.post('/api/admin/questions',(req,res)=>{
  if(!adminAllowed(req))return res.sendStatus(401); const b=req.body||{};
  if(!b.question||!Array.isArray(b.answers)||b.answers.length<2||!Number.isInteger(Number(b.correct))) return res.status(400).json({ok:false,error:'Ogiltig fråga'});
  const qs=questions(); const item={id:b.id||crypto.randomUUID(),category:safe(b.category)||'Övrigt',difficulty:['easy','medium','hard'].includes(b.difficulty)?b.difficulty:'medium',question:safe(b.question).slice(0,250),answers:b.answers.map(x=>safe(x).slice(0,120)).slice(0,6),correct:Number(b.correct),explanation:safe(b.explanation).slice(0,300)};
  if(item.correct<0||item.correct>=item.answers.length)return res.status(400).json({ok:false,error:'Fel rätt svar-index'});
  const idx=qs.findIndex(q=>q.id===item.id); if(idx>=0)qs[idx]=item;else qs.push(item);writeJsonAtomic(QUESTIONS_FILE,qs);res.status(idx>=0?200:201).json({ok:true,question:item});
});
app.delete('/api/admin/questions/:id',(req,res)=>{if(!adminAllowed(req))return res.sendStatus(401);const qs=questions(),next=qs.filter(q=>q.id!==req.params.id);if(next.length===qs.length)return res.sendStatus(404);writeJsonAtomic(QUESTIONS_FILE,next);res.json({ok:true})});

io.on('connection',socket=>{
  socket.on('room:create',(payload={},ack=()=>{})=>{
    try{
      const code=roomCode(), host={id:socket.id,name:safe(payload.name)||'Värd',avatar:safe(payload.avatar)||'🌍',score:0,answered:false};
      const count=Math.min(40,Math.max(3,Number(payload.count)||10));let qs=questions();if(payload.category)qs=qs.filter(q=>q.category===payload.category);
      const r={code,hostId:socket.id,phase:'lobby',questionIndex:-1,seconds:Math.min(90,Math.max(10,Number(payload.seconds)||30)),quiz:shuffle(qs).slice(0,count),players:new Map([[socket.id,host]]),answers:new Map(),timer:null,deadline:null};rooms.set(code,r);socket.join(code);ack({ok:true,room:publicRoom(r)});io.to(code).emit('room:update',publicRoom(r));
    }catch(e){ack({ok:false,error:e.message})}
  });
  socket.on('room:join',(payload={},ack=()=>{})=>{
    const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});if(r.phase==='finished')return ack({ok:false,error:'Quizet är avslutat'});
    r.players.set(socket.id,{id:socket.id,name:safe(payload.name)||'Gäst',avatar:safe(payload.avatar)||'✈️',score:0,answered:false});socket.join(r.code);ack({ok:true,room:publicRoom(r)});io.to(r.code).emit('room:update',publicRoom(r));
  });
  socket.on('room:start',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});if(r.hostId!==socket.id)return ack({ok:false,error:'Bara värden kan starta'});startQuestion(r);ack({ok:true})});
  socket.on('room:answer',(payload={},ack=()=>{})=>{
    const r=rooms.get(String(payload.code||'')),p=r?.players.get(socket.id);if(!r||!p||r.phase!=='question')return ack({ok:false,error:'Ingen aktiv fråga'});if(p.answered)return ack({ok:false,error:'Redan svarat'});
    const q=r.quiz[r.questionIndex], answer=Number(payload.answerIndex), correct=answer===q.correct; p.answered=true; const remaining=Math.max(0,(r.deadline-Date.now())/1000); if(correct)p.score+=100+Math.round(remaining*5);r.answers.set(socket.id,{answer,correct});ack({ok:true});io.to(r.code).emit('room:update',publicRoom(r));
  });
  socket.on('room:next',(payload={},ack=()=>{})=>{const r=rooms.get(String(payload.code||''));if(!r)return ack({ok:false,error:'Rummet finns inte'});if(r.hostId!==socket.id)return ack({ok:false,error:'Bara värden kan fortsätta'});startQuestion(r);ack({ok:true})});
  socket.on('disconnect',()=>{for(const [code,r] of rooms){if(!r.players.has(socket.id))continue;r.players.delete(socket.id);if(r.hostId===socket.id){const first=r.players.values().next().value;if(first)r.hostId=first.id}if(!r.players.size){clearTimeout(r.timer);rooms.delete(code)}else io.to(code).emit('room:update',publicRoom(r));}});
});

function startQuestion(r){
  clearTimeout(r.timer);
  r.questionIndex++;
  if(r.questionIndex>=r.quiz.length){r.phase='finished';io.to(r.code).emit('room:finished',{room:publicRoom(r)});const all=results();for(const p of r.players.values())all.push({id:crypto.randomUUID(),name:p.name,score:p.score,total:r.quiz.length*250,mode:'multiplayer',at:new Date().toISOString()});writeJsonAtomic(RESULTS_FILE,all.slice(-5000));return;}
  r.phase='question';r.answers.clear();for(const p of r.players.values())p.answered=false;r.deadline=Date.now()+r.seconds*1000;const q=r.quiz[r.questionIndex];io.to(r.code).emit('room:question',{room:publicRoom(r),question:publicQuestion(q),deadline:r.deadline});r.timer=setTimeout(()=>reveal(r),r.seconds*1000);
}
function reveal(r){if(r.phase!=='question')return;clearTimeout(r.timer);r.phase='reveal';const q=r.quiz[r.questionIndex];io.to(r.code).emit('room:reveal',{room:publicRoom(r),correctIndex:q.correct,explanation:q.explanation||'',answers:[...r.answers.entries()]});}

server.listen(PORT,HOST,()=>console.log(`Resequiz ${VERSION} listening on http://${HOST}:${PORT}`));
