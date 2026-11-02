import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureSubmission} from '../capture.js';
test('capture fetches the selected submission, not live editor contents',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/submissions/123456/'};
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'/graphql/');assert.equal(JSON.parse(opts.body).variables.submissionId,123456);return {ok:true,json:async()=>({data:{submissionDetails:{code:'submitted code',lang:{name:'cpp'},question:{questionFrontendId:'1',title:'Two Sum',titleSlug:'two-sum',difficulty:'Easy'}}}})};};
 const data=await captureSubmission();assert.equal(data.title,'1. Two Sum');assert.equal(data.code,'submitted code');assert.equal(data.url,'https://leetcode.com/problems/two-sum/');
});
test('capture rejects pages without a submission and failed responses',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/'};
 await assert.rejects(captureSubmission(),/Open the submission/);
 globalThis.location.pathname='/submissions/123/';globalThis.fetch=async()=>({ok:true,json:async()=>({errors:[{message:'denied'}]})});
 await assert.rejects(captureSubmission(),/Could not read/);
});
