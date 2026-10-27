import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const path=name=>'src/app/'+name;
const read=name=>readFileSync(path(name),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const compile=source=>ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
}).outputText;

test('screens keep previous snapshots visible while refreshing and never issue serial list reads',()=>{
 const overview=read('pages/dashboard.page.ts');
 const devices=read('pages/devices.page.ts');
 const alerts=read('pages/alerts.page.ts');
 const detail=read('pages/alert-detail.page.ts');
 assert.match(overview,/Promise\.all\(\[/);
 assert.match(overview,/if\(this\.renderedUid!==uid\)/,'Old-account data is cleared only when identity changes');
 assert.match(overview,/if\(this\.loadingPromise\)/);
 assert.match(devices,/Promise\.all\(\[/);
 assert.match(devices,/if\(this\.renderedUid!==uid\)/,'Keep snapshots on same-user reentry');
 assert.match(alerts,/Promise\.all\(\[/);
 assert.match(alerts,/if\(this\.renderedUid!==\(uid\?\?null\)\)/,'Clear only when user identity changes');
 assert.match(detail,/this\.cache\.ensure<Alert>/);
 for(const name of ['dashboard','devices','alerts']){
  const html=read('pages/'+name+'.page.html');
  assert.match(html,/Syncing/);
 }
});

test('Pusher debounces bursts and does not re-fetch on initial connect, but reconciles on reconnect',async()=>{
 let initialized,refreshes=0;
 class AuthService{}
 class Pusher {
  static instances=[];
  constructor(){this.handlers=new Map();this.connection={bind:(name,handler)=>this.handlers.set(name,handler)};
   this.channels=new Map();Pusher.instances.push(this)}
  subscribe(name){
   const o={bind:()=>{}};
   this.channels.set(name,o);return o;
  }
  disconnect(){}
 }
 const auth={profile:()=>({uid:'test-uid'}),token:async()=>null};
 const sources=compile(read('core/realtime.service.ts'));
 const injections=new Map([[AuthService,auth]]);
 const exports={};
 let timerIndex=0;
 const timers=new Map();
 const functions={
  setTimeout:(cb)=>{const id=++timerIndex;timers.set(id,cb);return id},
  clearTimeout:id=>timers.delete(id),
  setInterval:(cb)=>{const id=++timerIndex;timers.set(id,cb);return id},
  clearInterval:id=>timers.delete(id)
 };
 const mocked={
  '@angular/core':{Injectable:()=>clazz=>clazz,inject:key=>injections.get(key),signal:v=>{
   let value=v;const fn=()=>value;fn.set=v=>{value=v};return fn}},
  'pusher-js':{default:Pusher},
  './auth.service':{AuthService},
  '../../environments/environment':{environment:{pusher:{key:'TEST_KEY',cluster:'ap1'},api:'https://example.test'}}
 };
 vm.runInNewContext(sources,{
  exports,require:name=>{if(!(name in mocked))throw Error(name);return mocked[name]},
  ...functions,console
 });
 const service=new exports.RealtimeService();
 service.connect(['a','b'],()=>refreshes++);
 for(let i=0;i<5&&!Pusher.instances.length;i++)await Promise.resolve();
 const client=Pusher.instances[0];
 assert.ok(client);
 client.handlers.get('connected')();
 assert.equal(refreshes,0);
 assert.equal([...timers.values()].length,0,'Initial connected event must not fetch the same REST data twice');
 client.handlers.get('disconnected')();
 client.handlers.get('connected')();
 assert.equal(timers.size,1,'Reconnect burst should schedule only one refresh');
 client.handlers.get('connected')(); // second reconnect before debounce timer runs
 assert.equal(timers.size,1,'Only one queued refresh for burst');
 const callbacks=[...timers.values()];
 timers.clear();callbacks[0]();
 assert.equal(refreshes,1);
 service.disconnect();
 assert.equal(timers.size,0);
});
