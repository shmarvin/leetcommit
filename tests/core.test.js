import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filePath,header,languageInfo,encodeContent,decodeContent,commitFile} from '../core.js';
const draft={title:'1. Two Sum',language:'cpp',code:'// 你好\nclass Solution {};',approach:'',message:''};
test('filenames, approach, padding, paths',()=>{
 assert.equal(filePath(draft,'problems/'),'problems/0001-two-sum.cpp');
 assert.equal(filePath({...draft,approach:'Hash Map'}),'0001-two-sum-hash-map.cpp');
 assert.equal(filePath({...draft,title:'12345. Test'}),'12345-test.cpp');
 assert.throws(()=>filePath(draft,'../oops'));
 assert.throws(()=>filePath({...draft,title:'oops'}));
});
test('headers and Unicode content round trip',()=>{
 assert.equal(header('1. Two Sum','https://leetcode.com/problems/two-sum/','Easy','python3'),'# 1. Two Sum\n# https://leetcode.com/problems/two-sum/\n# Difficulty: Easy\n\n');
 assert.equal(decodeContent(encodeContent(draft.code)),draft.code);
 assert.equal(languageInfo('golang').extension,'go');assert.throws(()=>languageInfo('unknown'));
});
test('new file uses default branch and custom message',async()=>{
 const calls=[];const api=async(path,opts)=>{calls.push({path,opts});if(path==='/repos/me/lc')return {default_branch:'main'};if(!opts){const e=new Error();e.status=404;throw e;}return {content:{html_url:'https://github.com/me/lc/file'}};};
 await commitFile(api,'me/lc',{...draft,message:'My solution'},'problems');
 const body=calls.at(-1).opts.body;assert.equal(body.message,'My solution');assert.equal(body.branch,'main');assert.equal(decodeContent(body.content),draft.code);assert.equal(body.sha,undefined);
});
test('unchanged code creates no commit',async()=>{
 let writes=0;const api=async(p,o)=>{if(o)writes++;return p==='/repos/me/lc'?{default_branch:'main'}:{type:'file',sha:'old',content:encodeContent(draft.code),html_url:'url'};};
 assert.equal((await commitFile(api,'me/lc',draft,'')).unchanged,true);assert.equal(writes,0);
});
test('updates use current SHA, conflicts propagate',async()=>{
 let body;const api=async(p,o)=>{if(o){body=o.body;throw Object.assign(new Error('conflict'),{status:409});}return p==='/repos/me/lc'?{default_branch:'main'}:{type:'file',sha:'latest',content:encodeContent('old')};};
 await assert.rejects(commitFile(api,'me/lc',draft,''),/conflict/);assert.equal(body.sha,'latest');
});
