import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=path=>readFileSync('src/app/'+path,'utf8');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function harness(){
 let uid='alice',connections=0,disconnects=0,rendering=false;
 const handlers={};
 class AuthService{} class RealtimeService{};
 const auth={profile:()=>uid?{uid}:null};
 const realtime={
  connect:(ids,cb)=>{connections++;handlers.change=cb;handlers.ids=ids},
  disconnect:()=>{if(rendering)throw new Error('Angular NG0600: Pusher disconnect during template');disconnects++}
 };
 const injected=new Map([[AuthService,auth],[RealtimeService,realtime]]);
 const transpiled=ts.transpileModule(read('core/screen-cache.service.ts'),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true
 }}).outputText;
 const exports={};
 vm.runInNewContext(transpiled,{
  exports,require:name=>{
   if(name==='@angular/core')return {Injectable:()=>x=>x,inject:key=>injected.get(key),signal:initial=>{
    let value=initial;const f=()=>value;f.update=fn=>{if(rendering)throw new Error('Angular NG0600: signal update during template');value=fn(value)};return f;
   }};
   if(name==='./auth.service')return {AuthService};
   if(name==='./realtime.service')return {RealtimeService};
   throw Error('Unexpected '+name);
  },console,Date,Promise,Map,Set
 });
 return {cache:new exports.ScreenCacheService(),setUid:value=>{uid=value},
  render:fn=>{rendering=true;try{return fn()}finally{rendering=false}},
  stats:()=>({connections,disconnects}),handlers};
}
test('first session load fetches once and zero additional GET on tab reentry, including empty data',async()=>{
 const h=harness();let fetches=0,updates=0;
 const fetch=async()=>{fetches++;return {items:[]}};
 await h.cache.ensure('devices',fetch,()=>{updates++});
 await h.cache.ensure('devices',fetch,()=>{updates++});
 assert.equal(fetches,1);
 assert.equal(updates,2);
 assert.deepEqual(JSON.parse(JSON.stringify(h.cache.peek('devices'))),{items:[]});
 assert.equal(h.stats().connections,1);
 await h.cache.ensure('devices',fetch,()=>{updates++},true);
 assert.equal(fetches,2,'Only user forced refresh contacts the API again');
 assert.equal(h.stats().connections,1,'Refreshing unchanged device IDs does not reconnect');
});
test('parallel Overview/Buoys/Notifications resource requests coalesce across screens',async()=>{
 const h=harness();let fetches=0;
 const gate=deferred();
 const load=()=>h.cache.fetch('devices',async()=>{fetches++;await gate.promise;return {items:[{id:'a'}]}});
 const a=load(),b=load();
 gate.resolve();
 await Promise.all([a,b]);
 assert.equal(fetches,1);
 await load();
 assert.equal(fetches,1);
});
test('Pusher marks existing snapshots stale but never performs a GET',async()=>{
 const h=harness();let fetches=0;
 await h.cache.fetch('devices',async()=>{fetches++;return {items:[{id:'b'}]}});
 assert.equal(h.cache.isStale('devices'),false);
 h.handlers.change();
 assert.equal(h.cache.isStale('devices'),true);
 assert.equal(h.cache.isStale('alerts'),true);
 assert.equal(fetches,1);
 await h.cache.fetch('devices',async()=>{fetches++;return {items:[]}},true);
 assert.equal(fetches,2);
 assert.equal(h.cache.isStale('devices'),false);
});
test('UID switch never exposes prior account snapshots and resets session fetch flags',async()=>{
 const h=harness();let fetches=0;
 await h.cache.fetch('devices',async()=>{fetches++;return {items:[{id:'private-alice'}]}});
 h.setUid('bob');
 assert.equal(h.cache.peek('devices'),undefined);
 assert.equal(h.cache.needsNetwork('devices'),true);
 await h.cache.fetch('devices',async()=>{fetches++;return {items:[{id:'bob'}]}});
 assert.equal(fetches,2);
 h.setUid('alice');
 assert.equal(h.cache.peek('devices'),undefined);
});
test('logout clears visible snapshots and disables realtime, even without IndexedDB',async()=>{
 const h=harness();
 await h.cache.fetch('alerts',async()=>({items:[{id:'private-alert'}],nextCursor:null}));
 await h.cache.clearOnLogout();
 assert.equal(h.cache.peek('alerts'),undefined);
 assert.equal(h.cache.needsNetwork('alerts'),true);
 assert.ok(h.stats().disconnects>=1);
});
test('IndexedDB is bounded and keeps only UID-scoped read-only snapshots',()=>{
 const source=read('core/screen-cache.service.ts');
 assert.match(source,/indexedDB\.open\(DB_NAME,SCHEMA\)/);
 assert.match(source,/MAX_TOTAL_BYTES=12\*1024\*1024/);
 assert.match(source,/MAX_SNAPSHOTS=80/);
 assert.match(source,/MAX_ENTRY_BYTES=256\*1024/);
 assert.match(source,/uid\+'\|'\+key/);
 assert.match(source,/clearOnLogout/);
 assert.doesNotMatch(source,/localStorage\.setItem/);
});
test('screen navigation never disconnects or forces the API; mutations remain refresh-authoritative',()=>{
 for(const name of ['dashboard','devices','alerts']){
  const source=read('pages/'+name+'.page.ts');
  assert.match(source,/ScreenCacheService/);
  assert.match(source,/this\.cache\.ensure/);
  assert.match(source,/async ionViewWillEnter\(\)\{await this\.(?:reload|load)\(\)/);
  assert.doesNotMatch(source,/ionViewWillLeave\(\)\{this\.realtime\.disconnect\(\)/);
  assert.match(source,/const force=(?:forceFresh\|\|)?Boolean\(event\)/);
 }
});

test('NG0600 regression: template stale and snapshot getters never write signals or disconnect Pusher',async()=>{
 const h=harness();
 // Before Ionic ever loads a tab, Firebase profile exists but cache has not
 // initialized its UID. Angular may evaluate the stale banner first.
 h.render(()=>{
  assert.equal(h.cache.isStale('devices'),false);
  assert.equal(h.cache.hasSnapshot('devices'),false);
  assert.equal(h.cache.peek('devices'),undefined);
  assert.equal(h.cache.lastUpdated('devices'),undefined);
  assert.equal(h.cache.needsNetwork('devices'),true);
 });
 assert.equal(h.stats().disconnects,0,'A template read cannot tear down realtime');
 await h.cache.fetch('devices',async()=>({items:[{id:'private-alice'}]}));
 h.handlers.change();
 h.render(()=>{
  assert.equal(h.cache.isStale('devices'),true,'Render can safely observe Pusher invalidation');
  assert.equal(h.cache.hasSnapshot('devices'),true);
  assert.equal(h.cache.peek('devices').items[0].id,'private-alice');
  assert.equal(h.cache.needsNetwork('devices'),false);
 });
 const before=h.stats().disconnects;
 h.setUid('bob');
 h.render(()=>{
  assert.equal(h.cache.isStale('devices'),false,'A different account never sees old stale state');
  assert.equal(h.cache.hasSnapshot('devices'),false);
  assert.equal(h.cache.peek('devices'),undefined,'Never expose another UID snapshot');
  assert.equal(h.cache.lastUpdated('devices'),undefined);
  assert.equal(h.cache.needsNetwork('devices'),true);
 });
 assert.equal(h.stats().disconnects,before,'Account reconciliation must not run from a getter');
 await h.cache.fetch('devices',async()=>({items:[{id:'bob-buoy'}]}));
 assert.ok(h.stats().disconnects>before,'Imperative API load reconciles session and disconnects safely');
 assert.equal(h.cache.peek('devices').items[0].id,'bob-buoy');
});
