import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/app/pages/native-email-action.page.ts','utf8');
const styles=readFileSync('src/app/pages/native-email-action.page.scss','utf8');
function harness({mode='verifyEmail',inspect,verify,reset}={}){
 const routes=[],calls=[],overlayCalls=[];
 let back,unsubscribed=false;
 class AuthService{}class Router{}class Platform{}class ModalController{}
 const auth={
  inspectNativeEmailAction:async()=>{calls.push('inspect');return inspect?inspect():{mode,email:'demo@example.test'}},
  finishNativeVerification:async()=>{calls.push('verify');return verify?verify():false},
  finishNativePasswordReset:async password=>{calls.push('reset');return reset?reset(password):undefined},
  clearNativeEmailAction:()=>calls.push('clear')
 };
 const router={navigateByUrl:async(path,options)=>{routes.push({path,options});return true}};
 const platform={backButton:{subscribeWithPriority:(priority,cb)=>{
   assert.equal(priority,1000);
   back=cb;
   return {unsubscribe:()=>{unsubscribed=true}};
 }}};
 const modalController={create:async options=>{
  overlayCalls.push({action:'create',options});
  return {present:async()=>{overlayCalls.push({action:'present'})},dismiss:async(_,role)=>{overlayCalls.push({action:'dismiss',role})}};
 }};
 const injections=new Map([[AuthService,auth],[Router,router],[Platform,platform],[ModalController,modalController]]);
 const exports={};
 const stubComponent=class{};
 const code=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
 }).outputText;
 const modules={
  '@angular/core':{Component:()=>x=>x,inject:k=>injections.get(k)},
  '@angular/forms':{FormsModule:stubComponent},
  '@angular/router':{Router},
  '@ionic/angular':{Platform},
  '@ionic/angular/standalone':new Proxy({ModalController}, {get:(target,key)=>target[key]??stubComponent}),
  'ionicons':{addIcons:()=>{}},
  'ionicons/icons':{arrowBack:{},checkmarkCircle:{}},
  '../core/auth.service':{AuthService},
  './auth-busy-overlay.component':{AuthBusyOverlayComponent:stubComponent}
 };
 vm.runInNewContext(code,{
  exports,require:name=>{if(!(name in modules))throw Error('Unknown import '+name);return modules[name]},
  console
 });
 return {page:new exports.NativeEmailActionPage(),auth,routes,calls,overlayCalls,
  back:()=>back?.(),didUnsubscribe:()=>unsubscribed};
}
test('P2-15 action UI matches Login/Register flat auth contract, with header back, outlined inputs and regular button',()=>{
 for(const pattern of [
  /ion-header class="no-shadow"/,
  /ion-toolbar color="primary"/,
  /ion-button type="button"[^>]*aria-label="Back to sign in"/,
  /ion-content class="ion-padding page"/,
  /ion-card class="card no-shadow"/,
  /form class="fieldset"/,
  /labelPlacement="stacked" type="password"/,
  /fill="outline" placeholder="Create a new password"/,
  /fill="outline" placeholder="Re-enter your new password"/,
  /ion-input-password-toggle slot="end"/,
  /ion-button class="regular" type="submit"/,
  /styleUrls:\['\.\/login\.page\.scss','\.\/native-email-action\.page\.scss'\]/
 ]) assert.match(source,pattern);
 assert.ok(!styles.includes('box-shadow:'),'No raised/shadowed auth panels');
 assert.ok(!source.includes('Continue to login'),'Verification success should not require a second button');
});
test('P2-15 verify email starts automatically and shows loading → success with no extra verification tap',async()=>{
 let finishVerification;
 const pending=new Promise(resolve=>{finishVerification=resolve});
 const h=harness({verify:()=>pending});
 const inflight=h.page.ngOnInit();
 // inspect promise resolves in the next microtask; finish should then begin.
 for(let i=0;i<12&&!h.calls.includes('verify');i++)await Promise.resolve();
 assert.deepEqual(h.calls,['inspect','verify']);
 assert.equal(h.page.loading,true);
 assert.equal(h.page.progressMessage,'Verifying your email…');
 assert.equal(h.page.success,false);
 assert.equal(h.overlayCalls[0]?.action,'create');
 assert.equal(h.overlayCalls[0]?.options?.cssClass,'blueguard-progress-modal');
 assert.equal(h.overlayCalls[0]?.options?.backdropDismiss,false);
 assert.equal(h.overlayCalls[0]?.options?.canDismiss(null,'backdrop'),false);
 assert.equal(h.overlayCalls[0]?.options?.canDismiss(null,'complete'),true);
 assert.equal(h.overlayCalls[1]?.action,'present');
 finishVerification(true);
 await inflight;
 assert.equal(h.page.success,true);
 assert.equal(h.page.loading,false);
 assert.equal(h.page.ready,false);
 assert.ok(h.overlayCalls.some(x=>x.action==='dismiss'&&x.role==='complete'));
 assert.equal(h.calls.includes('reset'),false);
 h.back();
 await Promise.resolve();
 assert.equal(h.routes[0].path,'/login');
 assert.equal(h.routes[0].options.replaceUrl,true);
 assert.equal(h.calls.filter(x=>x==='clear').length,1);
 h.page.ionViewWillLeave();
 h.page.ngOnDestroy();
 assert.equal(h.didUnsubscribe(),true);
});
test('P2-15 reset uses the same auth view, validates confirmation, and both header/device back dismiss to login',async()=>{
 const h=harness({mode:'resetPassword'});
 await h.page.ngOnInit();
 assert.equal(h.page.ready,true);
 assert.equal(h.page.success,false);
 assert.equal(h.overlayCalls.length,0,'Reset input does not present a verify overlay');
 h.page.nextPassword='SecurePassword2026!';
 h.page.confirmPassword='wrong';
 await h.page.submit();
 assert.match(h.page.error,/Passwords do not match/);
 assert.equal(h.calls.includes('reset'),false);
 h.page.confirmPassword='SecurePassword2026!';
 await h.page.submit();
 assert.equal(h.page.success,true);
 assert.equal(h.page.nextPassword,'');
 assert.equal(h.page.confirmPassword,'');
 await h.page.goLogin();
 assert.equal(h.routes.length,1);
 assert.deepEqual(h.routes[0].path,'/login');
 h.back();
 assert.equal(h.routes.length,1,'Hardware Back after closing must not navigate twice');
});
test('P2-15 failure and exit during in-flight verify never show success or enable protected navigation',async()=>{
 let finishVerification;
 const pending=new Promise(resolve=>{finishVerification=resolve});
 const h=harness({verify:()=>pending});
 const inflight=h.page.ngOnInit();
 for(let i=0;i<12&&!h.calls.includes('verify');i++)await Promise.resolve();
 h.back();
 await Promise.resolve();
 finishVerification(true);
 await inflight;
 assert.equal(h.page.success,false);
 assert.deepEqual(h.routes.map(x=>x.path),['/login']);
 h.page.ngOnDestroy();
 const bad=harness({inspect:async()=>{throw Error('expired action code')}});
 await bad.page.ngOnInit();
 assert.match(bad.page.error,/expired action code/);
 assert.equal(bad.page.success,false);
 assert.equal(bad.calls.includes('verify'),false);
 bad.back();
 await Promise.resolve();
 assert.equal(bad.routes[0].path,'/login');
});

test('P2-15 native email action releases hardware Back when view is hidden and restores it on return',async()=>{
 const h=harness({mode:'resetPassword'});
 await h.page.ngOnInit();
 h.page.ionViewWillLeave();
 assert.equal(h.didUnsubscribe(),true);
 h.page.ionViewWillEnter();
 h.back();
 await Promise.resolve();
 assert.deepEqual(h.routes.map(x=>x.path),['/login']);
 assert.equal(h.routes[0].options.replaceUrl,true);
});
