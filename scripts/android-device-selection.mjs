// Android preflight for verify:android. No build/install occurs until a ready
// device is explicitly selected (or the only running device is found).
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {setTimeout as sleep} from 'node:timers/promises';

export function parseAdbDevices(raw) {
  return String(raw).split(/\r?\n/).map(line => {
    const match=line.trim().match(/^(\S+)\s+(device|offline|unauthorized|recovery|sideload|bootloader)(?:\s|$)/);
    return match ? {serial:match[1],state:match[2],
      detail:line.trim().slice(match[0].length).trim()} : null;
  }).filter(Boolean);
}

export function parseAvailableAvds(raw) {
  return [...new Set(String(raw).split(/\r?\n/).map(x=>x.trim())
    .filter(x=>x && !/^(INFO|WARNING|ERROR|Android|Available|\[)/i.test(x)))];
}

function execAndroid(command,args,timeout=10000) {
  const result=spawnSync(command,args,{encoding:'utf8',shell:false,
    timeout,windowsHide:true});
  if(result.error||result.status!==0) {
    const reason=result.error?.message||result.stderr?.trim()||'exit '+result.status;
    throw new Error(command+' '+args.join(' ')+' failed: '+reason);
  }
  return result.stdout;
}

function devices() {
  return parseAdbDevices(execAndroid('adb',['devices','-l']));
}

function emulatorExecutable() {
  const filename=process.platform==='win32'?'emulator.exe':'emulator';
  const sdkCandidates=[
    process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,
    process.platform==='win32'
      ? join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'Android','Sdk')
      : join(homedir(),'Android','Sdk')
  ];
  for(const sdk of sdkCandidates) {
    if(!sdk)continue;
    const path=join(sdk,'emulator',filename);
    if(existsSync(path))return path;
  }
  // Supports environments where Android SDK's emulator directory is on PATH.
  return filename;
}

function installedAvds() {
  const executable=emulatorExecutable();
  try{return parseAvailableAvds(execAndroid(executable,['-list-avds']));}
  catch(e){
    throw new Error('No online Android device; cannot list Android Studio emulators. '+
      'Check ANDROID_HOME / SDK emulator installation. '+e.message);
  }
}

async function promptChoice(title,options) {
  if(!process.stdin.isTTY||!process.stdout.isTTY) {
    throw new Error('Device selection requires an interactive terminal. '+
      'Connect one authorized running device or run verify:android in PowerShell.');
  }
  console.log('\n'+title);
  for(let i=0;i<options.length;i++)console.log('  '+(i+1)+'. '+options[i]);
  console.log('  0. Cancel (do not build or install)');
  const rl=createInterface({input:process.stdin,output:process.stdout});
  try {
    for(;;) {
      const answer=(await rl.question('Select device number (0 to cancel): ')).trim().toLowerCase();
      if(!answer||answer==='0'||answer==='q')return null;
      if(/^\d+$/.test(answer)) {
        const index=Number(answer)-1;
        if(Number.isSafeInteger(index)&&index>=0&&index<options.length)return index;
      }
      console.log('Invalid selection. Enter a listed number, or 0 to cancel.');
    }
  } finally {rl.close();}
}

async function launchAvd(avdName) {
  const binary=emulatorExecutable();
  console.log('Launching Android emulator: '+avdName);
  await new Promise((resolve,reject)=>{
    const child=spawn(binary,['-avd',avdName],{
      detached:true,stdio:'ignore',windowsHide:false
    });
    child.once('error',reject);
    child.once('spawn',()=>{child.unref();resolve();});
  });
}

async function awaitAvdBoot(avdName) {
  console.log('Waiting for '+avdName+' to boot and become available in ADB…');
  const deadline=Date.now()+180000;
  while(Date.now()<deadline) {
    // Match AVD name, never adopt a different emulator which appeared in ADB.
    let ready=[];
    try{ready=devices().filter(d=>d.state==='device'&&d.serial.startsWith('emulator-'));}
    catch{}
    for(const {serial} of ready) {
      try {
        const name=execAndroid('adb',['-s',serial,'emu','avd','name'],6000)
          .split(/\r?\n/)[0].trim();
        if(name!==avdName)continue;
        const boot=execAndroid('adb',['-s',serial,'shell','getprop','sys.boot_completed'],6000).trim();
        if(boot==='1')return serial;
      } catch {} // Emulator services may not respond until fully booted.
    }
    await sleep(2000);
  }
  throw new Error('Selected emulator '+avdName+
    ' did not fully boot within 180 seconds. No APK installed.');
}

/**
 * @returns {Promise<{serial:string,source:'running'|'emulator',avd?:string}>}
 * The helpers are injectable so tests can prove cancellation and target
 * isolation without launching an Android emulator or touching Firebase.
 */
export async function selectAndroidDevice({
  listDevices=devices,listAvds=installedAvds,ask=promptChoice,
  launch=launchAvd,waitForBoot=awaitAvdBoot,log=console.log
}={}) {
  const all=await listDevices();
  const active=all.filter(d=>d.state==='device');
  if(active.length===1) {
    log('Automatically selected running Android device: '+active[0].serial);
    return {serial:active[0].serial,source:'running'};
  }
  if(active.length>1) {
    const choice=await ask('Multiple running Android devices detected. Select one:',
      active.map(d=>d.serial+(d.detail?' ('+d.detail+')':'')));
    if(choice==null||choice<0||choice>=active.length) {
      throw new Error('No Android device selected. Aborted before build/install.');
    }
    log('Selected running device: '+active[choice].serial);
    return {serial:active[choice].serial,source:'running'};
  }

  log('No running, authorized Android device detected.');
  for(const device of all) {
    log('  Skipping '+device.serial+' (state: '+device.state+').');
  }
  const avds=await listAvds();
  if(!avds.length) {
    throw new Error('No running device and no Android Virtual Devices found. '+
      'Connect/authorize a phone or create an emulator in Android Studio Device Manager.');
  }
  const choice=await ask('No device is running. Select an Android emulator to start:',avds);
  if(choice==null||choice<0||choice>=avds.length) {
    throw new Error('No Android device selected. Aborted before build/install.');
  }
  const avd=avds[choice];
  await launch(avd);
  const serial=await waitForBoot(avd);
  if(!serial||typeof serial!=='string')throw new Error('Selected emulator did not become ready.');
  log('Selected emulator ready: '+avd+' ('+serial+')');
  return {serial,source:'emulator',avd};
}
