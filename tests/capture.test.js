import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureSubmission} from '../capture.js';
import {filePath,header} from '../core.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('capture fetches the selected submission, not live editor contents',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/submissions/123456/'};
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'/graphql/');assert.equal(JSON.parse(opts.body).variables.submissionId,123456);return {ok:true,json:async()=>({data:{submissionDetails:{code:'submitted code',lang:{name:'cpp'},question:{questionFrontendId:'1',title:'Two Sum',titleSlug:'two-sum',difficulty:'Easy'}}}})};};
 const data=await captureSubmission();assert.equal(data.title,'1. Two Sum');assert.equal(data.code,'submitted code');assert.equal(data.url,'https://leetcode.com/problems/two-sum/');
});
test('problem capture reads the full live editor and fetches only metadata',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/description/'};
 const code='class Solution:\n    # unsaved edit\n    pass\n';
 const model={getValue:()=>code,getLanguageId:()=> 'python',isAttachedToEditor:()=>true};
 globalThis.monaco={editor:{getEditors:()=>[{getDomNode:()=>({isConnected:true,getClientRects:()=>[{}]}),getModel:()=>model}]}};
 globalThis.fetch=async(url,opts)=>{
   const request=JSON.parse(opts.body);
   assert.equal(url,'/graphql/');assert.equal(request.operationName,'questionData');
   assert.deepEqual(request.variables,{titleSlug:'two-sum'});
   return {ok:true,json:async()=>({data:{question:{questionFrontendId:'1',title:'Two Sum',titleSlug:'two-sum',difficulty:'Easy'}}})};
 };
 const data=await captureSubmission();
 assert.deepEqual(data,{title:'1. Two Sum',url:'https://leetcode.com/problems/two-sum/',difficulty:'Easy',language:'python',code});
 delete globalThis.monaco;
});

test('problem capture excludes detached models and testcase models',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/'};
 globalThis.monaco={editor:{getModels:()=>[
   {isAttachedToEditor:()=>false,getLanguageId:()=> 'cpp',getValue:()=> 'stale'},
   {isAttachedToEditor:()=>true,getLanguageId:()=> 'plaintext',getValue:()=> '[1,2]'},
   {isAttachedToEditor:()=>true,getLanguageId:()=> 'cpp',getValue:()=> 'current code'}
 ]}};
 globalThis.fetch=async()=>({ok:true,json:async()=>({data:{question:{questionFrontendId:'1',title:'Two Sum',titleSlug:'two-sum',difficulty:'Easy'}}})});
 assert.equal((await captureSubmission()).code,'current code');
 delete globalThis.monaco;
});

test('problem capture refuses missing, ambiguous, and empty editors',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/'};
 await assert.rejects(captureSubmission(),/Could not identify/);
 const model={isAttachedToEditor:()=>true,getLanguageId:()=> 'cpp',getValue:()=> ''};
 globalThis.monaco={editor:{getModels:()=>[model,model]}};
 await assert.rejects(captureSubmission(),/Could not identify/);
 globalThis.monaco.editor.getModels=()=>[model];
 await assert.rejects(captureSubmission(),/editor is empty/);
 delete globalThis.monaco;
});
test('capture rejects unrelated pages and failed responses',async()=>{
 globalThis.location={hostname:'leetcode.com',pathname:'/problemset/'};
 await assert.rejects(captureSubmission(),/Open a LeetCode problem/);
 globalThis.location.pathname='/submissions/123/';globalThis.fetch=async()=>({ok:true,json:async()=>({errors:[{message:'denied'}]})});
 await assert.rejects(captureSubmission(),/Could not read/);
});

for(const [language,extension] of [['go','go'],['sql','sql']]) {
 test(`captured ${language} remains selectable and produces a commit filename`,async(t)=>{
   globalThis.location={hostname:'leetcode.com',pathname:'/problems/two-sum/'};
   globalThis.monaco={editor:{getModels:()=>[{
     isAttachedToEditor:()=>true,getLanguageId:()=>language,getValue:()=> 'current code'
   }]}};
   t.after(()=>{delete globalThis.monaco;});
   globalThis.fetch=async()=>({ok:true,json:async()=>({data:{question:{questionFrontendId:'1',title:'Two Sum',titleSlug:'two-sum',difficulty:'Easy'}}})});
   const captured=await captureSubmission();
   // Execute the actual popup option initialization without starting its UI.
   const options=[];
   const popup=readFileSync(new URL('../popup.js',import.meta.url),'utf8');
   runInNewContext(popup.slice(popup.indexOf('const $='),popup.indexOf('let active=')),{
     document:{getElementById:()=>({add:option=>options.push(option)})},
     Option:function(label,value){this.value=value;}
   });
   assert.ok(options.some(option=>option.value===captured.language));
   assert.equal(filePath(captured),`0001-two-sum.${extension}`);
   assert.ok(header(captured.title,captured.url,captured.difficulty,captured.language));
 });
}
