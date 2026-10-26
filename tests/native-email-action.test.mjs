import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const HOST='oil-spill-monitoring-buoy.firebaseapp.com';
const KEY='SAFE_TEST_PUBLIC_KEY';
const appLinksJs=ts.transpileModule(readFileSync('src/app/core/app-links.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
function appLinksHarness(){
 const store=new Map(),exports={};
 vm.runInNewContext(appLinksJs,{
  exports,require:()=>({environment:{firebase:{authDomain:HOST,apiKey:KEY}}}),
  URL,URLSearchParams,
  sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}
 });
 return {links:exports,store};
}
const link=mode=>'https://'+HOST+'/open/auth-action?mode='+mode+
 '&oobCode=FAKE_ONE_TIME_CODE&apiKey='+KEY;
test('P2 native Firebase email action: only verified-project HTTPS reset/verify links with exact unique parameters are staged',()=>{
 const {links}=appLinksHarness();
 for(const mode of ['verifyEmail','resetPassword']){
  const url=link(mode),a=links.parseNativeEmailAction(url);
  assert.equal(a.mode,mode);
  assert.equal(a.code,'FAKE_ONE_TIME_CODE');
  assert.equal(links.appLinkDestination(url),null,'Sensitive code must never navigate via ordinary App Link router');
 }
 const valid=link('resetPassword');
 for(const raw of [
  valid.replace('https:','http:'),
  valid.replace(HOST,'evil.example'),
  valid.replace(KEY,'WRONG_KEY'),
  valid.replace('/open/auth-action','/open/invite'),
  valid.replace('resetPassword','recoverEmail'),
  valid.replace('FAKE_ONE_TIME_CODE','bad%0Acode'),
  valid+'&oobCode=DUPLICATE',
  valid+'&apiKey='+KEY,
  valid+'&continueUrl=https://evil.example',
  valid+'#x',
  valid.replace('FAKE_ONE_TIME_CODE',''),
  valid.replace('FAKE_ONE_TIME_CODE','x'.repeat(2050)),
 ])assert.equal(links.parseNativeEmailAction(raw),null,raw.slice(0,120));
});
test('P2 legacy Firebase Gmail template returns to BlueGuard for reset and verification',()=>{
 const {links}=appLinksHarness();
 const host='https://'+HOST;
 const continueUrl=host+'/__/auth/links?link='+encodeURIComponent(host+'/open/password-reset-complete');
 for(const mode of ['resetPassword','verifyEmail']){
  const url=host+'/__/auth/action?mode='+mode+'&oobCode=FAKE_ONE_TIME_CODE&apiKey='+KEY+
   '&continueUrl='+encodeURIComponent(continueUrl)+'&lang=en';
  const action=links.parseNativeEmailAction(url);
  assert.equal(action.mode,mode);
  assert.equal(action.code,'FAKE_ONE_TIME_CODE');
  assert.equal(links.appLinkDestination(url),null);
  const tampered=[
   url.replace(KEY,'WRONG_KEY'),
   url.replace(HOST,'evil.example'),
   url.replace('https:','http:'),
   url+'&oobCode=DUPLICATE',
   url+'&redirect=https://evil.example',
   url.replace('mode='+mode,'mode=recoverEmail'),
   url.replace('FAKE_ONE_TIME_CODE','bad%0Acode'),
   url.replace(encodeURIComponent(continueUrl),encodeURIComponent('https://evil.example/steal')),
   url+'&lang=fr',
   url+'#x'
  ];
  for(const attempt of tampered)assert.equal(links.parseNativeEmailAction(attempt),null,attempt.slice(0,140));
 }
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 const bridge=readFileSync('android/app/src/main/java/com/oilspillmonitoringbuoy/app/MainActivity.java','utf8');
 assert.ok(manifest.includes('android:path="/__/auth/action"'));
 assert.ok(bridge.includes('"/__/auth/action".equals(path)'));
});
test('P2 Firebase Hosting app-first wrapped links extract only trusted project codes',()=>{
 const {links}=appLinksHarness();
 const host='https://'+HOST;
 const inner=host+'/__/auth/action?mode=resetPassword&oobCode=FAKE_ONE_TIME_CODE&apiKey='+KEY+
  '&continueUrl='+encodeURIComponent(host+'/open/password-reset-complete');
 const wrapped=host+'/__/auth/links?link='+encodeURIComponent(inner);
 const parsed=links.parseNativeEmailAction(wrapped);
 assert.equal(parsed.mode,'resetPassword');
 assert.equal(parsed.code,'FAKE_ONE_TIME_CODE');
 assert.equal(links.appLinkDestination(wrapped),null);
 for(const tampered of [
  wrapped+'&link='+encodeURIComponent(inner),
  wrapped+'&token=extra',
  wrapped.replace(KEY,'OTHER_KEY'),
  wrapped.replace(HOST,'evil.example'),
  wrapped.replace('https:','http:'),
  wrapped+'#fragment',
  wrapped.replace(encodeURIComponent(inner),encodeURIComponent('https://evil.example/__/auth/action?mode=resetPassword&oobCode=FAKE_ONE_TIME_CODE&apiKey='+KEY)),
  host+'/__/auth/links?link='+encodeURIComponent(host+'/open/invite?deviceId=claimed')
 ])assert.equal(links.parseNativeEmailAction(tampered),null,tampered.slice(0,125));
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 const native=readFileSync('android/app/src/main/java/com/oilspillmonitoringbuoy/app/MainActivity.java','utf8');
 const settings=readFileSync('src/app/core/firebase-email-actions.ts','utf8');
 assert.ok(manifest.includes('android:pathPrefix="/__/auth/links"'));
 assert.ok(native.includes('"/__/auth/links".equals(path)'));
 assert.ok(settings.includes('handleCodeInApp:true'));
});
test('P2 native Firebase email action: Android bridge forwards exactly approved path and no web handler is required',()=>{
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 const native=readFileSync('android/app/src/main/java/com/oilspillmonitoringbuoy/app/MainActivity.java','utf8');
 const app=readFileSync('src/app/app.component.ts','utf8');
 const page=readFileSync('src/app/pages/native-email-action.page.ts','utf8');
 const service=readFileSync('src/app/core/auth.service.ts','utf8');
 const routes=readFileSync('src/app/app.routes.ts','utf8');
 assert.match(manifest,/android:autoVerify="true"/);
 assert.match(manifest,/android:pathPrefix="\/open\/"/);
 assert.match(native,/\/open\/auth-action/);
 assert.match(native,/JSONObject\.quote/);
 assert.match(app,/parseNativeEmailAction\(raw\)/);
 assert.match(app,/clearAppLink\(\);\s*this\.auth\.stageNativeEmailAction\(action\)/);
 assert.match(app,/navigateByUrl\('\/email-action'/);
 assert.match(routes,/path: "email-action"/);
 assert.match(page,/confirmPassword/);
 assert.match(page,/finishNativePasswordReset\(this\.nextPassword\)/);
 assert.match(page,/finishNativeVerification/);
 assert.match(service,/verifyPasswordResetCode\(this\.auth,action\.code\)/);
 assert.match(service,/confirmPasswordReset\(this\.auth,action\.code,nextPassword\)/);
 assert.match(service,/applyActionCode\(this\.auth,action\.code\)/);
 assert.match(service,/this\.clearNativeEmailAction\(\);\s*\/\/ Reset NEVER signs a user in/);
 assert.ok(!page.includes('localStorage'));
 assert.ok(!page.includes('URLSearchParams'));
});
test('P2 native Firebase email action: app consumes bearer link before navigating, no secret is in route history',async()=>{
 const {links,store}=appLinksHarness();
 const key='blueguard.pending-link.v1';
 store.set(key,link('resetPassword'));
 const routes=[],staged=[];
 class Router{}class AuthService{}class RealtimeService{}class PushService{}
 const auth={currentUser:()=>null,stageNativeEmailAction:x=>staged.push(x)};
 const router={navigateByUrl:async(path,opts)=>{routes.push({path,opts});return true}};
 const instances=new Map([[Router,router],[AuthService,auth],[RealtimeService,{}],[PushService,{}]]);
 const code=ts.transpileModule(readFileSync('src/app/app.component.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}
 }).outputText;
 const exports={};
 vm.runInNewContext(code,{
  exports,require:name=>{
   if(name==='@angular/core')return {Component:()=>cls=>cls,inject:key=>instances.get(key)};
   if(name==='@angular/router')return {Router};
   if(name==='./core/auth.service')return {AuthService};
   if(name==='./core/realtime.service')return {RealtimeService};
   if(name==='./core/push.service')return {PushService};
   if(name==='./core/app-links')return links;
   if(name==='@ionic/angular/standalone')return {IonApp:class{},IonRouterOutlet:class{}};
   throw Error('Unexpected module '+name)
  },
  window:{addEventListener:()=>{}},queueMicrotask:()=>{},console
 });
 const instance=new exports.AppComponent();
 await instance.openPendingLink();
 assert.equal(store.has(key),false,'raw code erased on receipt');
 assert.equal(staged.length,1);assert.equal(staged[0].code,'FAKE_ONE_TIME_CODE');
 assert.deepEqual(routes.map(x=>x.path),['/email-action']);
 assert.equal(JSON.stringify(routes).includes('FAKE_ONE_TIME_CODE'),false);
});
