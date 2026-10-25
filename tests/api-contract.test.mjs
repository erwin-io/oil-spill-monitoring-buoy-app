import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Tests the actual ApiService endpoint/DTO coupling with a controlled HTTP client
// rather than comparing component source text.
function apiHarness() {
 const requests=[];
 const http={
  get:(url,opts)=>{requests.push({method:'GET',url,opts});return {items:[],nextCursor:null};},
  post:(url,body)=>{requests.push({method:'POST',url,body});return {registered:true};},
  put:(url,body)=>{requests.push({method:'PUT',url,body});return {configVersion:2};},
  patch:(url,body)=>{requests.push({method:'PATCH',url,body});return {status:'ACKNOWLEDGED'};},
  request:(method,url,options)=>{requests.push({method,url,options});return {unregistered:true};},
 };
 class HttpClient {}
 const exports={};
 const imports={
  '@angular/core':{Injectable:()=>(x)=>x,inject:()=>http},
  '@angular/common/http':{HttpClient},
  'rxjs':{from:x=>x,firstValueFrom:async x=>x},
  '../../environments/environment':{environment:{api:'https://example.test/api/v1'}},
 };
 vm.runInNewContext(ts.transpileModule(readFileSync('src/app/core/api.service.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true},
 }).outputText,{
  exports,require:name=>{if(!(name in imports))throw new Error(name);return imports[name];},console,
 });
 return {api:new exports.ApiService(),requests};
}
test('measurement/history/health UI clients use scoped REST routes and cursor params',()=>{
 const {api,requests}=apiHarness();
 api.devicesPage();
 api.device('TEST/1');
 api.latest('TEST/1');
 api.history('TEST/1','sample_cursor',20);
 api.health('TEST/1');
 assert.deepEqual(requests.map(x=>x.url),[
  'https://example.test/api/v1/devices',
  'https://example.test/api/v1/devices/TEST%2F1',
  'https://example.test/api/v1/devices/TEST%2F1/measurements/latest',
  'https://example.test/api/v1/devices/TEST%2F1/measurements',
  'https://example.test/api/v1/devices/TEST%2F1/health',
 ]);
 assert.equal(requests[3].opts.params.cursor,'sample_cursor');
 assert.equal(requests[3].opts.params.limit,'20');
});
test('alerts, acknowledged status and versioned device config use correct HTTP contracts',()=>{
 const {api,requests}=apiHarness();
 api.alerts();api.alert('alert/1');api.acknowledge('alert/1');
 api.config('TEST/1');api.updateConfig('TEST/1',{configVersion:1,samplingIntervalMinutes:20});
 assert.deepEqual(requests.map(x=>x.method),['GET','GET','PATCH','GET','PUT']);
 assert.equal(requests[2].url,'https://example.test/api/v1/alerts/alert%2F1/acknowledge');
 assert.equal(requests[4].body.configVersion,1);
});
test('mobile FCM register and unregister send the same token and provider tuple',()=>{
 const {api,requests}=apiHarness();
 api.registerToken('test-registration-token','11111111-1111-4111-8111-111111111111','test-session-secret');
 api.unregisterToken('test-registration-token');
 assert.equal(requests[0].method,'POST');
 assert.equal(requests[0].body.platform,'android');
 assert.equal(requests[0].body.provider,'FCM');
 assert.equal(requests[0].body.sessionId,'11111111-1111-4111-8111-111111111111');
 assert.equal(requests[1].method,'DELETE');
 assert.equal(requests[1].options.body.token,requests[0].body.token);
 assert.equal(requests[1].options.body.platform,'android');
});
