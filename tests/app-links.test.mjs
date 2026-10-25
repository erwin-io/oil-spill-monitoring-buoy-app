import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('src/app/core/app-links.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
function load(){
 const storage=new Map();
 const exports={};
 vm.runInNewContext(source,{
  exports,
  require:moduleName=>{
   if(moduleName==='../../environments/environment')return {environment:{firebase:{authDomain:'oil-spill-monitoring-buoy.firebaseapp.com'}}};
   throw Error('Unexpected '+moduleName);
  },
  URL,URLSearchParams,sessionStorage:{getItem:x=>storage.get(x)??null,setItem:(x,v)=>storage.set(x,v),removeItem:x=>storage.delete(x)}
 });
 return {links:exports,storage};
}
test('P2-15 Gmail link is navigation, not authentication or ownership evidence',()=>{
 const {links}=load();
 const valid='https://oil-spill-monitoring-buoy.firebaseapp.com/open/invite?deviceId=blueguard_21';
 assert.equal(links.appLinkDestination(valid),'/tabs/buoys');
 assert.equal(links.appLinkDestination(valid.replace('/invite','/transfer')),'/tabs/buoys');
 for(const url of [
  valid.replace('https:','http:'),
  'https://evil.example/open/invite?deviceId=blueguard_21',
  valid+'&token=claimed-owner-secret',
  valid+'&deviceId=other-buoy',
  valid.replace('blueguard_21','../admin'),
  valid+'#access_token=evil',
  valid.replace('/open/invite','/__/auth/links'),
  'javascript:alert(1)',
  'https://oil-spill-monitoring-buoy.firebaseapp.com/open/invite',
 ]){
  assert.equal(links.appLinkDestination(url),null,url);
 }
});
test('P2-15 one-shot pending link is consumed only after authenticated sign-in',()=>{
 const {links,storage}=load();
 const key='blueguard.pending-link.v1';
 storage.set(key,'https://oil-spill-monitoring-buoy.firebaseapp.com/open/invite?deviceId=buoy_01');
 assert.equal(links.getPostLoginTarget(),'/tabs/buoys');
 assert.equal(storage.has(key),false);
 assert.equal(links.getPostLoginTarget(),'/tabs/overview');
 storage.set(key,'https://unsafe.example/open/invite?deviceId=buoy_01');
 assert.equal(links.getPostLoginTarget(),'/tabs/overview');
 assert.equal(storage.has(key),false);
});
test('P2-15 Android only intercepts existing Firebase domain with verified HTTPS and safe paths',()=>{
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 const java=readFileSync('android/app/src/main/java/com/oilspillmonitoringbuoy/app/MainActivity.java','utf8');
 const config=JSON.parse(readFileSync('firebase.json','utf8'));
 assert.match(manifest,/autoVerify="true"/);
 assert.match(manifest,/oil-spill-monitoring-buoy\.firebaseapp\.com/);
 assert.match(manifest,/android:pathPrefix="\/open\/"/);
 assert.match(java,/APP_LINK_HOST = "oil-spill-monitoring-buoy\.firebaseapp\.com"/);
 assert.match(java,/JSONObject\.quote/);
 assert.match(java,/getWebView\(\)\.evaluateJavascript/);
 assert.equal(config.hosting.public,'hosting/public');
 assert.equal(config.hosting.rewrites[0].source,'/open/**');
});

test('P2-15 sensitive Firebase email-action codes NEVER pass into Android return links',()=>{
 const {links}=load(),host='https://oil-spill-monitoring-buoy.firebaseapp.com';
 assert.equal(links.appLinkDestination(host+'/open/email-verified'),'/verify-email');
 assert.equal(links.appLinkDestination(host+'/open/password-reset-complete'),'/login');
 for(const path of ['/open/email-verified','/open/password-reset-complete']){
   for(const suffix of ['?oobCode=secret','?mode=verifyEmail','?email=user@example.com','#access_token=bad','?success=true']){
     assert.equal(links.appLinkDestination(host+path+suffix),null);
   }
 }
 assert.equal(links.appLinkDestination(host+'/__/auth/action?mode=verifyEmail&oobCode=secret'),null,
    'Browser owns Firebase one-time action code; only completion is returned to mobile');
 const native=readFileSync('android/app/src/main/java/com/oilspillmonitoringbuoy/app/MainActivity.java','utf8');
 assert.match(native,/\/open\/email-verified/);
 assert.match(native,/\/open\/password-reset-complete/);
});
