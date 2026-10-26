import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(key='public-key',remoteConfig={enabled:false}){
 const timers=new Map();
 const instances=[];
 let timerId=0;
 const signal=initial=>{
  let value=initial;
  const read=()=>value;
  read.set=next=>{value=next;};
  return read;
 };
 class AuthService {}
 const auth={profile:()=>({uid:'tester'}),token:async()=>'fake-id-token'};
 class FakePusher {
  constructor(){
   this.connection={
    callbacks:{},
    bind:(event,cb)=>{this.connection.callbacks[event]=cb;},
    emit:(event)=>{this.connection.callbacks[event]?.();}
   };
   this.channels=new Map();
   instances.push(this);
  }
  subscribe(name){
   if(!this.channels.has(name)){
    const callbacks={};
    this.channels.set(name,{callbacks,bind:(event,cb)=>{callbacks[event]=cb;},emit:(event)=>{callbacks[event]?.();}});
   }
   return this.channels.get(name);
  }
  disconnect(){this.disconnected=true;}
 }
 const environment={api:'https://example.test/api/v1',pusher:{key,cluster:'ap1'}};
 const modules={
  '@angular/core':{Injectable:()=>(cls)=>cls,inject:()=>auth,signal},
  'pusher-js':{__esModule:true,default:FakePusher},
  './auth.service':{AuthService},
  '../../environments/environment':{environment},
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(
  readFileSync('src/app/core/realtime.service.ts','utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}
 ).outputText,{
  exports,
  require:(name)=>{
   if(!(name in modules))throw new Error('Unknown module: '+name);
   return modules[name];
  },
  setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},
  clearInterval:(id)=>{timers.delete(id);},
  console,
  fetch:async()=>({ok:true,json:async()=>remoteConfig}),
 });
 const service=new exports.RealtimeService();
 return {service,instances,timers,tick:()=>{for(const {fn} of [...timers.values()])fn();}};
}

test('empty Pusher key uses REST fallback timer; disconnect stops it',()=>{
 const {service,instances,timers,tick}=harness('');
 let refetches=0;
 service.connect([],()=>{refetches++;});
 assert.equal(instances.length,0);
 assert.equal(timers.size,1);
 tick();
 assert.equal(refetches,1);
 service.disconnect();
 assert.equal(timers.size,0);
 tick();
 assert.equal(refetches,1);
});

test('connection, disconnect, reconnect and stale callbacks reconcile exactly while active',()=>{
 const {service,instances,timers,tick}=harness();
 let updates=0;
 service.connect(['B1','B1'],()=>{updates++;});
 assert.equal(instances.length,1);
 assert.equal(instances[0].channels.size,2,'device dedup plus private-user channel');
 assert.equal(timers.size,1,'REST fallback active before socket connection');
 const socket=instances[0];
 socket.connection.emit('connected');
 assert.equal(service.connected(),true);
 assert.equal(timers.size,0);
 assert.equal(updates,1,'reconcile on connection');
 socket.channels.get('private-device-B1').emit('measurement.created');
 assert.equal(updates,2);
 socket.connection.emit('disconnected');
 assert.equal(service.connected(),false);
 assert.equal(timers.size,1);
 tick();
 assert.equal(updates,3,'REST refresh during socket outage');
 socket.connection.emit('connected');
 assert.equal(updates,4,'reconcile after socket recovery');
 service.disconnect();
 assert.equal(timers.size,0);
 const before=updates;
 socket.channels.get('private-device-B1').emit('alert.created');
 socket.connection.emit('connected');
 assert.equal(updates,before,'old subscription must not update after logout/leave');
});

test('reconnect with newly assigned device IDs replaces old subscriptions',()=>{
 const {service,instances,timers}=harness();
 let updated=0;
 service.connect(['B1'],()=>{updated++;});
 const old=instances[0];
 service.connect(['B2'],()=>{updated++;});
 assert.equal(old.disconnected,true);
 assert.equal(instances[1].channels.has('private-device-B2'),true);
 assert.equal(instances[1].channels.has('private-device-B1'),false);
 old.connection.emit('connected');
 assert.equal(updated,0);
 service.disconnect();
 assert.equal(timers.size,0);
});

test('missing bundled key loads authenticated public runtime Pusher config before opening private channels',async()=>{
 const {service,instances}=harness('',{enabled:true,key:'public-client-123',cluster:'ap1'});
 service.connect(['buoy-1'],()=>{});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(instances.length,1);
 assert.equal(instances[0].channels.has('private-device-buoy-1'),true);
 service.disconnect();
});
test('disabled server public config leaves REST fallback active',async()=>{
 const {service,instances,timers}=harness('',{enabled:false});
 service.connect(['buoy-1'],()=>{});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(instances.length,0);
 assert.equal(timers.size,1);
 service.disconnect();
});
