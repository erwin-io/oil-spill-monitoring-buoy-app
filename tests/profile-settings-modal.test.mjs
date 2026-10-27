import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=name=>readFileSync('src/app/pages/'+name,'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const transpile=source=>ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
}).outputText;

function settingsHarness(file){
 const events=[],routes=[];
 let back,unsubscribed=0,releaseSave;
 const gate=new Promise(resolve=>{releaseSave=resolve});
 class AuthService{}class Router{}class Platform{}class ModalController{}
 const auth={
  profile:()=>({displayName:'Existing name',email:'demo@example.test'}),
  updateDisplayName:async name=>{events.push('save:'+name);await gate;},
  resetPassword:async email=>{events.push('email:'+email);await gate;}
 };
 const router={navigateByUrl:async target=>{routes.push(target);return true}};
 const top={dismiss:async(_,role)=>{events.push('dismiss:'+role)}};
 const modals={getTop:async()=>top};
 const platform={backButton:{subscribeWithPriority:(priority,callback)=>{
  assert.equal(priority,1000);back=callback;events.push('subscribed');
  return{unsubscribe:()=>{unsubscribed++}};
 }}};
 const dep=new Map([[AuthService,auth],[Router,router],[Platform,platform],[ModalController,modals]]);
 const stub=class {};
 const modules={
  '@angular/core':{Component:()=>klass=>klass,inject:key=>dep.get(key)},
  '@angular/forms':{FormsModule:stub},
  '@angular/router':{Router},
  '@ionic/angular':{Platform},
  '@ionic/angular/standalone':new Proxy({ModalController},{get:(target,key)=>target[key]??stub}),
  'ionicons':{addIcons:()=>{}},
  'ionicons/icons':{arrowBack:{}},
  '../core/auth.service':{AuthService},
  './auth-busy-overlay.component':{AuthBusyOverlayComponent:stub}
 };
 const exports={};
 vm.runInNewContext(transpile(read(file)),{exports,require:name=>{
  if(!(name in modules))throw Error('Unexpected module '+name);
  return modules[name];
 },console});
 const Type=file==='edit-display-name.page.ts'?exports.EditDisplayNamePage:exports.ProfilePasswordPage;
 return {page:new Type(),events,routes,back:()=>back(),releaseSave,unsubscribed:()=>unsubscribed};
}

test('Edit display name is full screen with arrow Back and bottom sticky Save footer',()=>{
 const source=read('edit-display-name.page.ts');
 const css=read('edit-display-name.page.scss');
 assert.match(source,/aria-label="Back to Profile"/);
 assert.match(source,/name="arrow-back"/);
 assert.equal(source.includes('>Close</ion-button>'),false);
 assert.match(source,/<ion-footer class="ion-no-border display-name-save-footer">/);
 assert.equal(source.includes('subscribeWithPriority(1000'),true);
 assert.match(css,/display:flex;flex-direction:column;height:100%/);
 assert.match(css,/safe-area-inset-bottom/);
 const profile=read('profile-password.page.ts');
 assert.match(profile,/aria-label="Back to Profile"/);
 assert.match(profile,/name="arrow-back"/);
 assert.equal(profile.includes('>Close</ion-button>'),false);
 assert.equal(profile.includes('subscribeWithPriority(1000'),true);
});

test('Edit display name: hardware Back dismisses only top Ionic modal and unsubscribes',async()=>{
 const h=settingsHarness('edit-display-name.page.ts');
 h.page.ngOnInit();
 assert.equal(h.page.name,'Existing name');
 h.back();await flush();
 assert.deepEqual(h.events.filter(x=>x.startsWith('dismiss:')),['dismiss:cancel']);
 assert.equal(h.routes.length,0,'Must not change background tab route');
 h.page.ngOnDestroy();
 assert.equal(h.unsubscribed(),1);
});

test('Edit display name blocks hardware Back while save in flight, then dismisses with saved role',async()=>{
 const h=settingsHarness('edit-display-name.page.ts');
 h.page.ngOnInit();
 h.page.name='Updated Name';
 const pending=h.page.save();
 await Promise.resolve();
 h.back();await flush();
 assert.equal(h.events.some(x=>x==='dismiss:cancel'),false);
 h.releaseSave();await pending;
 assert.equal(h.events.includes('dismiss:saved'),true);
 h.page.ngOnDestroy();
});

test('Change password: hardware Back dismisses top modal, not tab route',async()=>{
 const h=settingsHarness('profile-password.page.ts');
 h.page.ngOnInit();
 h.back();await flush();
 assert.equal(h.events.includes('dismiss:cancel'),true);
 assert.equal(h.routes.length,0);
 h.page.ngOnDestroy();
 assert.equal(h.unsubscribed(),1);
});

test('Change password send blocks Back until reset request settles',async()=>{
 const h=settingsHarness('profile-password.page.ts');
 h.page.ngOnInit();
 const pending=h.page.send();await Promise.resolve();
 assert.equal(h.page.busy,true);
 h.back();await flush();
 assert.equal(h.events.includes('dismiss:cancel'),false);
 h.releaseSave();await pending;
 assert.equal(h.page.sent,true);
 h.back();await flush();
 assert.equal(h.events.includes('dismiss:cancel'),true);
 h.page.ngOnDestroy();
});

test('Sign out uses a nondismissable app-wide Ionic progress modal before revoking FCM',async()=>{
 const events=[];
 let releaseRevocation;
 const revocation=new Promise(resolve=>{releaseRevocation=resolve});
 class AuthService{}class RealtimeService{}class PushService{}class Router{}class ModalController{}class ScreenCacheService{}
 const auth={logout:async()=>events.push('auth:logout'),profile:()=>null};
 const realtime={disconnect:()=>events.push('realtime:disconnect')};
 const push={stop:async flag=>{assert.equal(flag,true);events.push('push:start');await revocation;events.push('push:done')}};
 const router={navigateByUrl:async(url,options)=>{events.push('route:'+url);assert.equal(options.replaceUrl,true);return true}};
 const overlay={present:async()=>{events.push('present')},dismiss:async(_,role)=>{events.push('dismiss:'+role)}};
 const modals={create:async options=>{events.push('create');assert.equal(options.cssClass,'blueguard-progress-modal');
  assert.equal(options.componentProps.kind,'logout');
  assert.equal(options.componentProps.label,'Signing out');
  assert.equal(options.backdropDismiss,false);
  assert.equal(await options.canDismiss(null,'backdrop'),false);
  assert.equal(await options.canDismiss(null,'complete'),true);
  return overlay;
 }};
 const cache={clearOnLogout:async()=>{events.push('cache:clear')}};
 const dep=new Map([[AuthService,auth],[RealtimeService,realtime],[PushService,push],[Router,router],[ModalController,modals],[ScreenCacheService,cache]]);
 const stub=class{};
 const modules={
  '@angular/common':{CommonModule:stub},
  '@angular/forms':{FormsModule:stub},
  '@angular/core':{Component:()=>x=>x,ViewChild:()=>()=>{},inject:key=>dep.get(key)},
  '@angular/router':{Router},
  '@ionic/angular/standalone':new Proxy({ModalController},{get:(target,key)=>target[key]??stub}),
  'ionicons':{addIcons:()=>{}},
  'ionicons/icons':{},
  '../core/auth.service':{AuthService},
  '../core/screen-cache.service':{ScreenCacheService},
  '../core/realtime.service':{RealtimeService},
  '../core/push.service':{PushService},
  './auth-busy-overlay.component':{AuthBusyOverlayComponent:stub}
 };
 const exports={};
 vm.runInNewContext(transpile(read('profile.page.ts')),{exports,require:name=>{
  if(!(name in modules))throw Error('Unexpected module '+name);
  return modules[name];
 },console});
 const page=new exports.ProfilePage();
 const pending=page.logout();
 for(let i=0;i<12&&!events.includes('push:start');i++)await Promise.resolve();
 assert.deepEqual(events.slice(0,3),['create','present','push:start']);
 assert.equal(page.signingOut,true);
 assert.equal(events.includes('auth:logout'),false);
 releaseRevocation();await pending;
 assert.deepEqual(events,['create','present','push:start','push:done','realtime:disconnect','cache:clear','auth:logout','route:/login','dismiss:complete']);
 assert.equal(page.signingOut,false);
 assert.equal(read('profile.page.html').includes('app-auth-busy-overlay *ngIf="signingOut"'),false);
});
