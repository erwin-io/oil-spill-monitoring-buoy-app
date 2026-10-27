import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function mount(pageName,{api={},role='VIEWER'}={}){
 class ApiService{} class RealtimeService{} class PushService{} class AuthService{} class ActivatedRoute{} class AddDeviceModalService{} class EmptyStateComponent{} class ScreenCacheService{}
 const realtime={connect:()=>{},disconnect:()=>{},connected:()=>false};
 const push={start:async()=>{}};
 const cached=new Map(),loaded=new Set();
 const cache={
  peek:key=>cached.get(key),hasSnapshot:key=>cached.has(key),
  needsNetwork:key=>!loaded.has(key),isStale:()=>false,
  lastUpdated:()=>Date.now(),markStale:()=>{},
  connectRealtime:()=>{realtime.connect((cached.get('devices')?.items??[]).map(x=>x.id),()=>{})},
  ensure:async(key,loader,onData,force=false)=>{
   if(cached.has(key))onData(cached.get(key),true);
   if(force||!loaded.has(key)){
    const result=await loader();cached.set(key,result);loaded.add(key);onData(result,false);
   }
  },
  fetch:async(key,loader,force=false)=>{
   if(!force&&loaded.has(key))return cached.get(key);
   const value=await loader();cached.set(key,value);loaded.add(key);return value;
  },
  update:async(key,data)=>{cached.set(key,data);loaded.add(key)},
  clearOnLogout:async()=>{cached.clear();loaded.clear()}
 };
 const auth={profile:()=>({uid:'test-user',role}),bootstrap:async()=>({uid:'test-user',role})};
 const route={snapshot:{paramMap:{get:()=> 'THESIS_TEST_01'}}};
 const dependencies=new Map([[ApiService,api],[RealtimeService,realtime],[PushService,push],
  [AuthService,auth],[ActivatedRoute,route],[AddDeviceModalService,{open:()=>{},close:()=>{}}],[ScreenCacheService,cache]]);
 const ions=Object.fromEntries([
  'IonContent','IonHeader','IonToolbar','IonTitle','IonButton','IonButtons','IonBackButton',
  'IonSearchbar','IonSelect','IonSelectOption','IonRefresher','IonRefresherContent',
  'IonSpinner','IonInput'
 ].map(x=>[x,class{}]));
 const modules={
  '@angular/core':{Component:()=>cls=>cls,inject:t=>dependencies.get(t)},
  '@angular/common':{CommonModule:class{}},
  '@angular/forms':{FormsModule:class{}},
  '@angular/router':{RouterLink:class{},ActivatedRoute},
  'ionicons':{addIcons:()=>{}},
  'ionicons/icons':{addOutline:{},arrowForwardOutline:{}},
  '../core/add-device-modal.service':{AddDeviceModalService},
  './empty-state.component':{EmptyStateComponent},
  '@ionic/angular/standalone':ions,
  'rxjs':{firstValueFrom:async x=>x},
  '../core/api.service':{ApiService},
  '../core/realtime.service':{RealtimeService},
  '../core/push.service':{PushService},
  '../core/auth.service':{AuthService},
  '../core/screen-cache.service':{ScreenCacheService},
  '../core/ui-error':{uiError: e=>e?.message??'Test error'},
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(`src/app/pages/${pageName}.page.ts`,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true},
 }).outputText,{
  exports,require:name=>{if(!(name in modules))throw Error('Unknown '+name);return modules[name];},console,
 });
 const className={'dashboard':'DashboardPage','devices':'DevicesPage',
  'history':'HistoryPage','config':'ConfigPage','alerts':'AlertsPage','device-detail':'DeviceDetailPage'}[pageName];
 return {page:new exports[className](),realtime,auth};
}
test('dashboard counters read actual fixture classifications, battery and current last-seen time',async()=>{
 const records=[
  {id:'THESIS_TEST_01',name:'One',latestClassification:'PETROLEUM',batteryPercent:10,
   cellStatus:'MAINTENANCE_REQUIRED',lastSeenAt:new Date().toISOString(),lastMeasurementAt:new Date().toISOString()},
  {id:'THESIS_TEST_02',name:'Two',latestClassification:'INTERFERENCE',batteryPercent:80,
   cellStatus:'CLEAN',lastSeenAt:'2000-01-01T00:00:00.000Z',lastMeasurementAt:'2026-01-01T00:00:00Z'},
 ];
 const alerts=[{id:'test-alert',status:'OPEN',type:'PETROLEUM'}];
 let subscribed=[];
 const {page,realtime}=mount('dashboard',{api:{
  devices:()=>Promise.resolve({items:records}),alerts:()=>Promise.resolve({items:alerts})
 }});
 realtime.connect=ids=>{subscribed=ids;};
 await page.ionViewWillEnter();
 assert.equal(page.devices.length,2);
 assert.equal(page.online,1);
 assert.equal(page.oil,1);
 assert.equal(page.suspicious,1);
 assert.equal(page.lowBattery,1);
 assert.equal(page.maintenance,1);
 assert.equal(page.alerts.length,1);
 assert.deepEqual(Array.from(page.recentMeasurements,x=>x.id),['THESIS_TEST_01','THESIS_TEST_02']);
 assert.deepEqual(Array.from(subscribed),['THESIS_TEST_01','THESIS_TEST_02']);
});
test('no-device Overview clears prior-account data while concurrent API loads complete',async()=>{
 let alertCalls=0;
 const {page}=mount('dashboard',{api:{devices:()=>Promise.resolve({items:[]}),alerts:()=>{alertCalls++;return Promise.resolve({items:[]})}}});
 page.devices=[{id:'previous-account',name:'Private'}];page.alerts=[{id:'private-alert'}];
 await page.reload();
 assert.equal(page.devices.length,0);
 assert.equal(page.alerts.length,0);
 assert.equal(alertCalls,1,'Overview requests alerts concurrently to avoid a device-first network waterfall');
});
test('buoy page searches and classification filters authoritative API items',async()=>{
 const {page}=mount('devices',{api:{devices:()=>Promise.resolve({items:[
  {id:'THESIS_TEST_01',name:'South',latestClassification:'PETROLEUM'},
  {id:'THESIS_TEST_02',name:'North',latestClassification:'NORMAL'},
 ]})}});
 await page.ionViewWillEnter();
 page.onSearch('south');
 assert.equal(page.shown.length,1);
 assert.equal(page.shown[0].id,'THESIS_TEST_01');
 page.filter='NORMAL';
 assert.equal(page.shown.length,0);
 page.onSearch('');
 assert.equal(page.shown.length,1);
 assert.equal(page.shown[0].id,'THESIS_TEST_02');
});
test('mobile history appends paginated measurements once and sends next cursor',async()=>{
 const cursors=[];
 const {page}=mount('history',{api:{history:(id,cursor)=>{
  cursors.push(cursor);
  return Promise.resolve(cursor?{items:[{measurementId:'m2'}],nextCursor:null}:
    {items:[{measurementId:'m1'}],nextCursor:'cursor-1'});
 }}});
 await page.ionViewWillEnter();
 assert.equal(page.items.length,1);
 await page.more();
 assert.deepEqual(cursors,[undefined,'cursor-1']);
 assert.deepEqual(Array.from(page.items,x=>x.measurementId),['m1','m2']);
 assert.equal(page.cursor,null);
});
test('optimistic conflict reloads current configuration and retains visible error message',async()=>{
 let read=0,write=0;
 const {page}=mount('config',{role:'OPERATOR',api:{
  device:()=>Promise.resolve({id:'THESIS_TEST_01',access:'LEGACY_VIEWER'}),
  config:()=>{read++;return Promise.resolve({configVersion:read, samplingIntervalMinutes:15});},
  updateConfig:()=>{write++;return Promise.reject({status:409,message:'CONFIG_CONFLICT'});}
 }});
 await page.ionViewWillEnter();
 await page.save();
 assert.equal(read,2);
 assert.equal(write,1);
 assert.equal(page.config.configVersion,2);
 assert.match(page.error,/changed elsewhere/);
 assert.equal(page.busy,false);
});
test('claimed owner can configure despite legacy global VIEWER role',async()=>{
 const {page}=mount('config',{role:'VIEWER',api:{
  device:()=>Promise.resolve({id:'THESIS_TEST_01',access:'OWNER'}),
  config:()=>Promise.resolve({configVersion:1,samplingIntervalMinutes:15}),
 }});
 await page.ionViewWillEnter();
 assert.equal(page.canEdit,true);
});
test('viewer cannot attempt a configuration mutation',async()=>{
 let calls=0;
 const {page}=mount('config',{role:'VIEWER',api:{updateConfig:()=>{calls++;}}});
 page.config={configVersion:1,samplingIntervalMinutes:15};
 await page.save();
 assert.equal(page.canEdit,false);
 assert.equal(calls,0);
});


test('buoy list labels online, offline, not-yet-seen and disabled status correctly',()=>{
 const {page}=mount('devices');
 assert.equal(page.onlineLabel({id:'A',status:'ACTIVE'}),'Not yet online');
 assert.equal(page.onlineLabel({id:'A',status:'DISABLED',lastSeenAt:new Date().toISOString()}),'Disabled');
 assert.equal(page.onlineLabel({id:'A',status:'ACTIVE',lastSeenAt:new Date().toISOString()}),'Online');
 assert.equal(page.onlineLabel({id:'A',status:'ACTIVE',lastSeenAt:'2001-01-01T00:00:00Z'}),'Offline');
});

test('personal Notifications inbox stays unfiltered and paginates without duplicate records',async()=>{
 const cursors=[];const {page}=mount('alerts',{api:{
  alerts:(cursor,status)=>{
   cursors.push([cursor,status]);
   return Promise.resolve(cursor?{items:[{id:'a2',deviceId:'B1',status:'OPEN'},{id:'a3',deviceId:'B1',status:'OPEN'}],nextCursor:null}
    :{items:[{id:'a1',deviceId:'B1',status:'OPEN',unread:true},{id:'a2',deviceId:'B1',status:'OPEN'}],nextCursor:'a2'});
  },
  devices:()=>Promise.resolve({items:[{id:'B1',name:'Buoy One'}]})
 }});
 await page.ionViewWillEnter();
 assert.equal(page.nameOf(page.items[0]),'Buoy One');
 assert.equal(page.items[0].unread,true);
 assert.equal(page.cursor,'a2');
 await page.more();
 assert.deepEqual(Array.from(page.items,x=>x.id),['a1','a2','a3']);
 assert.equal(page.cursor,null);
 assert.equal(cursors.length,2);
 assert.equal(cursors[0][1],undefined);
 assert.equal(cursors[1][0],'a2');
});

test('Mark All Read invokes personal receipt API without acknowledging incidents',async()=>{
 let marked=0,ack=0;
 const {page}=mount('alerts',{api:{
  alerts:()=>Promise.resolve({items:[{id:'a1',deviceId:'B1',unread:marked===0}],nextCursor:null,unreadCount:marked===0?1:0}),
  devices:()=>Promise.resolve({items:[]}),
  markAllRead:()=>{marked++;return Promise.resolve({readAt:new Date().toISOString(),deviceCount:1})},
  acknowledge:()=>{ack++;return Promise.resolve({})},
 }});
 await page.ionViewWillEnter();await page.markAll();
 assert.equal(marked,1);assert.equal(ack,0);assert.equal(page.unreadCount,0);
});
test('buoy detail uses truthful last-known cleaning telemetry and tolerates absent health',async()=>{
 const api={
  device:()=>Promise.resolve({id:'B1',name:'Test buoy'}),
  latest:()=>Promise.reject({status:404}),
  health:()=>Promise.resolve({items:[{washPump:'RUNNING',valve:'OPEN',samplePump:'OFF'}]})
 };
 const {page}=mount('device-detail',{api});
 await page.ionViewWillEnter();
 assert.equal(page.device.name,'Test buoy');
 assert.equal(page.health.washPump,'RUNNING');
 assert.equal(page.latest,undefined);
});

test('P2-03 incoming ownership transfer requires recipient acceptance and bootstrap refresh',async()=>{
 let calls=0;
 const offer={deviceId:'THESIS_TEST_01',requestId:'tx-1',expiresAt:'2099-01-01T00:00:00Z'};
 const {page}=mount('devices',{api:{
  devices:()=>Promise.resolve({items:[]}),
  invitations:()=>Promise.resolve({items:[]}),
  incomingTransfers:()=>Promise.resolve({items:[offer]}),
  acceptTransfer:(id,requestId)=>{calls++;assert.equal(id,offer.deviceId);assert.equal(requestId,offer.requestId);return Promise.resolve({access:'OWNER'})},
 }});
 await page.ionViewWillEnter();
 assert.equal(page.transfers.length,1);
 await page.acceptOwnership(offer);
 assert.equal(calls,1);
 assert.equal(page.accepting,'');
});
test('P2-03 owner transfer UI refuses requests without exact buoy ID confirmation',async()=>{
 let requests=0;
 const {page}=mount('device-detail',{api:{
  device:()=>Promise.resolve({id:'THESIS_TEST_01',access:'OWNER'}),
  latest:()=>Promise.reject({status:404}),
  health:()=>Promise.resolve({items:[]}),
  startTransfer:()=>{requests++;return Promise.resolve({expiresAt:'2099-01-01T00:00:00Z'})},
 }});
 await page.load();
 page.transferEmail='recipient@example.test';
 page.transferConfirmId='WRONG';
 await page.requestTransfer();
 assert.equal(requests,0);
 page.transferConfirmId='THESIS_TEST_01';
 await page.requestTransfer();
 assert.equal(requests,1);
 assert.match(page.transferMessage,/pending recipient acceptance/);
});
