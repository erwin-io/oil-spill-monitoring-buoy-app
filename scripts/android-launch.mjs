// Deterministic Android launch acceptance for the selected ADB device.
// "monkey" may return exit 1 after "Events injected: 1" even when the app
// starts successfully. Prefer am start -W plus foreground/process evidence.
import {setTimeout as sleep} from 'node:timers/promises';

export function activityLaunchAccepted(raw, activity) {
  const lines=String(raw??'').split(/\r?\n/).map(line=>line.trim());
  return lines.includes('Status: ok') && lines.includes('Activity: '+activity);
}

export function isAndroidPidRunning(raw) {
  return /^\d+(?:\s+\d+)*$/.test(String(raw??'').trim());
}

export function isAndroidActivityForeground(raw, activity) {
  return String(raw??'').split(/\r?\n/).some(line=>
    /(?:^|\s)(?:topResumedActivity|mResumedActivity)\s*[:=]/i.test(line) &&
    line.includes(activity));
}

export function isPngScreenshot(raw) {
  return Buffer.isBuffer(raw) && raw.length>500 &&
    raw.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
}

/**
 * ADB process/foreground state may lag behind the successful am start -W.
 * Retry briefly, always with the specifically selected serial; never accept
 * another app's foreground activity or merely a live background process.
 * execute(args) is injectable for emulator-free unit tests.
 */
export async function waitForAndroidForeground({
  serial,packageId,activity=packageId+'/.MainActivity',execute,
  attempts=8,delayMs=500,pause=sleep
}) {
  if(!serial||!packageId||!activity.startsWith(packageId+'/')||typeof execute!=='function')
    throw new TypeError('An explicit Android serial, application and ADB executor are required');
  let pid='';
  for(let i=0;i<attempts;i++) {
    try {
      const rawPid=execute(['-s',serial,'shell','pidof',packageId]);
      pid=isAndroidPidRunning(rawPid)?rawPid.trim():'';
    } catch { pid=''; }
    if(pid) {
      try {
        const activities=execute(['-s',serial,'shell','dumpsys','activity','activities']);
        if(isAndroidActivityForeground(activities,activity))
          return {pid,foreground:true,attempts:i+1};
      } catch { /* ADB may be temporarily unavailable after activity launch. */ }
    }
    if(i+1<attempts)await pause(delayMs);
  }
  return {pid,foreground:false,attempts};
}
