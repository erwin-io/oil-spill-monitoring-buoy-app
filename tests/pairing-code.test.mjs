import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/app/core/pairing-code.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseProtectedQr}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('protected QR selects a device and separate claim code without carrying an upload key',()=>{
 const code='A'.repeat(43),value=JSON.stringify({v:1,deviceId:'buoy_123',claimCode:code});
 assert.deepEqual(parseProtectedQr(value),{deviceId:'buoy_123',claimCode:code});
 for(const bad of [
  '{',JSON.stringify({v:1,deviceId:'../admin',claimCode:code}),
  JSON.stringify({v:1,deviceId:'buoy_123',claimCode:'short'}),
  JSON.stringify({v:2,deviceId:'buoy_123',claimCode:code}),
  JSON.stringify({v:1,deviceId:'buoy_123',claimCode:code,deviceKey:'must-never-appear'}),
 ])assert.throws(()=>parseProtectedQr(bad));
});
