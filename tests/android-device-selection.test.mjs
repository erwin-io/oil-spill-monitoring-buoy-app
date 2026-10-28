import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAdbDevices,parseAvailableAvds,selectAndroidDevice} from '../scripts/android-device-selection.mjs';

const samsung={serial:'R58W123456A',state:'device',detail:'model:SM_A166P'};
const pixel={serial:'emulator-5554',state:'device',detail:'model:sdk_gphone64_x86_64'};
const offline={serial:'R58W000',state:'offline',detail:''};

test('ADB parser recognizes only connected states, not daemon text or headers',()=>{
 const result=parseAdbDevices('List of devices attached\r\n'+
  'R58W123456A  device product:xyz model:SM_A166P\r\n'+
  'emulator-5554\tdevice model:sdk_gphone\r\n'+
  'R58W000 offline\r\nR58W999 unauthorized\r\n');
 assert.deepEqual(result.map(x=>[x.serial,x.state]),[
  ['R58W123456A','device'],['emulator-5554','device'],
  ['R58W000','offline'],['R58W999','unauthorized']]);
});
test('AVD parser preserves emulator IDs and omits blank/status lines',()=>{
 assert.deepEqual(parseAvailableAvds('Pixel_8_API_29\r\nPixel_8_API_34\n\n'),
  ['Pixel_8_API_29','Pixel_8_API_34']);
});
test('verify:android automatically selects its sole ready Samsung or emulator',async()=>{
 for(const device of [samsung,pixel]){
  let asked=false;
  const target=await selectAndroidDevice({listDevices:()=>[offline,device],
   listAvds:()=>{throw Error('Must not inspect AVDs');},
   ask:()=>{asked=true;return 0;},log:()=>{}});
  assert.equal(target.serial,device.serial);
  assert.equal(target.source,'running');
  assert.equal(asked,false);
 }
});
test('two running devices require user selection and preserve serial isolation',async()=>{
 let shown=[];
 const selected=await selectAndroidDevice({listDevices:()=>[samsung,pixel],
  ask:async(title,options)=>{shown=options;return 1;},log:()=>{}});
 assert.equal(selected.serial,pixel.serial);
 assert.equal(shown.length,2);
 await assert.rejects(selectAndroidDevice({listDevices:()=>[samsung,pixel],
  ask:()=>null,log:()=>{}}),/No Android device selected/);
});
test('offline and unauthorized hardware is skipped; explicit AVD selection launches only selected AVD',async()=>{
 let launched='',booted='';
 const result=await selectAndroidDevice({
  listDevices:()=>[offline,{serial:'R58W999',state:'unauthorized',detail:''}],
  listAvds:()=>['Pixel_8_API_29','Pixel_8_API_34'],
  ask:async(title,choices)=>{assert.match(title,/No device is running/);return 1;},
  launch:avd=>{launched=avd;},
  waitForBoot:avd=>{booted=avd;return 'emulator-5560';},
  log:()=>{}
 });
 assert.deepEqual(result,{serial:'emulator-5560',source:'emulator',avd:'Pixel_8_API_34'});
 assert.equal(launched,'Pixel_8_API_34');
 assert.equal(booted,'Pixel_8_API_34');
});
test('no AVD, cancelled selection and invalid selection abort before launching anything',async()=>{
 for(const {avds,answer} of [
  {avds:[],answer:null},
  {avds:['Pixel_8_API_34'],answer:null},
  {avds:['Pixel_8_API_34'],answer:99}
 ]){
  let launches=0;
  await assert.rejects(selectAndroidDevice({listDevices:()=>[],
   listAvds:()=>avds,ask:()=>answer,
   launch:()=>{launches++;},log:()=>{}}),
   /No running device|No Android device selected/);
  assert.equal(launches,0);
 }
});
test('selected emulator must become ready before proceeding',async()=>{
 await assert.rejects(selectAndroidDevice({listDevices:()=>[],listAvds:()=>['Pixel_8_API_34'],
  ask:()=>0,launch:()=>{},waitForBoot:()=>'',log:()=>{}}),/did not become ready/);
});
test('runner chooses device before npm tasks and targets ALL ADB operations',()=>{
 const runner=requireRead();
 assert.ok(runner.indexOf('selectedDevice=await selectAndroidDevice()')<
   runner.indexOf("run('Locked dependencies'"));
 for(const part of [
  "['-s',serial,'install','-r',apk]",
  "['-s',serial,'exec-out','screencap','-p']"
 ])assert.ok(runner.includes(part),part);
 // Require explicit activity, PID, foreground and screenshot checks on the selected device.
 assert.ok(runner.includes("['-s',serial,'shell','am','start','-W','-n',activity]"));
 assert.ok(runner.includes('waitForAndroidForeground'));
 assert.ok(runner.includes('Android activity launch accepted'));
 assert.ok(runner.includes('BlueGuard MainActivity is foreground'));
 assert.ok(!runner.includes("['-s',serial,'shell','monkey'"),'Monkey is not a reliable launch acceptance method');
});
import {readFileSync} from 'node:fs';
function requireRead(){return readFileSync('scripts/verify-local.mjs','utf8');}
