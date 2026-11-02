import {GITHUB_CLIENT_ID} from './config.js';
import {commitFile} from './core.js';
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function activate() {
  await chrome.action.disable();
  await chrome.declarativeContent.onPageChanged.removeRules();
  await chrome.declarativeContent.onPageChanged.addRules([{conditions:[new chrome.declarativeContent.PageStateMatcher({pageUrl:{hostEquals:'leetcode.com',schemes:['https']}})],actions:[new chrome.declarativeContent.ShowAction()]}]);
}
chrome.runtime.onInstalled.addListener(activate);
chrome.runtime.onStartup.addListener(activate);
async function github(path, options={}) {
  const {token} = await chrome.storage.local.get('token');
  if (!token) throw new Error('Connect GitHub first.');
  const res = await fetch(`https://api.github.com${path}`,{method:options.method || 'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(options.body?{body:JSON.stringify(options.body)}:{})});
  const data = await res.json();
  if (!res.ok) {const e = new Error(res.status===409 ? 'File changed on GitHub. Review and try again.' : data.message || `GitHub error ${res.status}`);e.status=res.status;throw e;}
  return data;
}
async function oauth(endpoint, data) {
  const res = await fetch(`https://github.com/login/${endpoint}`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});
  if (!res.ok) throw new Error(`GitHub authorization failed (${res.status}).`);
  return res.json();
}
async function startLogin() {
  if (!GITHUB_CLIENT_ID) throw new Error('Set GITHUB_CLIENT_ID in config.js, then reload the extension.');
  const data = await oauth('device/code',{client_id:GITHUB_CLIENT_ID,scope:'public_repo'});
  if (data.error || !data.device_code) throw new Error(data.error_description || data.error || 'Authorization could not start.');
  const auth = {...data,expiresAt:Date.now()+data.expires_in*1000,nextPoll:Date.now()+data.interval*1000};
  await chrome.storage.local.set({auth});
  await chrome.alarms.create('oauth',{when:auth.nextPoll});
  return {user_code:data.user_code};
}
let polling=false;
async function poll() {
  if(polling) return;
  polling=true;
  try {
    const {auth} = await chrome.storage.local.get('auth');
    if(!auth) return;
    if(Date.now()>auth.expiresAt) throw new Error('Authorization expired. Connect again.');
    if(Date.now()<auth.nextPoll) return;
    const data = await oauth('oauth/access_token',{client_id:GITHUB_CLIENT_ID,device_code:auth.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'});
    if(data.access_token) {
      await chrome.storage.local.set({token:data.access_token});
      await chrome.storage.local.remove(['auth','authError']);
      await chrome.alarms.clear('oauth');
      return;
    }
    if(!['authorization_pending','slow_down'].includes(data.error)) throw new Error(data.error_description || data.error || 'Authorization failed.');
    if(data.error==='slow_down') auth.interval+=5;
    auth.nextPoll=Date.now()+Math.max(auth.interval,5)*1000;
    await chrome.storage.local.set({auth});
    await chrome.alarms.create('oauth',{when:auth.nextPoll});
  } catch(e) {
    await chrome.storage.local.set({authError:e.message});
    await chrome.storage.local.remove('auth');
    await chrome.alarms.clear('oauth');
  } finally {polling=false;}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='oauth') poll();});
let uploading=false;
async function handle(msg) {
  if(msg.type==='login') return startLogin();
  if(msg.type==='poll') {await poll();return {};}
  if(msg.type==='disconnect') {await chrome.storage.local.remove(['token','auth']);await chrome.alarms.clear('oauth');return {};}
  if(msg.type==='repos') {
    let all=[];
    for(let page=1;;page++) {const rows=await github(`/user/repos?per_page=100&page=${page}&sort=updated`);all.push(...rows.filter(r=>!r.private && r.permissions?.push && !r.archived));if(rows.length<100)break;}
    return all.map(r=>({name:r.full_name}));
  }
  if(msg.type==='folders') {
    if(!/^[\w.-]+\/[\w.-]+$/.test(msg.repo)) throw new Error('Choose a project.');
    const path=(msg.path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    try { const rows=await github(`/repos/${msg.repo}/contents/${path}`); return Array.isArray(rows)?rows.filter(r=>r.type==='dir').map(r=>({name:r.name,path:r.path})):[]; }
    catch(e) {if(e.status===404)return [];throw e;}
  }
  if(msg.type==='commit') {
    if(uploading) throw new Error('An upload is already running.');
    uploading=true;
    try {
      const {settings} = await chrome.storage.local.get('settings');
      if(!settings?.repo) throw new Error('Choose a project.');
      if(!/^[\w.-]+\/[\w.-]+$/.test(settings.repo)) throw new Error('Invalid project.');
      await chrome.storage.local.set({upload:{state:'working'}});
      const result=await commitFile(github,settings.repo,msg.draft,settings.folder||'');
      await chrome.storage.local.set({upload:{state:'done',...result}});
      return result;
    } catch(e) {await chrome.storage.local.set({upload:{state:'error',error:e.message}});throw e;}
    finally {uploading=false;}
  }
  throw new Error('Unknown request.');
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id) return;
  handle(msg).then(data=>reply({data})).catch(e=>reply({error:e.message}));
  return true;
});
