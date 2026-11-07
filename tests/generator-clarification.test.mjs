import test from 'node:test';import assert from 'node:assert/strict';
import {parseClarify} from '../dist/generator-core.js';
import {newJob,runJob} from '../dist/generator-engine.js';
const questions=['Output Format','Theme of Beauty','Geographic Location Selection','Time of Day'].map(header=>({header,question:'Which '+header+'?',multiSelect:true,options:[{label:'First',description:'One'},{label:'Second',description:'Two'}]}));
const valid=JSON.stringify({clarify:{questions}}),missing=valid.slice(0,-1);
test('missing final outer brace still opens all four clarification questions',()=>{const parsed=parseClarify(missing);assert.equal(parsed.length,4);assert.equal(parsed[3].header,'Time of Day');assert.equal(parsed[0].multiSelect,true);});
test('truncated option text is never invented',()=>{assert.equal(parseClarify(valid.slice(0,-30)),null);});
test('recoverable clarification is never published as generated text',async()=>{const j=newJob('Generate an image prompt');await runJob(j,async()=>missing);assert.equal(j.status,'clarification');assert.equal(j.clarify.questions.length,4);assert.equal(j.text,undefined);});
test('unrecoverable clarification pauses instead of exposing JSON as result',async()=>{const j=newJob('Generate an image prompt');await runJob(j,async()=>valid.slice(0,-30));assert.equal(j.status,'paused');assert.match(j.error,/incomplete question form/);assert.equal(j.text,undefined);});
