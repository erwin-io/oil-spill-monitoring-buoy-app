import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function mount(pageName,{api={},role='VIEWER'}={}){
 class ApiService{} class RealtimeService{} class PushService{} class AuthService{} class ActivatedRoute{}
 const realtime={connect:()=>{},disconnect:()=>{},connected:()=>false};
 const push={start:async()=>{}};
 const auth={profile:()=>({uid:'test-user',role})};
 const route={snapshot:{paramMap:{get:()=> 'THESIS_TEST_01'}}};
 const dependencies=new Map([[ApiService,api],[RealtimeService,realtime],[PushService,push],
  [AuthService,auth],[ActivatedRoute,route]]);
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
  '@ionic/angular/standalone':ions,
  'rxjs':{firstValueFrom:async x=>x},
  '../core/api.service':{ApiService},
  '../core/realtime.service':{RealtimeService},
  '../core/push.service':{PushService},
  '../core/auth.service':{AuthService},
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

test('alert inbox resolves buoy name, filters server-side, paginates without duplicate records',async()=>{
 const cursors=[];const {page}=mount('alerts',{api:{
  alerts:(cursor,status)=>{
   cursors.push([cursor,status]);
   return Promise.resolve(cursor?{items:[{id:'a2',deviceId:'B1',status:'OPEN'},{id:'a3',deviceId:'B1',status:'OPEN'}],nextCursor:null}
    :{items:[{id:'a1',deviceId:'B1',status:'OPEN',unread:true},{id:'a2',deviceId:'B1',status:'OPEN'}],nextCursor:'a2'});
  },
  devices:()=>Promise.resolve({items:[{id:'B1',name:'Buoy One'}]})
 }});
 page.filter='OPEN';
 await page.ionViewWillEnter();
 assert.equal(page.nameOf(page.items[0]),'Buoy One');
 assert.equal(page.items[0].unread,true);
 assert.equal(page.cursor,'a2');
 await page.more();
 assert.deepEqual(Array.from(page.items,x=>x.id),['a1','a2','a3']);
 assert.equal(page.cursor,null);
 assert.equal(cursors.length,2);
 assert.equal(cursors[0][1],'OPEN');
 assert.equal(cursors[1][0],'a2');
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
