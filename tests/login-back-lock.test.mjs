import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/app/pages/login.page.ts','utf8');
const template=readFileSync('src/app/pages/login.page.html','utf8');

function pendingPromise(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
}

function harness({invalid=false}={}){
 const events=[],backHandlers=[],routes=[];
 const login=pendingPromise(),google=pendingPromise(),navigation=pendingPromise();
 let passwordClears=0,markTouched=0,emailCalls=0,googleCalls=0;
 class AuthService{}class Router{}class Platform{}class NonNullableFormBuilder{}
 const form={
  invalid,
  markAllAsTouched:()=>{markTouched++},
  getRawValue:()=>({email:'DEMO@EXAMPLE.TEST',password:'secret-test-password'}),
  controls:{password:{reset:()=>{passwordClears++}}},
 };
 const auth={
  signIn:async(email,password)=>{emailCalls++;events.push('firebase:email');assert.equal(email,'demo@example.test');assert.equal(password,'secret-test-password');return login.promise},
  signInWithGoogle:async()=>{googleCalls++;events.push('firebase:google');return google.promise}
 };
 const router={navigateByUrl:async(path,options)=>{
  routes.push({path,options});events.push('router:start');await navigation.promise;
  return true;
 }};
 const platform={backButton:{subscribeWithPriority:(priority,callback)=>{
  const h={priority,callback,active:true};
  backHandlers.push(h);events.push('back:'+priority);
  return {unsubscribe:()=>{if(h.active){h.active=false;events.push('release:'+priority);}}};
 }}};
 const builder={group:()=>form};
 const stubs=new Proxy({}, {get:()=>class{}});
 const mocks={
  '@angular/core':{Component:()=>clazz=>clazz,inject:key=>
   key===AuthService?auth:key===Router?router:key===Platform?platform:key===NonNullableFormBuilder?builder:undefined},
  '@ionic/angular':{Platform},
  'rxjs':{},
  '@angular/forms':{NonNullableFormBuilder,ReactiveFormsModule:class{},Validators:{required:()=>{},email:()=>{}}},
  '@angular/router':{Router,RouterLink:class{}},
  '@ionic/angular/standalone':stubs,
  '../core/auth.service':{AuthService},
  '../core/app-links':{getPostLoginTarget:()=>'/tabs/overview'},
  './auth-busy-overlay.component':{AuthBusyOverlayComponent:class{}}
 };
 const exports={};
 const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true
 }}).outputText;
 vm.runInNewContext(transpiled,{
  exports,require:name=>{
   if(!(name in mocks))throw Error('Unexpected import: '+name);
   return mocks[name];
  },console
 });
 const page=new exports.LoginPage();
 const pressBack=()=>{
  const top=backHandlers.filter(h=>h.active).sort((a,b)=>b.priority-a.priority)[0];
  if(!top){events.push('router:hardware-back');return;}
  top.callback();
  events.push('hardware-handled:'+top.priority);
 };
 return {page,auth,events,routes,login,google,navigation,pressBack,
  counts:()=>({emailCalls,googleCalls,markTouched,passwordClears}),
  activePriorities:()=>backHandlers.filter(x=>x.active).map(x=>x.priority)
 };
}

test('Google tap immediately locks Android hardware Back BEFORE launching native Google chooser',async()=>{
 const h=harness();
 h.page.ionViewWillEnter();
 const operation=h.page.googleLogin();
 assert.equal(h.page.busy,true);
 assert.equal(h.page.busyLabel,'Connecting to Google');
 assert.deepEqual(h.activePriorities(),[1000,10000]);
 assert.deepEqual(h.events.slice(0,3),['back:1000','back:10000','firebase:google']);
 h.pressBack();
 assert.equal(h.events.at(-1),'hardware-handled:10000');
 assert.equal(h.routes.length,0);
 assert.equal(h.counts().googleCalls,1);
 await h.page.googleLogin();
 assert.equal(h.counts().googleCalls,1,'Double taps must not start a second cloud auth attempt');
 h.google.resolve({});
 for(let i=0;i<6&&!h.events.includes('router:start');i++)await Promise.resolve();
 assert.equal(h.routes.length,1);
 assert.deepEqual(h.activePriorities(),[1000,10000],'Navigation to tabs is still part of the protected login attempt');
 h.pressBack();
 assert.equal(h.events.at(-1),'hardware-handled:10000');
 h.navigation.resolve();
 await operation;
 assert.equal(h.page.busy,false);
 assert.deepEqual(h.activePriorities(),[1000]);
 assert.equal(h.counts().passwordClears,1);
 h.page.ionViewWillLeave();
 assert.deepEqual(h.activePriorities(),[]);
});

test('Email Sign In synchronously acquires the same lock before Firebase request',async()=>{
 const h=harness();
 const operation=h.page.login();
 assert.equal(h.page.busy,true);
 assert.equal(h.page.busyLabel,'Signing in');
 assert.equal(h.events[0],'back:10000');
 assert.equal(h.events[1],'firebase:email');
 h.pressBack();
 assert.equal(h.events.at(-1),'hardware-handled:10000');
 await h.page.login();
 assert.equal(h.counts().emailCalls,1);
 assert.equal(h.counts().markTouched,1);
 h.login.resolve({});
 for(let i=0;i<6&&!h.events.includes('router:start');i++)await Promise.resolve();
 h.pressBack();
 assert.equal(h.events.at(-1),'hardware-handled:10000');
 h.navigation.resolve();
 await operation;
 assert.deepEqual(h.activePriorities(),[]);
 assert.equal(h.page.busy,false);
});

test('Invalid email form never locks Back or performs a Firebase request',async()=>{
 const h=harness({invalid:true});
 await h.page.login();
 assert.equal(h.page.busy,false);
 assert.deepEqual(h.activePriorities(),[]);
 assert.equal(h.counts().emailCalls,0);
});

test('Firebase failures and Google chooser cancellation always release the Back lock',async()=>{
 const h=harness();
 const attempt=h.page.googleLogin();
 assert.deepEqual(h.activePriorities(),[10000]);
 h.google.reject(new Error('auth/cancelled-popup-request'));
 await attempt;
 assert.equal(h.page.busy,false);
 assert.equal(h.page.error,'');
 assert.deepEqual(h.activePriorities(),[]);
 const second=h.page.login();
 assert.deepEqual(h.activePriorities(),[10000]);
 h.login.reject(new Error('auth/invalid-credential'));
 await second;
 assert.equal(h.page.busy,false);
 assert.match(h.page.error,/incorrect/);
 assert.deepEqual(h.activePriorities(),[]);
});

test('Leaving cached Ionic sign-in page releases any remaining Back subscriptions',async()=>{
 const h=harness();
 h.page.ionViewWillEnter();
 const attempt=h.page.googleLogin();
 assert.deepEqual(h.activePriorities(),[1000,10000]);
 h.page.ionViewWillLeave();
 assert.deepEqual(h.activePriorities(),[]);
 h.google.reject(new Error('cancelled'));
 await attempt;
 assert.deepEqual(h.activePriorities(),[]);
});

test('Login busy overlay remains full screen while inputs/buttons are disabled',()=>{
 assert.match(template,/\[disabled\]="busy" \(click\)="googleLogin\(\)"/);
 assert.match(template,/\[disabled\]="busy"/);
 assert.match(template,/@if\(busy\)\{<app-auth-busy-overlay/);
 assert.match(source,/subscribeWithPriority\(10000,\(\)=>\{\}\)/);
});
