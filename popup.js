import {captureSubmission} from './capture.js';
import {filePath,header,parseTitle} from './core.js';
const $=id=>document.getElementById(id);
const fields=['title','code','approach','message','language','difficulty','url'];
const languages=['cpp','c','python3','python','java','javascript','typescript','golang','go','rust','csharp','ruby','swift','kotlin','scala','php','dart','elixir','erlang','r','sql','mysql','postgresql','mssql','oraclesql','bash','racket'];
for(const language of languages) $('language').add(new Option(language,language));
let active=false, busy=false, pollTimer, browsePath='', persist=Promise.resolve();
async function send(type,extra={}) {const result=await chrome.runtime.sendMessage({type,...extra});if(result.error)throw new Error(result.error);return result.data;}
function status(message,error=false,url) {const node=$('status');node.replaceChildren();node.hidden=!message;node.className=error?'error':'';node.append(document.createTextNode(message||''));if(url && /^https:\/\/github\.com\//.test(url)){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' View file';node.append(link);}}
function draft(){return Object.fromEntries(fields.map(id=>[id,$(id).value]));}
function settings(){return {repo:$('repo').value,folder:$('folder').value};}
function save(){const data={draft:draft(),settings:settings()};persist=persist.then(()=>chrome.storage.local.set(data));return persist;}
function refreshPath(){try{$('path').textContent=filePath(draft(),$('folder').value);$('commit').disabled=!active||busy||!$('repo').value||!$('code').value.trim();}catch{$('path').textContent='';$('commit').disabled=true;}}
function syncHeader(previous) {
  const d=draft();
  try {
    const old=header(previous.title,previous.url,previous.difficulty,previous.language);
    if(d.code.startsWith(old)) $('code').value=header(d.title,d.url,d.difficulty,d.language)+d.code.slice(old.length);
  } catch {}
}
for(const id of fields){$(id).addEventListener('input',()=>{save();refreshPath();});}
for(const id of ['title','language','difficulty','url']) {
  let before;
  $(id).addEventListener('focus',()=>{before=draft();});
  $(id).addEventListener('change',()=>{if(before)syncHeader(before);before=draft();save();refreshPath();});
}
$('folder').addEventListener('input',()=>{save();refreshPath();});
$('repo').addEventListener('change',async()=>{$('folder-browser').hidden=true;await save();refreshPath();});
async function renderAuth(){
  const {token,auth,authError}=await chrome.storage.local.get(['token','auth','authError']);
  $('connect').hidden=!!token;$('editor').hidden=!token;$('login').hidden=!!auth;$('authorization').hidden=!auth;
  if(auth)$('device-code').textContent=auth.user_code;
  if(authError)status(authError,true);
  if(token){clearInterval(pollTimer);await loadRepos();}
  else if(auth&&!pollTimer)pollTimer=setInterval(()=>send('poll').catch(e=>status(e.message,true)),1000);
}
async function loadRepos(){
  try {
    const {settings:s}=await chrome.storage.local.get('settings');
    const repos=await send('repos');$('repo').replaceChildren(new Option('Select project',''));
    for(const repo of repos)$('repo').add(new Option(repo.name,repo.name));
    $('repo').value=s?.repo||'';refreshPath();
  }catch(e){status(e.message,true);}
}
$('login').onclick=async()=>{try{$('login').disabled=true;status('');await chrome.storage.local.remove('authError');await send('login');await renderAuth();}catch(e){status(e.message,true);}finally{$('login').disabled=false;}};
$('open-github').onclick=()=>chrome.tabs.create({url:'https://github.com/login/device'});
$('cancel-login').onclick=async()=>{await send('disconnect');clearInterval(pollTimer);pollTimer=undefined;status('');await renderAuth();};
$('disconnect').onclick=async()=>{await send('disconnect');status('');await renderAuth();};
$('capture').onclick=async()=>{
  try {
    $('capture').disabled=true;status('');
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(new URL(tab.url).hostname!=='leetcode.com')throw new Error('Open leetcode.com.');
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:captureSubmission});
    const data=result.result;if(!data)throw new Error('Capture failed.');
    const code=header(data.title,data.url,data.difficulty,data.language)+data.code;
    for(const id of ['title','url','difficulty','language'])$(id).value=data[id];
    $('code').value=code;$('approach').value='';$('message').value='';await save();refreshPath();
  }catch(e){status(e.message,true);$('manual').open=true;}finally{$('capture').disabled=false;}
};
async function showFolders(){
  const rows=await send('folders',{repo:$('repo').value,path:browsePath});$('folder-list').replaceChildren();
  for(const row of rows){const button=document.createElement('button');button.textContent=row.name+'/';button.onclick=()=>{browsePath=row.path;showFolders().catch(e=>status(e.message,true));};$('folder-list').append(button);}
  $('use-folder').textContent=browsePath?`Use ${browsePath}/`:'Use /';$('parent').disabled=!browsePath;
}
$('browse').onclick=async()=>{try{browsePath='';$('folder-browser').hidden=false;await showFolders();}catch(e){status(e.message,true);}};
$('parent').onclick=()=>{browsePath=browsePath.split('/').slice(0,-1).join('/');showFolders().catch(e=>status(e.message,true));};
$('use-folder').onclick=()=>{$('folder').value=browsePath;$('folder-browser').hidden=true;save();refreshPath();};
$('commit').onclick=async()=>{
  busy=true;refreshPath();status('Committing…');
  try{parseTitle($('title').value);await save();const result=await send('commit',{draft:draft()});status(result.unchanged?'No changes.':'Committed.',false,result.url);}
  catch(e){status(e.message,true);}finally{busy=false;refreshPath();}
};
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local')return;
  if(changes.token||changes.auth||changes.authError)renderAuth();
  if(changes.upload){const u=changes.upload.newValue;if(u?.state==='done')status(u.unchanged?'No changes.':'Committed.',false,u.url);if(u?.state==='error')status(u.error,true);}
});
async function init(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  active=!!tab?.url && new URL(tab.url).hostname==='leetcode.com';
  if(!active){document.body.replaceChildren();return;}
  const stored=await chrome.storage.local.get(['draft','settings','upload']);
  for(const id of fields)if(stored.draft?.[id]!==undefined)$(id).value=stored.draft[id];
  $('folder').value=stored.settings?.folder??'problems';
  await renderAuth();refreshPath();
  if(stored.upload?.state==='done')status(stored.upload.unchanged?'No changes.':'Committed.',false,stored.upload.url);
  if(stored.upload?.state==='error')status(stored.upload.error,true);
}
init().catch(e=>status(e.message,true));
