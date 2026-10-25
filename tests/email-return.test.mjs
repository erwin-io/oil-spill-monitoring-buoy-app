import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code=ts.transpileModule(readFileSync('src/app/app.component.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
}).outputText;
function harness({target,current,verified}){
 const routes=[],cleared=[];
 class Router{}class AuthService{}class RealtimeService{}class PushService{}
 const router={navigateByUrl:async(url)=>{routes.push(url);return true}};
 const auth={currentUser:()=>current,ready:async()=>!!verified,reloadVerified:async()=>!!verified};
 let pending='https://oil-spill-monitoring-buoy.firebaseapp.com/open/email-verified';
 const targetContext={
  Router:router,AuthService:auth,RealtimeService:{},PushService:{}
 };
 const classes=new Map([[Router,router],[AuthService,auth],[RealtimeService,{}],[PushService,{}]]);
 const modules={
  '@angular/core':{Component:()=>c=>c,inject:key=>classes.get(key)},
  '@angular/router':{Router},
  './core/auth.service':{AuthService},
  './core/realtime.service':{RealtimeService},
  './core/push.service':{PushService},
  './core/app-links':{
   peekAppLink:()=>pending,appLinkDestination:()=>target,
   clearAppLink:()=>{cleared.push(pending);pending=null}
  },
  '@ionic/angular/standalone':{IonApp:class{},IonRouterOutlet:class{}}
 };
 const exports={};
 vm.runInNewContext(code,{
  exports,require:n=>{if(!(n in modules))throw Error('Unexpected '+n);return modules[n]},
  window:{addEventListener:()=>{}},queueMicrotask:()=>{},console
 });
 const app=new exports.AppComponent();
 return {app,routes,cleared};
}
test('verification return calls Firebase server state before opening protected tabs',async()=>{
 const good=harness({target:'/verify-email',current:{uid:'a'},verified:true});
 await good.app.openPendingLink();
 assert.deepEqual(good.routes,['/tabs/overview']);
 assert.equal(good.cleared.length,1);
 const unverified=harness({target:'/verify-email',current:{uid:'a'},verified:false});
 await unverified.app.openPendingLink();
 assert.deepEqual(unverified.routes,['/verify-email']);
 const signedOut=harness({target:'/verify-email',current:null,verified:true});
 await signedOut.app.openPendingLink();
 assert.deepEqual(signedOut.routes,['/login']);
});
test('password reset return is never treated as signed-in authorization',async()=>{
 const h=harness({target:'/login',current:{uid:'a'},verified:true});
 await h.app.openPendingLink();
 assert.deepEqual(h.routes,['/login']);
 assert.equal(h.cleared.length,1);
});
