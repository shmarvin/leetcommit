import {test} from 'node:test';
import assert from 'node:assert/strict';

async function background() {
  const state={auth:{device_code:'cancelled-device',expiresAt:Date.now()+60000,nextPoll:0,interval:5}};
  const alarms=new Map([['oauth',{}]]);
  let listener;
  const noop=()=>{};
  globalThis.chrome={
    storage:{local:{
      setAccessLevel:noop,
      get:async key=>structuredClone({[key]:state[key]}),
      set:async data=>Object.assign(state,structuredClone(data)),
      remove:async keys=>{for(const key of [keys].flat()) delete state[key];}
    }},
    alarms:{create:async(name,value)=>{alarms.set(name,value);},clear:async name=>alarms.delete(name),onAlarm:{addListener:noop}},
    runtime:{id:'test-extension',onInstalled:{addListener:noop},onStartup:{addListener:noop},onMessage:{addListener:fn=>{listener=fn;}}}
  };
  await import(`../background.js?test=${background.counter++}`);
  const send=type=>new Promise(resolve=>listener({type},{id:'test-extension'},resolve));
  let finish,started;
  const requested=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=()=>{started();return new Promise(resolve=>{finish=resolve;});};
  return {state,alarms,send,requested,respond:data=>finish({ok:true,json:async()=>data})};
}
background.counter=0;

for(const response of [{access_token:'late-token'},{error:'authorization_pending'},{error:'slow_down'},{error:'access_denied'}]) {
  test(`disconnect ignores delayed OAuth ${response.error||'success'}`,async()=>{
    const app=await background();
    const pending=app.send('poll');
    await app.requested;
    await app.send('disconnect');
    app.respond(response);
    await pending;
    assert.deepEqual(app.state,{});
    assert.equal(app.alarms.size,0);
  });
}

test('a stale polling response preserves a replacement authorization attempt',async()=>{
  const app=await background();
  const pending=app.send('poll');
  await app.requested;
  await app.send('disconnect');
  const replacement={device_code:'replacement-device',expiresAt:Date.now()+60000,nextPoll:0,interval:5};
  app.state.auth=structuredClone(replacement);
  app.alarms.set('oauth',{when:replacement.nextPoll});
  app.respond({error:'access_denied'});
  await pending;
  assert.deepEqual(app.state,{auth:replacement});
  assert.equal(app.alarms.size,1);
});

test('current polling results still connect and clear authorization',async()=>{
  const app=await background();
  const pending=app.send('poll');
  await app.requested;
  app.respond({access_token:'current-token'});
  await pending;
  assert.deepEqual(app.state,{token:'current-token'});
  assert.equal(app.alarms.size,0);
});
