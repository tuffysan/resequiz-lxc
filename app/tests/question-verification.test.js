'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditBank,verificationStatus,isPlayable}=require('../question-verification');

test('verification audit never source-verifies an unsupported trivia question',()=>{
 const q={id:'x',category:'Historia',question:'Vem gjorde något?',answers:['A','B','C','D'],correct:0};
 const a=auditBank([q],{mutate:true});
 assert.equal(q.verified,undefined);
 assert.equal(q.verificationStatus,'needs-review');
 assert.equal(a.counts.needsReview,1);
});

test('verification audit can deterministically verify simple arithmetic',()=>{
 const q={id:'m',category:'Hjärngympa',question:'Vad blir 7 × 8?',answers:['54','56','64','48'],correct:1};
 auditBank([q],{mutate:true});
 assert.equal(q.verified,true);
 assert.equal(verificationStatus(q),'deterministic');
});

test('structurally invalid questions are quarantined and not playable',()=>{
 const q={id:'bad',category:'Test',question:'Trasig?',answers:['A','A'],correct:7};
 auditBank([q],{mutate:true});
 assert.equal(q.quarantined,true);
 assert.equal(verificationStatus(q),'quarantined');
 assert.equal(isPlayable(q),false);
});
