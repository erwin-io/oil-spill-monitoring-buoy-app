import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const html=readFileSync('src/app/pages/verify.page.html','utf8');
const css=readFileSync('src/app/pages/verify.page.scss','utf8');
const code=readFileSync('src/app/pages/verify.page.ts','utf8');
function harness(){
 const calls=[],routes=[];
 let onBack,removed=0,passes=0;
 class Router{}class Platform{}class AuthService{}
 const auth={resendVerification:async()=>{calls.push('resend')}};
 const router={navigateByUrl:async(path,options)=>{routes.push({path,options});return true}};
 const platform={backButton:{subscribeWithPriority:(priority,callback)=>{
  passes++;assert.equal(priority,1000);onBack=callback;return{unsubscribe:()=>{removed++}}}}};
 const instances=new Map([[Router,router],[Platform,platform],[AuthService,auth]]);
 const modules={
  '@angular/core':{Component:()=>cls=>cls,inject:key=>instances.get(key)},
  '@angular/router':{Router},
  '@ionic/angular':{Platform},
  'ionicons':{addIcons:()=>{}},
  'ionicons/icons':{arrowBack:{}},
  '../core/auth.service':{AuthService},
  '@ionic/angular/standalone':new Proxy({},{get:()=>class{}})
 };
 const compiled=ts.transpileModule(code,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{exports,require:name=>{
  if(!(name in modules))throw Error('Unexpected '+name);
  return modules[name];
 },console});
 return {page:new exports.VerifyPage(),calls,routes,back:()=>onBack(),removed:()=>removed,passes:()=>passes};
}
test('Waiting-for-verification page shows centered illustration over Resend ONLY, same flat auth header',()=>{
 assert.match(html,/ion-header class="no-shadow"/);
 assert.match(html,/ion-toolbar color="primary"/);
 assert.match(html,/aria-label="Back to sign in" \(click\)="goLogin\(\)"/);
 assert.match(html,/<svg[\s\S]*<\/svg>/);
 assert.match(html,/Resend verification email/);
 assert.match(css,/align-items:\s*center;/);
 assert.match(css,/justify-content:\s*center;/);
 assert.doesNotMatch(html,/I've verified my email/i);
 assert.doesNotMatch(html,/Back to sign in<\/ion-button>/);
 assert.doesNotMatch(html,/\(click\)="check\(\)"/);
 assert.doesNotMatch(code,/reloadVerified|applyActionCode|finishNativeVerification/);
});
test('Waiting page device back navigates exactly once to Login and never exits or returns Register',async()=>{
 const h=harness();
 h.page.ionViewWillEnter();
 h.back();
 await Promise.resolve();
 assert.equal(h.routes.length,1);
 assert.equal(h.routes[0].path,'/login');
 assert.equal(h.routes[0].options.replaceUrl,true);
 assert.equal(h.removed(),1);
 h.back();
 await Promise.resolve();
 assert.equal(h.routes.length,1);
});
test('Waiting page resend only calls send email and releases cached Android Back subscription on leave',async()=>{
 const h=harness();
 h.page.ionViewWillEnter();
 await h.page.resend();
 assert.deepEqual(h.calls,['resend']);
 assert.match(h.page.message,/Check your inbox/);
 h.page.ionViewWillLeave();
 assert.equal(h.removed(),1);
 h.page.ionViewWillEnter();
 assert.equal(h.passes(),2);
 h.page.ngOnDestroy();
 assert.equal(h.removed(),2);
});
test('Capacitor App native back plugin is installed and locked to same major version',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 assert.equal(pkg.dependencies['@capacitor/app'],'7.1.0');
 assert.equal(lock.packages[''].dependencies['@capacitor/app'],'7.1.0');
 assert.equal(lock.packages['node_modules/@capacitor/app'].version,'7.1.0');
});
