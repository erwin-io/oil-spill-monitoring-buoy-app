import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(overrides={}){
 class ApiService{} class AuthService{} class Router{} class ModalController{} class ScreenCacheService{} class AddDeviceModalService{}
 const calls={created:[],cancelled:[],poll:[],routes:[],stale:[],fetch:0,modalClosed:0,boot:0};
 let uid='user-a';
 const intent={deviceId:'BG-000124',intentId:'intent-xyz',state:'WAITING_FOR_PAIR',expiresAt:new Date(Date.now()+300000).toISOString()};
 const api={
  createPairIntent:async id=>{calls.created.push(id);return {...intent,deviceId:id}},
  pairIntentStatus:async(id,i)=>{calls.poll.push([id,i]);return {...intent,deviceId:id,state:'CONFIRMED'}},
  cancelPairIntent:async(id,i)=>{calls.cancelled.push([id,i]);return {...intent,deviceId:id,state:'CANCELLED'}},
  devices:async()=>({items:[{id:'BG-000124'}]}),
  ...overrides
 };
 const auth={currentUser:()=>uid?{uid}:null,bootstrap:async()=>{calls.boot++}};
 const router={navigate:async(...args)=>{calls.routes.push(args);return true},navigateByUrl:async()=>true};
 const modalController={getTop:async()=>({dismiss:async()=>{calls.modalClosed++}})};
 const cache={markStale:keys=>{calls.stale.push(keys)},fetch:async(key,loader)=>{calls.fetch++;return loader()}};
 const service={close:async()=>{calls.modalClosed++}};
 const deps=new Map([[ApiService,api],[AuthService,auth],[Router,router],
  [ModalController,modalController],[ScreenCacheService,cache],[AddDeviceModalService,service]]);
 const ions=Object.fromEntries(['IonContent','IonHeader','IonToolbar','IonTitle','IonButton','IonButtons','IonIcon'].map(i=>[i,class{}]));
 const requires={
  '@angular/core':{Component:()=>cls=>cls,inject:t=>deps.get(t)},
  '@angular/common':{CommonModule:class{}},
  '@angular/router':{Router},
  'rxjs':{firstValueFrom:async v=>v},
  '@capacitor/core':{Capacitor:{isNativePlatform:()=>false}},
  '@capacitor-mlkit/barcode-scanning':{BarcodeScanner:{},BarcodeFormat:{QrCode:'qr'}},
  '@ionic/angular/standalone':{...ions,ModalController},
  '../core/api.service':{ApiService},
  '../core/auth.service':{AuthService},
  '../core/pairing-code':{parseDeviceQr:value=>JSON.parse(value)},
  '../core/ui-error':{uiError:e=>e?.message??'Connection failed'},
  '../core/add-device-modal.service':{AddDeviceModalService},
  '../core/screen-cache.service':{ScreenCacheService},
  'ionicons':{addIcons:()=>{}},
  'ionicons/icons':{closeOutline:{}}
 };
 const output={exports:{}};
 const code=ts.transpileModule(readFileSync('src/app/pages/add-device.page.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
 }).outputText;
 vm.runInNewContext(code,{
  exports:output.exports,require:n=>{if(!(n in requires))throw Error('Unexpected import: '+n);return requires[n]},
  console,setTimeout:()=>1,clearTimeout:()=>{},Date
 });
 return {page:new output.exports.AddDevicePage(),calls,api,setUid:x=>{uid=x}};
}
test('QR v2 waiting requires confirmed backend ownership before device navigation',async()=>{
 const h=harness();await h.page.beginPairing('BG-000124');
 assert.equal(h.page.state,'WAITING_FOR_PAIR');
 assert.equal(h.calls.boot,0);
 assert.deepEqual(h.calls.created,['BG-000124']);
 await h.page.poll('BG-000124','intent-xyz',h.page.generation);
 assert.equal(h.page.state,'CONFIRMED');
 assert.equal(h.calls.boot,1);
 assert.equal(h.calls.fetch,1);
 assert.equal(h.calls.modalClosed,1);
 assert.equal(h.calls.routes[0][0][1],'BG-000124');
 assert.equal(h.calls.cancelled.length,0,'Confirmed ownership must not be cancelled');
});
test('closing the modal cancels the precise pending API intent and abandons polling',async()=>{
 const h=harness();await h.page.beginPairing('BG-000124');
 await h.page.close();
 assert.deepEqual(h.calls.cancelled,[['BG-000124','intent-xyz']]);
 assert.equal(h.page.intentId,'');
 assert.equal(h.calls.routes.length,0);
});
test('late confirmed status cannot navigate after cancellation',async()=>{
 let resolve;
 const h=harness({pairIntentStatus:()=>new Promise(r=>{resolve=r})});
 await h.page.beginPairing('BG-000124');
 const pending=h.page.poll('BG-000124','intent-xyz',h.page.generation);
 await h.page.close();
 resolve({deviceId:'BG-000124',intentId:'intent-xyz',state:'CONFIRMED'});
 await pending;
 assert.equal(h.calls.boot,0);
 assert.equal(h.calls.routes.length,0);
});
test('account switch aborts post-response state and prevents cross-user navigation',async()=>{
 let resolve;
 const h=harness({createPairIntent:()=>new Promise(r=>{resolve=r})});
 const starting=h.page.beginPairing('BG-000124');
 h.setUid('user-b');
 resolve({deviceId:'BG-000124',intentId:'intent-xyz',state:'WAITING_FOR_PAIR'});
 await starting;
 assert.equal(h.page.intentId,'');
 assert.equal(h.calls.boot,0);
 assert.equal(h.calls.routes.length,0);
});
test('server conflict remains visible and does not claim another account',async()=>{
 const h=harness({createPairIntent:async()=>{throw {status:409,error:{error:{code:'PAIRING_CONFLICT'}}}}});
 await h.page.beginPairing('BG-000124');
 assert.equal(h.page.state,'CONFLICT');
 assert.match(h.page.error,/Another pairing attempt/);
 assert.equal(h.calls.routes.length,0);
});
test('offline polling interruption retries without falsely expiring or claiming',async()=>{
 const h=harness({pairIntentStatus:async()=>{throw {status:503}}});
 await h.page.beginPairing('BG-000124');
 await h.page.poll('BG-000124','intent-xyz',h.page.generation);
 assert.equal(h.page.networkInterrupted,true);
 assert.equal(h.page.state,'WAITING_FOR_PAIR');
 assert.equal(h.calls.routes.length,0);
});
