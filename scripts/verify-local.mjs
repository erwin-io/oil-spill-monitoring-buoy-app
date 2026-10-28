#!/usr/bin/env node
/**
 * One-command mobile unit/contract/Angular validation, plus optional native
 * Android Gradle + ADB smoke evidence using the EXISTING Firebase project.
 *
 * npm run verify:local
 * npm run verify:local -- --skip-install
 * npm run verify:android
 * npm run verify:android -- --screenshot
 *
 * This never seeds or deletes live Firebase documents and never sends FCM.
 * It DOES NOT replace a human check of notifications and rendered screens.
 */
import { spawnSync } from 'node:child_process';
import { selectAndroidDevice } from './android-device-selection.mjs';
import {activityLaunchAccepted,isPngScreenshot,waitForAndroidForeground} from './android-launch.mjs';
import {useJava21,gradleVersionForJavaCheck} from './android-java-preflight.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const outputDir=join(root,'.test-output');
const flags=new Set(process.argv.slice(2));
const supported=new Set(['--skip-install','--android','--install','--screenshot','--dry-run']);
for(const flag of flags)if(!supported.has(flag)){
 console.error(`Unsupported argument ${flag}`);process.exit(2);
}
if(flags.has('--screenshot')&&!flags.has('--install')){
 console.error('--screenshot requires --install (and --android)');process.exit(2);
}
if(flags.has('--install')&&!flags.has('--android')){
 console.error('--install requires --android');process.exit(2);
}
const win=process.platform==='win32';
const packageId='com.oilspillmonitoringbuoy.app';
const steps=[];
let failure;
const dryRun=flags.has('--dry-run');
let selectedDevice=null;
let androidBuildAttempted=false;
let deviceLaunchAttempted=false;

function run(name,cmd,args=[],cwd=root){
 console.log(`\n=== ${name} ===`);
 console.log(`Command: ${cmd} ${args.join(' ')}`);
 if(dryRun){steps.push({name,status:'PLAN'});return;}
 const start=Date.now();
 const result=spawnSync(win&&(cmd==='npm'||cmd==='npx')?`${cmd}.cmd`:cmd,args,{
  cwd,stdio:'inherit',shell:win&&(cmd==='npm'||cmd==='npx'||cmd==='gradlew.bat'),
  env:process.env,
 });
 steps.push({name,status:!result.error&&result.status===0?'PASS':'FAIL',elapsedMs:Date.now()-start});
 if(result.error||result.status!==0)throw new Error(`${name}: ${result.error?.message||'exit '+result.status}`);
}
function check(name,ok,message){
 console.log(`[${ok?'PASS':'FAIL'}] ${name}`);
 steps.push({name,status:ok?'PASS':'FAIL'});
 if(!ok)throw new Error(message);
}
function output(cmd,args){
 const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',shell:false});
 if(r.error||r.status!==0)throw new Error(`${cmd} failed: ${r.error?.message||r.stderr?.slice(0,200)||r.status}`);
 return r.stdout;
}
console.log('Oil Spill Monitoring Buoy: AUTOMATED LOCAL MOBILE ACCEPTANCE');
console.log('Cloud dataset: unchanged; no live synthetic telemetry is created.');
try{
 // Preflight must complete BEFORE npm install, tests, Angular or Gradle builds.
 if(flags.has('--android')&&flags.has('--install')&&!dryRun){
  selectedDevice=await selectAndroidDevice();
  check('Selected Android device is ready',!!selectedDevice?.serial,
    'No Android device selected. Aborted before build/install.');
 }
 if(flags.has('--android')&&!dryRun){
  const javaHome=useJava21(process.env);
  console.log('Using JDK 21 for Android build: '+javaHome);
  const details=gradleVersionForJavaCheck({androidDir:join(root,'android'),env:process.env});
  console.log(details.split('\n').filter(s=>/^(Launcher JVM:|Daemon JVM:|JVM:)/.test(s.trim())).join('\n'));
  check('Gradle Java 21 preflight',true,'Gradle must run Java 21');
 }
 if(!flags.has('--skip-install'))run('Locked dependencies','npm',['ci','--no-audit','--no-fund']);
 run('Node service, contracts and fixture tests','npm',['test']);
 run('Angular production compilation','npm',['run','check']);
 run('Angular build','npm',['run','build']);
 // Do not mutate Android project or attempt native builds for basic local tests.
 if(flags.has('--android')){
  const cap=readFileSync(join(root,'capacitor.config.ts'),'utf8');
  check('Android application ID',cap.includes(packageId),'Capacitor package ID mismatch');
  const prod=readFileSync(join(root,'src/environments/environment.prod.ts'),'utf8');
  check('Phone uses remote HTTPS API',/api:\s*["']https:\/\//.test(prod),'Android release API must be reachable HTTPS, not localhost');
  const googlePath=join(root,'android/app/google-services.json');
  if(!dryRun){
   check('Firebase Android config exists',existsSync(googlePath),
    'Install private android/app/google-services.json for the existing Firebase project');
   const config=JSON.parse(readFileSync(googlePath,'utf8'));
   const declared=prod.match(/projectId:\s*["']([^"']+)["']/)?.[1];
   const androidProject=config.project_info?.project_id;
   const matchesPackage=(config.client||[]).some(c=>c.client_info?.android_client_info?.package_name===packageId);
   check('Firebase project matches mobile Web SDK',!!declared&&androidProject===declared,
    'google-services.json is for a different Firebase project');
   check('Firebase Android package matches',matchesPackage,'google-services.json is for a different Android app');
  }
  run('Capacitor Android synchronization','npx',['cap','sync','android']);
  const gradle=win?'gradlew.bat':'./gradlew';
  androidBuildAttempted=true;
  run('Native Android debug APK',''+gradle,[':app:assembleDebug','--no-daemon'],join(root,'android'));
  const apk=join(root,'android/app/build/outputs/apk/debug/app-debug.apk');
  if(!dryRun)check('Debug APK generated',existsSync(apk),'Gradle did not produce app-debug.apk');
  if(flags.has('--install')){
   if(dryRun){
    console.log('[PLAN] Choose ready Android device before build; adb -s <serial> install -r, launch, pidof, optional screenshot');
   }else{
    const serial=selectedDevice?.serial;
    check('Selected Android device is still online',
      !!serial&&output('adb',['-s',serial,'get-state']).trim()==='device',
      'The selected device disconnected before installation. No APK installed.');
    run('Install debug APK','adb',['-s',serial,'install','-r',apk]);
    deviceLaunchAttempted=true;
    const activity=packageId+'/.MainActivity';
    const launched=output('adb',['-s',serial,'shell','am','start','-W','-n',activity]);
    console.log(launched.trim());
    check('Android activity launch accepted',activityLaunchAccepted(launched,activity),
      'Android did not confirm a successful BlueGuard MainActivity launch');
    const running=await waitForAndroidForeground({
      serial,packageId,activity,execute:args=>output('adb',args)
    });
    check('Android app process alive after launch',!!running.pid,
      'App process was not found after launch; inspect Android Studio Logcat');
    check('BlueGuard MainActivity is foreground',running.foreground,
      'BlueGuard is not the resumed Android activity; inspect device screen or Logcat');
    console.log('Verified Android foreground app PID: '+running.pid);
    if(flags.has('--screenshot')){
     const screenshot=spawnSync('adb',['-s',serial,'exec-out','screencap','-p'],{
      encoding:null,maxBuffer:12*1024*1024,timeout:15000
     });
     check('ADB screenshot captured',!screenshot.error&&screenshot.status===0&&isPngScreenshot(screenshot.stdout),
      'Unable to capture a valid Android PNG screenshot');
     mkdirSync(outputDir,{recursive:true});
     writeFileSync(join(outputDir,'android-launch.png'),screenshot.stdout);
     console.log('Private screenshot saved to .test-output/android-launch.png (not committed).');
    }
   }
  }
 }
}catch(e){failure=e.message;console.error('\nFAILED:',failure);}
finally{
 if(!dryRun){
  mkdirSync(outputDir,{recursive:true});
  const report={
   suite:'Mobile local automated acceptance',
   timestamp:new Date().toISOString(),
   result:failure?'FAIL':'PASS',
   androidBuildAttempted,
   deviceLaunchAttempted,
   selectedAndroidSerial:selectedDevice?.serial??null,
   selectedAndroidSource:selectedDevice?.source??null,
   liveFirestoreMutated:false,
   fcmDeliveryProven:false,
   pusherLiveDeliveryProven:false,
   steps,
   ...(failure?{failure}:{}),
  };
  writeFileSync(join(outputDir,'mobile-local-validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Report: ${join(outputDir,'mobile-local-validation.json')}`);
 }
}
if(failure)process.exitCode=1;
