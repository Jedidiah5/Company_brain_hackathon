import test from 'node:test';
import assert from 'node:assert/strict';
import { actionable,rank,readWorkspace,safeUrl } from '../lib/leads.ts';
import type { Lead } from '../lib/types.ts';
const lead=(id:string,intent:number,total:number,disqualified=false)=>({id,scores:{intent,fit:5,urgency:5,total},disqualified}) as Lead;
test('disqualified or low intent rows never qualify for a draft',()=>{assert.equal(actionable(lead('a',9,24,true)),false);assert.equal(actionable(lead('b',5,20)),false);assert.equal(actionable(lead('c',6,18)),true);});
test('intent ranks before total without mutating source',()=>{const input=[lead('low',3,23),lead('high',8,18),lead('tie',8,22)];assert.deepEqual(rank(input).map(l=>l.id),['tie','high','low']);assert.equal(input[0].id,'low');});
test('invalid browser state cannot break workspace',()=>{assert.deepEqual(readWorkspace('not json'),{claims:{},drafts:{},operator:''});assert.deepEqual(readWorkspace('{"claims":{"a":{"status":"unexpected"}},"drafts":{"a":42}}').claims,{});const v=readWorkspace('{"operator":"Ada","claims":{"x":{"claimed_by":"Ada","status":"contacted","notes":"follow up"}}}');assert.equal(v.claims.x.status,'contacted');assert.equal(v.operator,'Ada');});
test('source links only use web protocols',()=>{assert.equal(safeUrl('javascript:alert(1)'),undefined);assert.equal(safeUrl('https://news.ycombinator.com/item?id=1'),'https://news.ycombinator.com/item?id=1');});
