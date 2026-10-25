import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(pages){
 const observed=[];
 class HttpClient{}
 const http={get:(url,{params}={})=>{
  if(!url.endsWith('/devices'))throw Error('Unexpected endpoint '+url);
  observed.push(params?.cursor??null);
  return Promise.resolve(pages[params?.cursor??'root']);
 },post:()=>{throw Error('Unexpected mutation')}};
 const deps={
  '@angular/core':{Injectable:()=>cls=>cls,inject:token=>token===HttpClient?http:null},
  '@angular/common/http':{HttpClient},
  'rxjs':{from:x=>x,firstValueFrom:async x=>x},
  '../../environments/environment':{environment:{api:'https://example.test/api/v1'}},
 };
 const compiled=ts.transpileModule(readFileSync('src/app/core/api.service.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true},
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{exports,require:name=>{if(!deps[name])throw Error('Unexpected '+name);return deps[name]}});
 return {api:new exports.ApiService(),observed};
}
test('P2-07 My Buoys aggregates all server pages and retains original sorted order',async()=>{
 const {api,observed}=harness({
  root:{items:[{id:'A'},{id:'B'}],nextCursor:'B'},
  B:{items:[{id:'C'}],nextCursor:'C'},
  C:{items:[{id:'D'}],nextCursor:null},
 });
 const result=await api.devices();
 assert.deepEqual(Array.from(result.items,x=>x.id),['A','B','C','D']);
 assert.deepEqual(observed,[null,'B','C']);
});
test('P2-07 repeated server pagination cursor is rejected rather than infinite-looping',async()=>{
 const {api,observed}=harness({
  root:{items:[{id:'A'}],nextCursor:'A'},
  A:{items:[{id:'A'}],nextCursor:'A'},
 });
 await assert.rejects(api.devices(),/pagination cursor repeated/);
 assert.equal(observed.length,2);
});
