import test from 'node:test';
import assert from 'node:assert/strict';
import { hnQueries, normalizeHackerNews } from '../lib/hackernews.ts';
const boolean=['("we\'re hiring" OR "hiring for") AND (founder OR CEO) AND (UK OR London)','("hiring now" OR "need to hire") AND startup AND (founder OR "hiring manager") AND UK'];
const hit={objectID:'49965012',author:'founder_uk',created_at:'2026-10-05T14:00:02Z',story_title:'Ask HN: Who is hiring? (October 2026)',comment_text:'We&#x27;re hiring our first salesperson in London.<p>Any advice on &quot;where to look&quot;?',points:4,num_comments:2};
test('boolean LinkedIn queries become plain Hacker News searches',()=>{
  const queries=hnQueries(boolean);
  assert.ok(queries.length>0&&queries.length<=3);
  for (const query of queries) {
    assert.doesNotMatch(query,/["()]|\b(?:AND|OR|NOT)\b/);
    assert.ok(query.length>=3&&query.length<=120);
    assert.ok(query.split(/\s+/).length<=4,`too narrow: ${query}`);
  }
  assert.ok(queries.includes("we're hiring UK"));
  assert.equal(new Set(queries).size,queries.length);
});
test('a plain refined search survives conversion unchanged in meaning',()=>{
  assert.deepEqual(hnQueries(['first sales hire']),['first sales hire']);
  assert.deepEqual(hnQueries([]),[]);
});
test('Hacker News hits become leads in the frozen schema with readable text',()=>{
  const leads=normalizeHackerNews({hits:[hit,{...hit}]},10,'2026-10-24T12:00:00Z');
  assert.equal(leads.length,1);
  const lead=leads[0];
  assert.equal(lead.source,'hackernews');
  assert.equal(lead.source_url,'https://news.ycombinator.com/item?id=49965012');
  assert.equal(lead.author_handle,'founder_uk');
  assert.equal(lead.author_profile_url,'https://news.ycombinator.com/user?id=founder_uk');
  assert.equal(lead.fetched_at,'2026-10-24T12:00:00Z');
  assert.equal(lead.posted_at,'2026-10-05T14:00:02.000Z');
  assert.match(lead.context,/^Hacker News · Ask HN/);
  assert.equal(lead.body_excerpt,'We\'re hiring our first salesperson in London. Any advice on "where to look"?');
  assert.doesNotMatch(lead.body_excerpt,/[<>]|&#/);
  assert.deepEqual(lead.scores,{intent:0,fit:0,urgency:0,total:0});
  assert.equal(lead.disqualified,false);
  assert.equal(lead.draft_reply,'');
});
test('malformed or empty Hacker News data never enters the dataset',()=>{
  assert.throws(()=>normalizeHackerNews({unexpected:[]}));
  assert.equal(normalizeHackerNews({hits:[{objectID:'1',author:'a',created_at:'2026-01-01T00:00:00Z'}]}).length,0);
  assert.equal(normalizeHackerNews({hits:[{...hit,objectID:'not-an-id'}]}).length,0);
  assert.equal(normalizeHackerNews({hits:[hit,{...hit,objectID:'2'},{...hit,objectID:'3'}]},2).length,2);
});
