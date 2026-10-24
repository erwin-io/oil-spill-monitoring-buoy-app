import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/app/core/ui-error.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports});
const {uiError}=exports;
test('network, expired session, authorization, throttling and server errors receive clear messages',()=>{
 assert.match(uiError({status:0}),/Network unavailable/);
 assert.match(uiError({status:401}),/session has expired/);
 assert.match(uiError({status:403}),/not authorized/);
 assert.match(uiError({status:429}),/Too many requests/);
 assert.match(uiError({status:503,message:'Firebase private token ABC'}),/Monitoring service is unavailable/);
 assert.ok(!uiError({status:503,message:'PRIVATE_KEY'}).includes('PRIVATE_KEY'));
 assert.match(uiError({status:422,error:{error:{message:'Invalid sampling interval'}}}),/Invalid sampling interval/);
});
