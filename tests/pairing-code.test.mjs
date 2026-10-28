import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/app/core/pairing-code.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseDeviceQr}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('QR v2 contains only the public device ID, no claim or device secrets',()=>{
 const value=JSON.stringify({v:2,deviceId:'BG-000124'});
 assert.deepEqual(parseDeviceQr(value),{deviceId:'BG-000124'});
 for(const bad of [
  '{', 'BG-000124',
  JSON.stringify({v:1,deviceId:'BG-000124'}),
  JSON.stringify({v:2,deviceId:'../admin'}),
  JSON.stringify({v:2,deviceId:'x'.repeat(81)}),
  JSON.stringify({v:2,deviceId:'BG-000124',claimCode:'SECRETS_NEVER_IN_QR'}),
  JSON.stringify({v:2,deviceId:'BG-000124',deviceKey:'must-never-appear'}),
  JSON.stringify({v:2,deviceId:'BG-000124',nonce:'must-never-appear'}),
  JSON.stringify({v:2,deviceId:'BG-000124',unexpected:true}),
 ])assert.throws(()=>parseDeviceQr(bad));
});
